import { config } from "../config/common";
import { trimAll } from "../helper/commonHelper";
import lessonRepository from "../repository/lessonRepository";
import { ILesson } from "../models/lessonModel";
import moduleRepository from "../repository/moduleRepository";
import moduleService from "../services/moduleService";
import cloudinaryService from "./cloudinaryService";
import { generatePagination } from "../utils/paginationUtils";
import sectionRepository from "../repository/sectionRepository";

const lessonService = {
  getLesson,
  getLessons,
  createLesson,
  updateLesson,
  deleteLesson,
  searchLesson,
  archiveLesson,
  updateLessonProgress,
};

export default lessonService;

async function getLesson(id: string, params: any): Promise<ILesson | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.GET);
  }

  try {
    const dbParams: any = { query: {}, options: {} };

    if (params.populateArray) {
      dbParams.options.populateArray = params.populateArray;
    }

    if (params.select) {
      if (!Array.isArray(params.select)) {
        params.select = [params.select];
      }
      dbParams.options.select = params.select.join(" ");
    }
    if (params.lean !== undefined) {
      dbParams.options.lean = params.lean;
    }

    return await lessonRepository.getLesson(id, dbParams);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getLessons(
  params: any
): Promise<{ lessons: ILesson[]; pagination: any; count?: number }> {
  if (!params) {
    throw new Error(config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.GET_ALL);
  }

  try {
    const dbParams: any = {
      query: {},
      options: {},
    };

    if (params.queryArray) {
      const queryArrayObj: { [key: string]: any } = {};
      queryArrayObj[params.queryArrayType] = params.queryArray;
      dbParams.query = { ...dbParams.query, ...queryArrayObj };
    }

    if (params.populateArray) {
      dbParams.options.populateArray = params.populateArray;
    }

    if (params.sort) {
      dbParams.options.sort = params.sort;
    }

    const limit = params.limit || 10;
    const skip = params.skip || 0;
    dbParams.options.limit = limit;
    dbParams.options.skip = skip * limit;

    if (params.select) {
      if (!Array.isArray(params.select)) {
        params.select = [params.select];
      }
      dbParams.options.select = params.select.join(" ");
    }

    if (params.lean !== undefined) {
      dbParams.options.lean = params.lean;
    }

    const page = params.page || 1;

    const [lessons, count] = await Promise.all([
      lessonRepository.getLessons(dbParams),
      lessonRepository.lessonsCount(dbParams.query),
    ]);

    const pagination = generatePagination(count, page, limit);

    return {
      ...(params.document && { lessons }),
      ...(params.pagination && { pagination }),
      ...(params.count && { count }),
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function createLesson(
  data: Partial<ILesson> & {
    moduleId?: string;
    mainContentText?: string;
  },
  files?: { [fieldname: string]: Express.Multer.File[] },
  user?: any
): Promise<{ newLesson: ILesson; section: any | null }> {
  if (!data) {
    throw new Error(config.ERROR.USER.REQUIRED_FIELDS);
  }

  try {
    const { moduleId, mainContentText, ...trimmedData } = trimAll(data);

    if (!moduleId) {
      throw new Error("moduleId is required");
    }

    const module = await moduleService.getModule(moduleId, { select: ["title"] });

    if (!module) {
      throw new Error("Module not found");
    }
    if (files && files["files"]) {
      trimmedData.files = trimmedData.files || {};
      trimmedData.files = await cloudinaryService.multipleUploadFile(
        files["files"],
        `${trimmedData.path}`
      );
    }

    if (files && files["mainContent"] && files["mainContent"].length > 0) {
      const mainContentFile = files["mainContent"][0];
      const fileExtension = mainContentFile.originalname.split(".").pop()?.toLowerCase() || "";

      if (fileExtension === "pdf") {
        trimmedData.mainContent = await cloudinaryService.uploadPdf(
          mainContentFile,
          `${trimmedData.path}`
        );
      } else if (["doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"].includes(fileExtension)) {
        trimmedData.mainContent = await cloudinaryService.uploadDocument(
          mainContentFile,
          `${trimmedData.path}`
        );
      } else {
        trimmedData.mainContent = await cloudinaryService.uploadImage(
          mainContentFile,
          `${trimmedData.path}`
        );
      }
    } else if (mainContentText) {
      trimmedData.mainContent = mainContentText;
    }

    const newLesson = await lessonRepository.createLesson({
      ...trimmedData,
      files: trimmedData.files,
      mainContent: trimmedData.mainContent,
      author: user.id,
    });

    await moduleRepository.updateModule(
      { _id: moduleId },
      {
        $push: {
          lessons: newLesson._id,
        },
      }
    );

    const sectionSearchResult = await sectionRepository.searchSection({
      query: { modules: module._id },
      options: {
        select: "_id instructor students name code",
        populateArray: [
          { path: "instructor", select: "_id firstName lastName" },
          { path: "students", select: "_id firstName lastName" },
        ],
        lean: true,
        limit: 1,
      },
    });
    const section = Array.isArray(sectionSearchResult) ? sectionSearchResult[0] : undefined;

    return { newLesson, section };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function updateLesson(
  data: Partial<ILesson> & {
    path?: string;
    moduleId?: string;
    mainContentText?: string;
  },
  files?: { [fieldname: string]: Express.Multer.File[] }
): Promise<ILesson | null> {
  if (!data) {
    throw new Error(config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.UPDATE);
  }

  const extractPublicId = (url: string) => {
    const regex = /\/upload\/v\d+\/(.+)\.\w+$/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  try {
    const { mainContentText, ...restData } = data;
    const currentLesson = await lessonService.getLesson(data._id, {
      select: ["files", "mainContent"],
    });

    const module = await moduleService.getModule(data.moduleId ?? "", { select: ["title"] });

    if (!module) {
      throw new Error("Module not found");
    }
    if (files?.["files"]) {
      const currentFiles = currentLesson?.files
        ? Array.isArray(currentLesson.files)
          ? currentLesson.files
          : [currentLesson.files]
        : [];
      for (const fileUrl of currentFiles) {
        const publicId = extractPublicId(fileUrl);
        if (publicId) {
          await cloudinaryService.deleteImage(publicId);
        }
      }
      restData.files = await cloudinaryService.multipleUploadFile(files["files"], restData.path);
    }

    if (files?.["mainContent"] && files["mainContent"].length > 0) {
      if (currentLesson?.mainContent && currentLesson.mainContent.startsWith("http")) {
        const publicId = extractPublicId(currentLesson.mainContent);
        if (publicId) {
          await cloudinaryService.deleteImage(publicId);
        }
      }

      const mainContentFile = files["mainContent"][0];
      const fileExtension = mainContentFile.originalname.split(".").pop()?.toLowerCase() || "";

      if (fileExtension === "pdf") {
        restData.mainContent = await cloudinaryService.uploadPdf(mainContentFile, restData.path);
      } else if (["doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"].includes(fileExtension)) {
        restData.mainContent = await cloudinaryService.uploadDocument(
          mainContentFile,
          restData.path
        );
      } else {
        restData.mainContent = await cloudinaryService.uploadImage(mainContentFile, restData.path);
      }
    } else if (mainContentText) {
      if (currentLesson?.mainContent && currentLesson.mainContent.startsWith("http")) {
        const publicId = extractPublicId(currentLesson.mainContent);
        if (publicId) {
          await cloudinaryService.deleteImage(publicId);
        }
      }
      restData.mainContent = mainContentText;
    }

    return await lessonRepository.updateLesson(restData);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

async function deleteLesson(id: string): Promise<ILesson | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.REMOVE);
  }

  try {
    return await lessonRepository.archiveLesson(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function searchLesson(params: any): Promise<any> {
  try {
    const dbParams: {
      query: any;
      populateArray: any[];
      options: any;
      lean: boolean;
      match: any;
      includeArchived?: boolean | string;
      archivedOnly?: boolean;
      pagination?: boolean;
      document?: boolean;
    } = {
      query: {},
      populateArray: [],
      options: {},
      lean: true,
      match: {},
      includeArchived: params.includeArchived,
      archivedOnly: params.archivedOnly,
    };

    dbParams.query = params.query || {};

    if (params.archivedOnly === true) {
      dbParams.query["archive.status"] = true;
      dbParams.includeArchived = true;
    }

    if (params.match) {
      dbParams.query = { ...dbParams.query, ...params.match };
    }

    if (params.populateArray) {
      dbParams["populateArray"] = params.populateArray;
    }

    const optionsObj = {
      sort: params.sort || "-createdAt",
      skip: params.skip * params.limit || 0,
      select: params.select || "_id",
      limit: params.limit || 10,
    };

    dbParams.options = optionsObj;
    dbParams.lean = params.lean ?? true;

    const skip = params.skip || 0;
    const [lessons, count] = await Promise.all([
      lessonRepository.searchLesson(dbParams),
      params.pagination || params.count
        ? lessonRepository.lessonsCount(dbParams.query)
        : Promise.resolve(0),
    ]);

    if (!params.pagination) {
      return params.count ? { lessons, count } : lessons;
    }

    const pagination = generatePagination(count, skip + 1, optionsObj.limit);
    return {
      ...(params.document && { lessons }),
      ...(params.pagination && { pagination }),
      ...(params.count && { count }),
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function archiveLesson(id: string): Promise<ILesson | null> {
  if (!id) {
    throw new Error("Invalid lesson ID");
  }

  try {
    const lesson = await lessonRepository.getLesson(id, {});
    if (!lesson) {
      return null;
    }

    return await lessonRepository.archiveLesson(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function updateLessonProgress(
  lessonId: string,
  userId: string,
  data: { status: "completed" | "in-progress" | "not-started" }
): Promise<ILesson | null> {
  if (!lessonId || !userId) {
    throw new Error(config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.UPDATE);
  }

  try {
    return await lessonRepository.updateLessonProgress(lessonId, userId, data);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}
