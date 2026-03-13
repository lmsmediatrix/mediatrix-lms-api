import { FilterQuery, UpdateQuery } from "mongoose";
import ActivityLogging, { IActivityLogging } from "../models/activityLogModel";

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

const activityLogRepository = {
  getActivityLog,
  getActivityLogs,
  createActivityLog,
  updateActivityLog,
  deleteActivityLog,
  searchActivityLog,
  searchAndUpdate,
  activityLogCount,
};

export default activityLogRepository;

function getActivityLog(id: string, dbParams: DbParams = {}): Promise<IActivityLogging | null> {
  let query = ActivityLogging.findById(id);

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

function getActivityLogs(dbParams: DbParams): Promise<IActivityLogging[]> {
  let query = ActivityLogging.find(dbParams.query);

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

function createActivityLog(data: Partial<IActivityLogging>): Promise<IActivityLogging> {
  return ActivityLogging.create(data);
}

function updateActivityLog(data: Partial<IActivityLogging>): Promise<IActivityLogging | null> {
  return ActivityLogging.findByIdAndUpdate(data._id, { $set: data }, { new: true }).exec();
}

function deleteActivityLog(id: string): Promise<IActivityLogging | null> {
  return ActivityLogging.findByIdAndDelete(id).exec();
}

function searchActivityLog(params: any = {}): Promise<IActivityLogging[]> {
  const query = ActivityLogging.find();
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
  query: FilterQuery<IActivityLogging>,
  update?: UpdateQuery<IActivityLogging>,
  options?: { multi?: boolean }
): Promise<IActivityLogging | null | { modifiedCount: number }> {
  if (!update) {
    return ActivityLogging.findOne(query);
  }

  if (options?.multi) {
    const result = await ActivityLogging.updateMany(query, update);
    return { modifiedCount: result.modifiedCount };
  }

  return ActivityLogging.findOneAndUpdate(query, update, { new: true }).exec();
}

function activityLogCount(query: FilterQuery<IActivityLogging>): Promise<number> {
  return ActivityLogging.countDocuments(query).exec();
}
