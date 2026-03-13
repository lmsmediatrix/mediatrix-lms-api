import { config, COURSE_LEVEL } from "../config/common";
import { QueryCondition } from "../helper/types";
import { ICourse } from "../models/courseModel";
import courseRepository from "../repository/courseRepository";
import organizationRepository from "../repository/organizationRepository";
import { generatePagination } from "../utils/paginationUtils";
import { processBulkWriteErrors } from "../utils/csvUtils/csvUtils";
import cloudinaryService from "./cloudinaryService";
import { arrayToCSV } from "../utils/csvUtils/csvWriter";
import { flattenObject, prettifyHeader } from "../utils/csvUtils/csvResponse";

const courseService = {
  getCourse,
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  searchCourse,
  archiveCourse,
  bulkCreateCourses,
  exportCourse,
};

export default courseService;

async function getCourse(id: string, params: any): Promise<ICourse | null> {
  if (!id) {
    throw new Error(config.ERROR.USER.NO_ID);
  }

  try {
    const dbParams: any = { query: {}, options: {} };
    if (params.populateArray) {
      dbParams.options.populateArray = params.populateArray.map((item: any) => {
        if (typeof item === "string") {
          const [path, select] = item.split(":");
          return select ? { path, select: select.split(",").join(" ") } : { path };
        }
        return item;
      });
    }

    if (params.queryArray) {
      const queryArrayObj: { [key: string]: any } = {};
      queryArrayObj[params.queryArrayType] = params.queryArray;
      dbParams.query = { ...dbParams.query, ...queryArrayObj };
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
    if (params.query && params.query.organizationId) {
      dbParams.query.organizationId = params.query.organizationId;
    } else {
      return null;
    }

    return await courseRepository.getCourse(id, dbParams);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getCourses(
  params: any
): Promise<{ courses: ICourse[]; pagination: any; count?: number }> {
  if (!params) {
    throw new Error(config.RESPONSE.ERROR.USER.INVALID_PARAMETER.GET_ALL);
  }

  try {
    const dbParams: any = { query: {}, options: {} };

    if (
      params.queryArray &&
      params.queryArray.length > 0 &&
      params.queryArrayType &&
      params.queryArrayType.length > 0
    ) {
      const queryArray = Array.isArray(params.queryArray) ? params.queryArray : [params.queryArray];
      const queryArrayType = Array.isArray(params.queryArrayType)
        ? params.queryArrayType
        : [params.queryArrayType];

      const queryConditions: QueryCondition[] = queryArrayType.map((type: string | number) => {
        const trimmedType = String(type).trim();
        return { [trimmedType]: { $in: queryArray } };
      });

      queryConditions.forEach((condition) => {
        dbParams.query = { ...dbParams.query, ...condition };
      });
    }

    if (params.populateArray) {
      dbParams.options.populateArray = params.populateArray;
    }

    if (params.sort) {
      dbParams.options.sort = params.sort;
    }
    if (params.limit) {
      dbParams.options.limit = params.limit;
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

    if (params.query && params.query.organizationId) {
      dbParams.query.organizationId = params.query.organizationId;
    } else {
      return { courses: [], pagination: {} };
    }

    const page = params.page || 1;

    const [courses, count] = await Promise.all([
      courseRepository.getCourses(dbParams),
      courseRepository.getCoursesCount(dbParams.query),
    ]);

    const pagination = generatePagination(count, page, limit);

    return {
      ...(params.document && { courses }),
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
async function createCourse(
  data: Partial<ICourse> & {
    path?: string;
  },
  files?: { [fieldname: string]: Express.Multer.File[] },
  user?: any
): Promise<ICourse> {
  const { ...courseData } = data;

  if (files && files["thumbnail"]) {
    data.thumbnail = data.thumbnail || "";
    data.thumbnail = await cloudinaryService.uploadImage(files["thumbnail"][0], `${data.path}`);
  }
  const course = await courseRepository.createCourse({
    ...courseData,
    thumbnail: data.thumbnail,
    organizationId: user?.organizationId,
  });

  await organizationRepository.updateOrganization({
    _id: user?.organizationId,
    $push: { courses: course._id },
  });
  return course;
}

async function updateCourse(
  data: Partial<ICourse> & {
    path?: string;
  },
  files?: { [fieldname: string]: Express.Multer.File[] }
): Promise<ICourse | null> {
  if (!data) {
    throw new Error(config.RESPONSE.ERROR.COURSE.INVALID_PARAMETER.UPDATE);
  }
  const extractPublicId = (url: string) => {
    const regex = /\/upload\/v\d+\/(.+)\.\w+$/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };
  try {
    const currentCourse = await courseService.getCourse(data._id, {
      select: ["thumbnail"],
    });
    if (files?.["thumbnail"]) {
      if (currentCourse?.thumbnail) {
        const logoPublicId = extractPublicId(currentCourse.thumbnail);
        if (logoPublicId) {
          await cloudinaryService.deleteImage(logoPublicId);
        }
      }
      data.thumbnail = typeof data.thumbnail === "string" ? data.thumbnail : undefined;
      data.thumbnail = await cloudinaryService.uploadImage(files["thumbnail"][0], `${data.path}`);
    }
    return await courseRepository.updateCourse(data);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function deleteCourse(id: string): Promise<ICourse | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.COURSE.INVALID_PARAMETER.REMOVE);
  }

  try {
    return await courseRepository.archiveCourse(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function searchCourse(params: any): Promise<any> {
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
    const [courses, count] = await Promise.all([
      courseRepository.searchCourse(dbParams),
      params.pagination || params.count
        ? courseRepository.getCoursesCount(dbParams.query)
        : Promise.resolve(0),
    ]);

    if (!params.pagination) {
      return params.count ? { courses, count } : courses;
    }

    const pagination = generatePagination(count, skip + 1, optionsObj.limit);
    return {
      ...(params.document && { courses }),
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

async function archiveCourse(id: string): Promise<ICourse | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.COURSE.INVALID_PARAMETER.REMOVE);
  }

  try {
    const course = await courseRepository.getCourse(id, {});
    if (!course) {
      return null;
    }

    return await courseRepository.archiveCourse(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function bulkCreateCourses(data: { organizationId: string; csvData?: any[] }): Promise<{
  successCount: number;
  successList: Array<{ _id: string; code: string; title: string }>;
  errorCount: number;
  errorList: Array<{ errorMessage: string; errorCode: number; row?: number }>;
}> {
  const isCSVImport = data.csvData && Array.isArray(data.csvData) && data.csvData.length > 0;
  const successList: Array<{ _id: string; code: string; title: string }> = [];
  const errorList: Array<{ errorMessage: string; errorCode: number; row?: number }> = [];

  if (!isCSVImport) {
    throw new Error("CSV data is required for bulk course creation");
  }

  try {
    let courseDocuments: any[] = [];
    if (isCSVImport) {
      courseDocuments = data
        .csvData!.map((row, index) => {
          try {
            if (!row.title) {
              errorList.push({
                errorMessage: "Course title is required",
                errorCode: 400,
                row: index + 1,
              });
              return null;
            }

            if (!row.code || row.code.length < 3) {
              errorList.push({
                errorMessage: "Course code must be at least 3 characters",
                errorCode: 400,
                row: index + 1,
              });
              return null;
            }

            if (!row.description) {
              errorList.push({
                errorMessage: "Course description is required",
                errorCode: 400,
                row: index + 1,
              });
              return null;
            }

            if (!row.category) {
              errorList.push({
                errorMessage: "Course category is required",
                errorCode: 400,
                row: index + 1,
              });
              return null;
            }

            if (!row.level || !COURSE_LEVEL.includes(row.level)) {
              errorList.push({
                errorMessage: `Course level must be one of: ${COURSE_LEVEL.join(", ")}`,
                errorCode: 400,
                row: index + 1,
              });
              return null;
            }

            return {
              title: row.title,
              code: row.code,
              description: row.description,
              category: row.category,
              level: row.level,
              language: row.language || "English",
              timezone: row.timezone || "UTC",
              organizationId: data.organizationId,
              status: row.status || "draft",
              isPublished: row.isPublished === "true" || false,
            };
          } catch (error) {
            errorList.push({
              errorMessage: error instanceof Error ? error.message : "Invalid data in CSV row",
              errorCode: 400,
              row: index + 1,
            });
            return null;
          }
        })
        .filter(Boolean);
    }

    if (courseDocuments.length === 0) {
      return { successCount: 0, successList, errorCount: errorList.length, errorList };
    }

    try {
      const result = await courseRepository.insertMany(courseDocuments);

      result.forEach((course: any) => {
        successList.push({
          _id: course._id.toString(),
          code: course.code,
          title: course.title,
        });
      });
    } catch (bulkError: any) {
      if (bulkError.name === "MongoBulkWriteError") {
        if (bulkError.insertedDocs && Array.isArray(bulkError.insertedDocs)) {
          bulkError.insertedDocs.forEach((doc: any) => {
            if (doc && doc._id) {
              successList.push({
                _id: doc._id.toString(),
                code: doc.code,
                title: doc.title,
              });
            }
          });
        }
        const processedErrors = processBulkWriteErrors(bulkError);
        processedErrors.forEach((error) => {
          if (error.row !== undefined) {
            error.row += 1;
          }
        });
        errorList.push(...processedErrors);
      } else {
        errorList.push({
          errorMessage: bulkError.message || "Unknown error occurred",
          errorCode: bulkError.code || 500,
        });
      }
    }
  } catch (error: any) {
    errorList.push({
      errorMessage: error.message || "Unknown error occurred",
      errorCode: error.code || 500,
    });
  }

  return {
    successCount: successList.length,
    successList,
    errorCount: errorList.length,
    errorList,
  };
}

async function exportCourse(params: any, organizationId: string): Promise<string> {
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
      query: { organizationId, ...(params.query || {}) },
      populateArray: [],
      options: {},
      lean: true,
      match: {},
      includeArchived: false,
      archivedOnly: false,
    };
    if (params.match) {
      dbParams.query = { ...dbParams.query, ...params.match };
    }

    if (params.populateArray) {
      dbParams.populateArray = params.populateArray;
    }

    const optionsObj = {
      sort: params.sort || "-createdAt",
      skip: params.skip * params.limit || 0,
      select: params.select,
      populate: params.populate,
      limit: params.limit || 10,
    };

    dbParams.options = optionsObj;
    dbParams.lean = params.lean ?? true;

    const courses = await courseRepository.searchCourse(dbParams);
    const flatCourses = courses.map((course: any) => flattenObject(course));

    const allKeys = Array.from(
      flatCourses.reduce((keys, obj) => {
        Object.keys(obj).forEach((key) => keys.add(key));
        return keys;
      }, new Set<string>())
    ) as string[];
    const filteredKeys = allKeys.filter((key) => !key.endsWith("_id") && key !== "_id");
    const prettyHeaders = filteredKeys.map(prettifyHeader);

    const csvData = flatCourses.map((obj) => {
      const row: { [key: string]: string } = {};
      filteredKeys.forEach((key) => {
        if (
          (key.toLowerCase().includes("date") ||
            key.toLowerCase().includes("createdate") ||
            key.toLowerCase().includes("updatedate")) &&
          obj[key]
        ) {
          row[key] = new Date(obj[key]).toISOString().split("T")[0];
        } else {
          row[key] = obj[key] !== undefined ? String(obj[key]) : "";
        }
      });
      return row;
    });

    const csvRaw = arrayToCSV(csvData, filteredKeys);
    const lines = csvRaw.split("\n");
    lines[0] = prettyHeaders.join(",");
    return lines.join("\n");
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}
