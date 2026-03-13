import { FilterQuery, UpdateQuery } from "mongoose";
import Faculty, { IFaculty } from "../models/facultyModel";

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

const facultyRepository = {
  getFaculty,
  getFaculties,
  createFaculty,
  updateFaculty,
  deleteFaculty,
  searchFaculty,
  searchAndUpdate,
  facultyCount,
  findOrCreate,
  bulkCreate,
  insertMany,
};

export default facultyRepository;

function getFaculty(id: string, dbParams: DbParams = {}): Promise<IFaculty | null> {
  let query = Faculty.findById(id);

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

function getFaculties(dbParams: DbParams): Promise<IFaculty[]> {
  let query = Faculty.find(dbParams.query);

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

function createFaculty(data: Partial<IFaculty>): Promise<IFaculty> {
  return Faculty.create(data);
}

function updateFaculty(data: Partial<IFaculty>): Promise<IFaculty | null> {
  return Faculty.findByIdAndUpdate(data._id, { $set: data }, { new: true }).exec();
}

function deleteFaculty(id: string): Promise<IFaculty | null> {
  return Faculty.findByIdAndUpdate(
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

function searchFaculty(params: any = {}): Promise<IFaculty[]> {
  const query = Faculty.find();
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
  query: FilterQuery<IFaculty>,
  update?: UpdateQuery<IFaculty>,
  options?: { multi?: boolean }
): Promise<IFaculty | null | { modifiedCount: number }> {
  if (!update) {
    return Faculty.findOne(query);
  }

  if (options?.multi) {
    const result = await Faculty.updateMany(query, update);
    return { modifiedCount: result.modifiedCount };
  }

  return Faculty.findOneAndUpdate(query, update, { new: true }).exec();
}

function facultyCount(query: FilterQuery<IFaculty>): Promise<number> {
  return Faculty.countDocuments(query).exec();
}

function findOrCreate(query: FilterQuery<IFaculty>): Promise<IFaculty | null> {
  return Faculty.findOne(query).exec();
}

async function bulkCreate(data: Partial<IFaculty>[]): Promise<IFaculty[]> {
  return Faculty.insertMany(data, { ordered: true });
}

async function insertMany(data: Partial<IFaculty>[]): Promise<IFaculty[]> {
  return Faculty.insertMany(data, { ordered: false });
}
