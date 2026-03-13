import { config } from "../config/common";
import { IActivityLogging } from "../models/activityLogModel";
import activityLogRepository from "../repository/activityLogRepository";
import { generatePagination } from "../utils/paginationUtils";

const activityLogService = {
  getActivityLog,
  getActivityLogs,
  createActivityLog,
  updateActivityLog,
  deleteActivityLog,
  searchActivityLog,
};

export default activityLogService;

async function getActivityLog(id: string, params: any): Promise<IActivityLogging | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.ACTIVITY_LOG.INVALID_PARAMETER.GET);
  }

  try {
    const dbParams: any = { query: {}, options: {} };

    if (params.populateArray) {
      dbParams.options.populateArray = params.populateArray;
    }

    if (params.select) {
      dbParams.options.select = Array.isArray(params.select)
        ? params.select.join(" ")
        : params.select;
    }

    if (params.lean !== undefined) {
      dbParams.options.lean = params.lean;
    }

    return await activityLogRepository.getActivityLog(id, dbParams);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getActivityLogs(
  params: any
): Promise<{ activityLogs: IActivityLogging[]; pagination: any; count?: number }> {
  if (!params) {
    throw new Error(config.RESPONSE.ERROR.ACTIVITY_LOG.INVALID_PARAMETER.GET_ALL);
  }

  try {
    const dbParams: any = { query: {}, options: {} };

    if (params.queryArray && params.queryArrayType) {
      const queryArray = Array.isArray(params.queryArray) ? params.queryArray : [params.queryArray];
      const queryArrayType = Array.isArray(params.queryArrayType)
        ? params.queryArrayType
        : [params.queryArrayType];

      const queryConditions = queryArrayType.map((type: string | number) => {
        const trimmedType = String(type).trim();
        return { [trimmedType]: { $in: queryArray } };
      });

      queryConditions.forEach((condition: any) => {
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
      dbParams.options.select = Array.isArray(params.select)
        ? params.select.join(" ")
        : params.select;
    }

    if (params.lean !== undefined) {
      dbParams.options.lean = params.lean;
    }
    const page = params.page || 1;
    const [activityLogs, count] = await Promise.all([
      activityLogRepository.getActivityLogs(dbParams),
      params.pagination || params.count
        ? activityLogRepository.activityLogCount(dbParams.query)
        : Promise.resolve(0),
    ]);

    const pagination = params.pagination ? generatePagination(count, page, limit) : undefined;

    return {
      ...(params.document && { activityLogs }),
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

async function createActivityLog(
  activityLogData: Partial<IActivityLogging>
): Promise<IActivityLogging> {
  if (!activityLogData) {
    throw new Error(config.RESPONSE.ERROR.ACTIVITY_LOG.INVALID_PARAMETER.CREATE);
  }

  try {
    return await activityLogRepository.createActivityLog(activityLogData);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function updateActivityLog(
  updateData: Partial<IActivityLogging>
): Promise<IActivityLogging | null> {
  try {
    return await activityLogRepository.updateActivityLog(updateData);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function deleteActivityLog(id: string): Promise<IActivityLogging | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.ACTIVITY_LOG.INVALID_PARAMETER.DELETE);
  }

  try {
    return await activityLogRepository.deleteActivityLog(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function searchActivityLog(params: any): Promise<any> {
  try {
    const dbParams = {
      query: {},
      populateArray: [],
      options: {},
      lean: true,
      match: {},
    };

    dbParams.query = params.query || {};

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
    const [activityLogs, count] = await Promise.all([
      activityLogRepository.searchActivityLog(dbParams),
      params.pagination || params.count
        ? activityLogRepository.activityLogCount(dbParams.query)
        : Promise.resolve(0),
    ]);

    if (!params.pagination) {
      return params.count ? { activityLogs, count } : activityLogs;
    }

    const pagination = generatePagination(count, skip + 1, optionsObj.limit);
    return {
      ...(params.document && { activityLogs }),
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
