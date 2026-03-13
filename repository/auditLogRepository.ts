import { FilterQuery, UpdateQuery } from "mongoose";
import { AuditLogModel, IAuditLog } from "../models/auditLogModel";

interface DbParams {
  query?: any;
  options?: {
    populateArray?: { path: string; select?: string }[];
    select?: string;
    lean?: boolean;
    sort?: any;
    limit?: number;
    skip?: number;
  };
}

const auditLogRepository = {
  getAuditLog,
  getAuditLogs,
  createAuditLog,
  updateAuditLog,
  deleteAuditLog,
  searchAuditLog,
  searchAndUpdate,
  getAuditLogsCount,
};

export default auditLogRepository;

function getAuditLog(id: string, dbParams: DbParams = {}): Promise<IAuditLog | null> {
  let query = AuditLogModel.findById(id);

  (dbParams.options?.populateArray || []).forEach((populate) => {
    query = query.populate(populate);
  });

  const options = {
    select: dbParams.options?.select || "_id",
    lean: dbParams.options?.lean || true,
  };

  query = query.select(options.select).lean(options.lean);

  return query.exec();
}

function getAuditLogs(dbParams: DbParams): Promise<IAuditLog[]> {
  let query = AuditLogModel.find(dbParams.query);

  (dbParams.options?.populateArray || []).forEach((populate) => {
    query = query.populate(populate);
  });

  const options = {
    sort: dbParams.options?.sort || {},
    limit: dbParams.options?.limit || 10,
    skip: dbParams.options?.skip || 0,
    select: dbParams.options?.select || "_id",
    lean: dbParams.options?.lean || true,
  };

  query = query
    .sort(options.sort)
    .skip(options.skip)
    .limit(options.limit)
    .select(options.select)
    .lean(options.lean);

  return query.exec();
}

function createAuditLog(data: Partial<IAuditLog>): Promise<IAuditLog> {
  return AuditLogModel.create(data);
}

function updateAuditLog(data: Partial<IAuditLog>): Promise<IAuditLog | null> {
  return AuditLogModel.findByIdAndUpdate(data._id, { $set: data }, { new: true }).exec();
}

function deleteAuditLog(id: string): Promise<IAuditLog | null> {
  return AuditLogModel.findByIdAndDelete(id).exec();
}

function searchAuditLog(params: any = {}): Promise<IAuditLog[]> {
  const query = AuditLogModel.find();
  query.setQuery(params.query);
  query.populate(params.populateArray);
  query.projection(params.projection);
  query.setOptions(params.options);
  query.lean(params.lean);

  if (params.match) {
    query.where(params.match);
  }
  return query.exec();
}

async function searchAndUpdate(
  query: FilterQuery<IAuditLog>,
  update?: UpdateQuery<IAuditLog>,
  options?: { multi?: boolean }
): Promise<IAuditLog | null | { modifiedCount: number }> {
  if (!update) {
    return AuditLogModel.findOne(query);
  }

  if (options?.multi) {
    const result = await AuditLogModel.updateMany(query, update);
    return { modifiedCount: result.modifiedCount };
  }

  return AuditLogModel.findOneAndUpdate(query, update, { new: true }).exec();
}

async function getAuditLogsCount(query: FilterQuery<IAuditLog>): Promise<number> {
  const count = await AuditLogModel.countDocuments(query).exec();
  return count;
}
