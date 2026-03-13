import { config } from "../config/common";
import { QueryCondition } from "../helper/types";
import { IAuditLog } from "../models/auditLogModel";
import auditLogRepository from "../repository/auditLogRepository";
import { generatePagination } from "../utils/paginationUtils";
import { populateAuditLogEntities } from "../utils/auditLogPopulate";

const auditLogService = {
  getAuditLog,
  getAuditLogs,
  createAuditLog,
  updateAuditLog,
  deleteAuditLog,
  searchAuditLog,
};

export default auditLogService;

async function getAuditLog(id: string, params: any): Promise<IAuditLog | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.AUDIT_LOG.INVALID_PARAMETER.GET);
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

    return await auditLogRepository.getAuditLog(id, dbParams);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getAuditLogs(
  params: any
): Promise<{ auditLogs: IAuditLog[]; pagination: any; count?: number }> {
  if (!params) {
    throw new Error(config.RESPONSE.ERROR.AUDIT_LOG.INVALID_PARAMETER.GET_ALL);
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

    const page = params.page || 1;

    const [auditLogs, count] = await Promise.all([
      auditLogRepository.getAuditLogs(dbParams),
      auditLogRepository.getAuditLogsCount(dbParams.query),
    ]);

    const pagination = generatePagination(count, page, limit);

    return {
      ...(params.document && { auditLogs }),
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

async function createAuditLog(auditLogData: Partial<IAuditLog>): Promise<IAuditLog> {
  if (!auditLogData) {
    throw new Error(config.RESPONSE.ERROR.AUDIT_LOG.INVALID_PARAMETER.CREATE);
  }

  try {
    return await auditLogRepository.createAuditLog(auditLogData);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function updateAuditLog(updateData: Partial<IAuditLog>): Promise<IAuditLog | null> {
  try {
    return await auditLogRepository.updateAuditLog(updateData);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function deleteAuditLog(id: string): Promise<IAuditLog | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.AUDIT_LOG.INVALID_PARAMETER.DELETE);
  }

  try {
    return await auditLogRepository.deleteAuditLog(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function searchAuditLog(params: any): Promise<any> {
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
    const [auditLogs, count] = await Promise.all([
      auditLogRepository.searchAuditLog(dbParams),
      params.pagination || params.count
        ? auditLogRepository.getAuditLogsCount(dbParams.query)
        : Promise.resolve(0),
    ]);

    // Always populate the entity field
    const populatedAuditLogs = await populateAuditLogEntities(auditLogs);

    if (!params.pagination) {
      return params.count ? { auditLogs: populatedAuditLogs, count } : populatedAuditLogs;
    }

    const pagination = generatePagination(count, skip + 1, optionsObj.limit);
    return {
      ...(params.document && { auditLogs: populatedAuditLogs }),
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
