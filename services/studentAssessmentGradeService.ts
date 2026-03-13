import { config } from "../config/common";
import { trimAll } from "../helper/commonHelper";
import { QueryCondition } from "../helper/types";
import { IStudentAssessmentGrade } from "../models/studentAssessmentGradeModel";
import studentAssessmentGradeRepository from "../repository/studentAssessmentGradeRepository";
import { generatePagination } from "../utils/paginationUtils";

const studentAssessmentGradeService = {
  getStudentAssessmentGrade,
  getStudentAssessmentGrades,
  createStudentAssessmentGrade,
  updateStudentAssessmentGrade,
  deleteStudentAssessmentGrade,
  searchStudentAssessmentGrade,
  archiveStudentAssessmentGrade,
};

export default studentAssessmentGradeService;

async function getStudentAssessmentGrade(
  id: string,
  params: any
): Promise<IStudentAssessmentGrade | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.STUDENT_ASSESSMENT_GRADE.INVALID_PARAMETER.GET);
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

    return await studentAssessmentGradeRepository.getStudentAssessmentGrade(id, dbParams);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getStudentAssessmentGrades(params: any): Promise<{
  studentAssessmentGrades: IStudentAssessmentGrade[];
  pagination: any;
  count?: number;
}> {
  if (!params) {
    throw new Error(config.RESPONSE.ERROR.STUDENT_ASSESSMENT_GRADE.INVALID_PARAMETER.GET_ALL);
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
      return { studentAssessmentGrades: [], pagination: {} };
    }

    if (params.query.sectionId) {
      dbParams.query.sectionId = params.query.sectionId;
    }
    if (params.query.assessmentId) {
      dbParams.query.assessmentId = params.query.assessmentId;
    }
    if (params.query.studentId) {
      dbParams.query.studentId = params.query.studentId;
    }

    const page = params.page || 1;

    const [studentAssessmentGrades, count] = await Promise.all([
      studentAssessmentGradeRepository.getStudentAssessmentGrades(dbParams),
      studentAssessmentGradeRepository.getStudentAssessmentGradesCount(dbParams.query),
    ]);

    const pagination = generatePagination(count, page, limit);

    return {
      ...(params.document && { studentAssessmentGrades }),
      ...(params.pagination && { pagination }),
      ...(params.count && { count }),
    } as {
      studentAssessmentGrades: IStudentAssessmentGrade[];
      pagination: any;
      count?: number;
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function createStudentAssessmentGrade(
  data: Partial<IStudentAssessmentGrade>,
  user?: any
): Promise<IStudentAssessmentGrade> {
  if (!data) {
    throw new Error(config.RESPONSE.ERROR.STUDENT_ASSESSMENT_GRADE.INVALID_PARAMETER.CREATE);
  }

  try {
    const trimmedData = trimAll(data);

    const { doc: existing, created } = await studentAssessmentGradeRepository.findOrCreate({
      studentId: trimmedData.studentId,
      assessmentId: trimmedData.assessmentId,
    });

    if (!created) {
      throw new Error(config.RESPONSE.ERROR.STUDENT_ASSESSMENT_GRADE.DUPLICATE);
    }

    const score = trimmedData.score ?? 0;
    const totalPoints = trimmedData.totalPoints ?? 0;
    const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 10000) / 100 : 0;

    const newGrade = await studentAssessmentGradeRepository.createStudentAssessmentGrade({
      ...trimmedData,
      organizationId: user?.organizationId,
      percentage,
    });

    return newGrade;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function updateStudentAssessmentGrade(
  data: Partial<IStudentAssessmentGrade>
): Promise<IStudentAssessmentGrade | null> {
  if (!data) {
    throw new Error(config.RESPONSE.ERROR.STUDENT_ASSESSMENT_GRADE.INVALID_PARAMETER.UPDATE);
  }

  try {
    if (data.score !== undefined && data.totalPoints !== undefined) {
      const totalPoints = data.totalPoints ?? 0;
      data.percentage = totalPoints > 0 ? Math.round((data.score / totalPoints) * 10000) / 100 : 0;
    }

    return await studentAssessmentGradeRepository.updateStudentAssessmentGrade(data);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function deleteStudentAssessmentGrade(id: string): Promise<IStudentAssessmentGrade | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.STUDENT_ASSESSMENT_GRADE.INVALID_PARAMETER.REMOVE);
  }

  try {
    return await studentAssessmentGradeRepository.archiveStudentAssessmentGrade(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function searchStudentAssessmentGrade(params: any): Promise<any> {
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
    const [studentAssessmentGrades, count] = await Promise.all([
      studentAssessmentGradeRepository.searchStudentAssessmentGrade(dbParams),
      params.pagination || params.count
        ? studentAssessmentGradeRepository.getStudentAssessmentGradesCount(dbParams.query)
        : Promise.resolve(0),
    ]);

    if (!params.pagination) {
      return params.count ? { studentAssessmentGrades, count } : studentAssessmentGrades;
    }

    const pagination = generatePagination(count, skip + 1, optionsObj.limit);
    return {
      ...(params.document && { studentAssessmentGrades }),
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

async function archiveStudentAssessmentGrade(id: string): Promise<IStudentAssessmentGrade | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.STUDENT_ASSESSMENT_GRADE.INVALID_PARAMETER.REMOVE);
  }

  try {
    return await studentAssessmentGradeRepository.archiveStudentAssessmentGrade(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}
