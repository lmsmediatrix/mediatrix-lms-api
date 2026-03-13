import { FilterQuery, UpdateQuery } from "mongoose";
import Assessment, { IAssessment } from "../models/assessmentModel";
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

const assessmentRepository = {
  getAssessment,
  getAssessments,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  searchAssessment,
  searchAndUpdate,
  findOrCreate,
  assessmentCount,
  archiveAssessment,
};

export default assessmentRepository;

function getAssessment(id: string, dbParams: DbParams = {}): Promise<IAssessment | null> {
  let query = Assessment.findById(id);

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

function getAssessments(dbParams: DbParams): Promise<IAssessment[]> {
  let query = Assessment.find(dbParams.query || {});

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

function createAssessment(data: Partial<IAssessment>): Promise<IAssessment> {
  return Assessment.create(data);
}

async function updateAssessment(
  filter: FilterQuery<IAssessment>,
  update: UpdateQuery<IAssessment>
): Promise<IAssessment | null> {
  return await Assessment.findOneAndUpdate(filter, update, {
    new: true,
    runValidators: true,
    strict: true,
  }).exec();
}

function deleteAssessment(id: string): Promise<IAssessment | null> {
  return Assessment.findByIdAndDelete(id);
}

function searchAssessment(params: any = {}): Promise<IAssessment[]> {
  const query = Assessment.find();
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
  query: FilterQuery<IAssessment>,
  update?: UpdateQuery<IAssessment>,
  options?: { multi?: boolean }
): Promise<IAssessment | null | { modifiedCount: number }> {
  if (!update) {
    return Assessment.findOne(query);
  }

  if (options?.multi) {
    const result = await Assessment.updateMany(query, update);
    return { modifiedCount: result.modifiedCount };
  }

  return Assessment.findOneAndUpdate(query, update, { new: true });
}

async function findOrCreate(query: any): Promise<IAssessment | null> {
  return await Assessment.findOne(query).lean();
}

async function assessmentCount(query: FilterQuery<IAssessment>): Promise<number> {
  return await Assessment.countDocuments(query).exec();
}

function archiveAssessment(id: string): Promise<IAssessment | null> {
  return Assessment.findByIdAndUpdate(
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
