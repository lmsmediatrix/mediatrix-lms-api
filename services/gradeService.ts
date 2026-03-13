import { config } from "../config/common";
import { trimAll } from "../helper/commonHelper";
import { QueryCondition } from "../helper/types";
import { IGrade } from "../models/gradeModel";
import gradeRepository from "../repository/gradeRepository";
import sectionRepository from "../repository/sectionRepository";
import { generatePagination } from "../utils/paginationUtils";
const gradeService = {
  getGrade,
  getGrades,
  createGrade,
  updateGrade,
  deleteGrade,
  searchGrade,
  archiveGrade,
};

export default gradeService;

async function getGrade(id: string, params: any): Promise<IGrade | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.GET);
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

    if (params.select) {
      if (!Array.isArray(params.select)) {
        params.select = [params.select];
      }
      dbParams.options.select = params.select.join(" ");
    }
    if (params.lean !== undefined) {
      dbParams.options.lean = params.lean;
    }

    return await gradeRepository.getGrading(id, dbParams);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getGrades(
  params: any
): Promise<{ grades: IGrade[]; pagination: any; count?: number }> {
  if (!params) {
    throw new Error(config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.GET_ALL);
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
      return { grades: [], pagination: {} };
    }

    const page = params.page || 1;

    const [grades, count] = await Promise.all([
      gradeRepository.getGradings(dbParams),
      gradeRepository.getGradingsCount(dbParams.query),
    ]);

    const pagination = generatePagination(count, page, limit);

    return {
      ...(params.document && { grades }),
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

async function createGrade(data: Partial<IGrade>, user?: any): Promise<IGrade> {
  if (!data) {
    throw new Error(config.ERROR.USER.REQUIRED_FIELDS);
  }

  try {
    const trimmedData = trimAll(data);

    const newGrade = await gradeRepository.createGrading({
      ...trimmedData,
      organizationId: user.organizationId,
    });
    await sectionRepository.updateSection(
      { _id: newGrade.sectionId },
      {
        $push: {
          grade: newGrade._id,
        },
      }
    );

    return newGrade;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function updateGrade(data: Partial<IGrade>): Promise<IGrade | null> {
  if (!data) {
    throw new Error(config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.UPDATE);
  }

  try {
    return await gradeRepository.updateGrading(data);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function deleteGrade(id: string): Promise<IGrade | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.REMOVE);
  }

  try {
    return await gradeRepository.archiveGrade(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function searchGrade(params: any): Promise<any> {
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
    const [grades, count] = await Promise.all([
      gradeRepository.searchGrading(dbParams),
      params.pagination || params.count
        ? gradeRepository.getGradingsCount(dbParams.query)
        : Promise.resolve(0),
    ]);

    if (!params.pagination) {
      return params.count ? { grades, count } : grades;
    }

    const pagination = generatePagination(count, skip + 1, optionsObj.limit);
    return {
      ...(params.document && { grades }),
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

async function archiveGrade(id: string): Promise<IGrade | null> {
  if (!id) {
    throw new Error("Invalid grade ID");
  }

  try {
    const grade = await gradeRepository.getGrading(id, {});
    if (!grade) {
      return null;
    }

    return await gradeRepository.archiveGrade(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}
