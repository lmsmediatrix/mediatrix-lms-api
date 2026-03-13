import { FilterQuery, UpdateQuery } from "mongoose";
import Attendance, { IAttendance } from "../models/attendanceModel";
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

const attendanceRepository = {
  getAttendance,
  getAttendances,
  createAttendance,
  updateAttendance,
  deleteAttendance,
  searchAttendance,
  searchAndUpdate,
  findOrCreate,
  attendanceCount,
  getStudentAttendance,
};

export default attendanceRepository;

function getAttendance(id: string, dbParams: DbParams = {}): Promise<IAttendance | null> {
  let query = Attendance.findById(id);

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

function getAttendances(dbParams: DbParams): Promise<IAttendance[]> {
  let query = Attendance.find(dbParams.query);

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

function attendanceCount(query: any): Promise<number> {
  return Attendance.countDocuments(query).exec();
}

function createAttendance(data: Partial<IAttendance>): Promise<IAttendance> {
  return Attendance.create(data);
}

function updateAttendance(
  data: { _id: string } & Partial<Omit<IAttendance, "_id">>
): Promise<IAttendance | null> {
  return Attendance.findByIdAndUpdate(data._id, { $set: data }, { new: true });
}

function deleteAttendance(id: string): Promise<IAttendance | null> {
  return Attendance.findByIdAndDelete(id);
}

function searchAttendance(params: any = {}): Promise<IAttendance[]> {
  const query = Attendance.find();
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
  query: FilterQuery<IAttendance>,
  update?: UpdateQuery<IAttendance>,
  options?: { multi?: boolean }
): Promise<IAttendance | null | { modifiedCount: number }> {
  if (!update) {
    return Attendance.findOne(query);
  }

  if (options?.multi) {
    const result = await Attendance.updateMany(query, update);
    return { modifiedCount: result.modifiedCount };
  }

  return Attendance.findOneAndUpdate(query, update, { new: true });
}

async function findOrCreate(query: any): Promise<IAttendance | null> {
  return await Attendance.findOne(query).lean();
}

async function getStudentAttendance(dbParams: DbParams, studentId: string): Promise<IAttendance[]> {
  let query = Attendance.find({ userId: studentId, ...dbParams.query });

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
