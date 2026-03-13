import { FilterQuery, UpdateQuery } from "mongoose";
import Course, { ICourse } from "../models/courseModel";
interface DbParams {
  query?: any;
  options?: {
    populateArray?: any[];
    select?: string;
    lean?: boolean;
    sort?: any;
    limit?: number;
    skip?: number;
  };
}

const courseRepository = {
  getCourse,
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  searchCourse,
  searchAndUpdate,
  findOrCreate,
  getCoursesCount,
  archiveCourse,
  insertMany,
};

export default courseRepository;

function getCourse(id: string, dbParams: DbParams = {}): Promise<ICourse | null> {
  let query = Course.findById(id);

  if (!dbParams.query) {
    dbParams.query = {};
  }

  if (dbParams.query.includeArchived !== true) {
    query = query.where("archive.status").ne(true);

    (dbParams.options?.populateArray || []).forEach((populateOption) => {
      if (typeof populateOption === "string") {
        query.populate({
          path: populateOption,
          match: { "archive.status": { $ne: true } },
        });
      } else {
        query.populate({
          path: populateOption.path,
          select: populateOption.select,
          match: { "archive.status": { $ne: true } },
        });
      }
    });
  } else {
    (dbParams.options?.populateArray || []).forEach((populateOption) => {
      query = query.populate(populateOption);
    });
  }

  const options = {
    select: dbParams.options?.select || "_id",
    lean: dbParams.options?.lean || true,
  };

  query = query.select(options.select).lean(options.lean);
  if (dbParams.query?.organizationId) {
    query.where("organizationId").equals(dbParams.query.organizationId);
  }

  return query.exec();
}

function getCourses(dbParams: DbParams): Promise<ICourse[]> {
  let query = Course.find(dbParams.query || {});

  if (!dbParams.query) {
    dbParams.query = {};
  }

  if (dbParams.query.includeArchived !== true) {
    query = query.where("archive.status").ne(true);

    (dbParams.options?.populateArray || []).forEach((populateOption) => {
      if (typeof populateOption === "string") {
        query.populate({
          path: populateOption,
          match: { "archive.status": { $ne: true } },
        });
      } else {
        query.populate({
          path: populateOption.path,
          select: populateOption.select,
          match: { "archive.status": { $ne: true } },
        });
      }
    });
  } else {
    (dbParams.options?.populateArray || []).forEach((populateOption) => {
      query = query.populate(populateOption);
    });
  }

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
  if (dbParams.query?.organizationId) {
    query.where("organizationId").equals(dbParams.query.organizationId);
  }

  return query.exec();
}

function getCoursesCount(query: any): Promise<number> {
  return Course.countDocuments(query).exec();
}
function createCourse(data: Partial<ICourse>): Promise<ICourse> {
  return Course.create(data);
}

function updateCourse(data: Partial<ICourse>): Promise<ICourse | null> {
  return Course.findByIdAndUpdate(data._id, { $set: data }, { new: true });
}

function deleteCourse(id: string): Promise<ICourse | null> {
  return Course.findByIdAndDelete(id);
}

function archiveCourse(id: string): Promise<ICourse | null> {
  return Course.findByIdAndUpdate(
    id,
    {
      $set: {
        "archive.status": true,
        "archive.date": new Date(),
      },
    },
    { new: true }
  );
}

function searchCourse(params: any = {}): Promise<ICourse[]> {
  const query = Course.find();
  query.setQuery(params.query);
  query.populate(params.populateArray);
  query.projection(params.projection);
  query.setOptions(params.options);
  query.lean(params.lean);
  if (!params.includeArchived) {
    query.where({ "archive.status": { $ne: true } });
  }

  if (params.match) {
    query.where(params.match);
  }
  return query.exec();
}

async function searchAndUpdate(
  query: FilterQuery<ICourse>,
  update?: UpdateQuery<ICourse>,
  options?: { multi?: boolean }
): Promise<ICourse | null | { modifiedCount: number }> {
  if (!update) {
    return Course.findOne(query);
  }

  if (options?.multi) {
    const result = await Course.updateMany(query, update);
    return { modifiedCount: result.modifiedCount };
  }

  return Course.findOneAndUpdate(query, update, { new: true });
}

async function findOrCreate(query: any): Promise<ICourse | null> {
  return await Course.findOne(query).lean();
}

async function insertMany(data: Partial<ICourse>[]): Promise<ICourse[]> {
  return await Course.insertMany(data, { ordered: false });
}
