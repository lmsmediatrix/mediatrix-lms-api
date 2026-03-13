import { FilterQuery, UpdateQuery } from "mongoose";
import Program, { IProgram } from "../models/programModel";

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

const programRepository = {
  getProgram,
  getPrograms,
  createProgram,
  updateProgram,
  deleteProgram,
  searchProgram,
  searchAndUpdate,
  countPrograms,
  bulkCreate,
  findOrCreate,
  insertMany,
};

export default programRepository;

function getProgram(id: string, dbParams: DbParams = {}): Promise<IProgram | null> {
  let query = Program.findById(id);

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

function getPrograms(dbParams: DbParams): Promise<IProgram[]> {
  let query = Program.find(dbParams.query);

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

  if (dbParams.query?.organizationId) {
    query.where("organizationId").equals(dbParams.query.organizationId);
  }

  return query.exec();
}

function countPrograms(query: any): Promise<number> {
  return Program.countDocuments(query).exec();
}

async function createProgram(data: Partial<IProgram>): Promise<IProgram> {
  const program = await Program.create(data);
  return program;
}

function updateProgram(programId: string, data: Partial<IProgram>): Promise<IProgram | null> {
  return Program.findByIdAndUpdate(programId, { $set: data }, { new: true });
}

function deleteProgram(id: string): Promise<IProgram | null> {
  return Program.findByIdAndUpdate(
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

function searchProgram(params: any = {}): Promise<IProgram[]> {
  const query = Program.find();
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
  query: FilterQuery<IProgram>,
  update?: UpdateQuery<IProgram>,
  options?: { multi?: boolean }
): Promise<IProgram | null | { modifiedCount: number }> {
  if (!update) {
    return Program.findOne(query).populate("organizationId", "code");
  }

  if (options?.multi) {
    const result = await Program.updateMany(query, update);
    return { modifiedCount: result.modifiedCount };
  }

  return Program.findOneAndUpdate(query, update, { new: true });
}

async function bulkCreate(data: Partial<IProgram>[]): Promise<IProgram[]> {
  const programs = await Program.insertMany(data, { ordered: true });
  return programs;
}

async function findOrCreate(query: any): Promise<IProgram | null> {
  return Program.findOne(query);
}

async function insertMany(data: Partial<IProgram>[]): Promise<IProgram[]> {
  return Program.insertMany(data, { ordered: false });
}
