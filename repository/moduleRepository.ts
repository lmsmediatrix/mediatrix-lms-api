import { FilterQuery, UpdateQuery } from "mongoose";
import Module, { IModule } from "../models/moduleModel";
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

const moduleRepository = {
  getModule,
  getModules,
  createModule,
  updateModule,
  deleteModule,
  searchModule,
  searchAndUpdate,
  findOrCreate,
  getModulesCount,
  bulkCreateModule,
  archiveModule,
};

export default moduleRepository;

function getModule(id: string, dbParams: DbParams = {}): Promise<IModule | null> {
  let query = Module.findById(id);

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

function getModules(dbParams: DbParams): Promise<IModule[]> {
  let query = Module.find(dbParams.query);

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

function getModulesCount(query: any): Promise<number> {
  return Module.countDocuments(query).exec();
}

function createModule(data: Partial<IModule>): Promise<IModule> {
  return Module.create(data);
}

async function updateModule(
  filter: FilterQuery<IModule>,
  update: UpdateQuery<IModule>
): Promise<IModule | null> {
  return await Module.findOneAndUpdate(filter, update, { new: true }).exec();
}

function deleteModule(id: string): Promise<IModule | null> {
  return Module.findByIdAndDelete(id);
}

function searchModule(params: any = {}): Promise<IModule[]> {
  const query = Module.find();
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
  query: FilterQuery<IModule>,
  update?: UpdateQuery<IModule>,
  options?: { multi?: boolean }
): Promise<IModule | null | { modifiedCount: number }> {
  if (!update) {
    return Module.findOne(query);
  }

  if (options?.multi) {
    const result = await Module.updateMany(query, update);
    return { modifiedCount: result.modifiedCount };
  }

  return Module.findOneAndUpdate(query, update, { new: true });
}

async function findOrCreate(query: any): Promise<IModule | null> {
  return await Module.findOne(query).lean();
}

async function bulkCreateModule(data: Partial<IModule>[]): Promise<IModule[]> {
  return await Module.insertMany(data, { ordered: false });
}

function archiveModule(id: string): Promise<IModule | null> {
  return Module.findByIdAndUpdate(
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
