import { FilterQuery, UpdateQuery } from "mongoose";
import Grade, { IGrade } from "../models/gradeModel";
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

const gradingRepository = {
  getGrading,
  getGradings,
  createGrading,
  updateGrading,
  deleteGrading,
  searchGrading,
  searchAndUpdate,
  findOrCreate,
  getGradingsCount,
  archiveGrade,
};

export default gradingRepository;

function getGrading(id: string, dbParams: DbParams = {}): Promise<IGrade | null> {
  let query = Grade.findById(id);

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

function getGradings(dbParams: DbParams): Promise<IGrade[]> {
  let query = Grade.find(dbParams.query);

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

function createGrading(data: Partial<IGrade>): Promise<IGrade> {
  return Grade.create(data);
}

function updateGrading(data: Partial<IGrade>): Promise<IGrade | null> {
  return Grade.findByIdAndUpdate(data._id, { $set: data }, { new: true });
}

function deleteGrading(id: string): Promise<IGrade | null> {
  return Grade.findByIdAndDelete(id);
}

function searchGrading(params: any = {}): Promise<IGrade[]> {
  const query = Grade.find();
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
  query: FilterQuery<IGrade>,
  update?: UpdateQuery<IGrade>,
  options?: { multi?: boolean }
): Promise<IGrade | null | { modifiedCount: number }> {
  if (!update) {
    return Grade.findOne(query);
  }

  if (options?.multi) {
    const result = await Grade.updateMany(query, update);
    return { modifiedCount: result.modifiedCount };
  }

  return Grade.findOneAndUpdate(query, update, { new: true });
}

async function findOrCreate(query: any): Promise<IGrade | null> {
  return await Grade.findOne(query).lean();
}

async function getGradingsCount(query: any): Promise<number> {
  return await Grade.countDocuments(query);
}

function archiveGrade(id: string): Promise<IGrade | null> {
  return Grade.findByIdAndUpdate(
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
