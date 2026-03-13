import { FilterQuery, UpdateQuery } from "mongoose";
import Lesson, { ILesson } from "../models/lessonModel";
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

const lessonRepository = {
  getLesson,
  getLessons,
  createLesson,
  updateLesson,
  deleteLesson,
  searchLesson,
  searchAndUpdate,
  findOrCreate,
  lessonsCount,
  archiveLesson,
  updateLessonProgress,
};

export default lessonRepository;

function getLesson(id: string, dbParams: DbParams = {}): Promise<ILesson | null> {
  let query = Lesson.findById(id);

  if (!dbParams.query) {
    dbParams.query = {};
  }

  if (dbParams.query.includeArchived !== true) {
    query = query.where("archive.status").ne(true);

    (dbParams.options?.populateArray || []).forEach((populate) => {
      if (typeof populate === "string") {
        query.populate({
          path: populate,
          match: { "archive.status": { $ne: true } },
        });
      } else {
        query.populate({
          path: populate.path,
          select: populate.select,
          match: { "archive.status": { $ne: true } },
        });
      }
    });
  } else {
    (dbParams.options?.populateArray || []).forEach((populate) => {
      query = query.populate(populate);
    });
  }

  const options = {
    select: dbParams.options?.select || "_id",
    lean: dbParams.options?.lean || true,
  };

  query = query.select(options.select).lean(options.lean);

  return query.exec();
}

function getLessons(dbParams: DbParams): Promise<ILesson[]> {
  let query = Lesson.find(dbParams.query);

  if (!dbParams.query) {
    dbParams.query = {};
  }

  if (dbParams.query.includeArchived !== true) {
    query = query.where("archive.status").ne(true);

    (dbParams.options?.populateArray || []).forEach((populate) => {
      if (typeof populate === "string") {
        query.populate({
          path: populate,
          match: { "archive.status": { $ne: true } },
        });
      } else {
        query.populate({
          path: populate.path,
          select: populate.select,
          match: { "archive.status": { $ne: true } },
        });
      }
    });
  } else {
    (dbParams.options?.populateArray || []).forEach((populate) => {
      query = query.populate(populate);
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

  return query.exec();
}

function createLesson(data: Partial<ILesson>): Promise<ILesson> {
  return Lesson.create(data);
}

function updateLesson(data: Partial<ILesson>): Promise<ILesson | null> {
  return Lesson.findByIdAndUpdate(data._id, { $set: data }, { new: true });
}

function deleteLesson(id: string): Promise<ILesson | null> {
  return Lesson.findByIdAndDelete(id);
}

function searchLesson(params: any = {}): Promise<ILesson[]> {
  const query = Lesson.find();
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
  query: FilterQuery<ILesson>,
  update?: UpdateQuery<ILesson>,
  options?: { multi?: boolean }
): Promise<ILesson | null | { modifiedCount: number }> {
  if (!update) {
    return Lesson.findOne(query);
  }

  if (options?.multi) {
    const result = await Lesson.updateMany(query, update);
    return { modifiedCount: result.modifiedCount };
  }

  return Lesson.findOneAndUpdate(query, update, { new: true });
}

async function findOrCreate(query: any): Promise<ILesson | null> {
  return await Lesson.findOne(query).lean();
}

async function lessonsCount(query: any): Promise<number> {
  return Lesson.countDocuments(query).exec();
}

function archiveLesson(id: string): Promise<ILesson | null> {
  return Lesson.findByIdAndUpdate(
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

async function updateLessonProgress(
  lessonId: string,
  userId: string,
  data: { status: "completed" | "in-progress" | "not-started" }
): Promise<ILesson | null> {
  // Try to update existing progress entry for this user
  const result = await Lesson.findOneAndUpdate(
    { _id: lessonId, "progress.userId": userId },
    { $set: { "progress.$.status": data.status } },
    { new: true }
  );

  if (result) return result;

  // No existing entry — push a new one
  return Lesson.findByIdAndUpdate(
    lessonId,
    { $push: { progress: { userId, status: data.status } } },
    { new: true }
  );
}
