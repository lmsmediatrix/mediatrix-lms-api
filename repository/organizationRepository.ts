import { FilterQuery, UpdateQuery } from "mongoose";
import Organization, { IOrganization } from "../models/organizationModel";

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

const organizationRepository = {
  getOrganization,
  getOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  searchOrganization,
  searchAndUpdate,
  findOrCreate,
  getOrganizationsCount,
  archiveOrganization,
  getOrganizationByCode,
};

export default organizationRepository;

function getOrganization(id: string, dbParams: DbParams = {}): Promise<IOrganization | null> {
  let query = Organization.findById(id);

  if (!dbParams.query) {
    dbParams.query = {};
  }

  if (dbParams.query.includeArchived !== true) {
    query = query.where("archive.status").ne(true);

    (dbParams.options?.populateArray || []).forEach(
      (populate: string | { path: string; select?: string }) => {
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
      }
    );
  } else {
    (dbParams.options?.populateArray || []).forEach(
      (populate: string | { path: string; select?: string }) => {
        if (typeof populate === "string") {
          query.populate(populate);
        } else {
          query.populate(populate.path, populate.select);
        }
      }
    );
  }

  const options = {
    select: dbParams.options?.select || "_id",
    lean: dbParams.options?.lean || true,
  };

  query = query.select(options.select).lean(options.lean);

  return query.exec();
}

function getOrganizations(dbParams: DbParams): Promise<IOrganization[]> {
  let query = Organization.find(dbParams.query);

  if (!dbParams.query) {
    dbParams.query = {};
  }

  if (dbParams.query.includeArchived !== true) {
    query = query.where("archive.status").ne(true);

    (dbParams.options?.populateArray || []).forEach(
      (populate: string | { path: string; select?: string }) => {
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
      }
    );
  } else {
    (dbParams.options?.populateArray || []).forEach(
      (populate: string | { path: string; select?: string }) => {
        if (typeof populate === "string") {
          query.populate(populate);
        } else {
          query.populate(populate.path, populate.select);
        }
      }
    );
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

function createOrganization(data: Partial<IOrganization>): Promise<IOrganization> {
  return Organization.create(data);
}
function getOrganizationsCount(query: any): Promise<number> {
  return Organization.countDocuments(query).exec();
}
function updateOrganization(data: UpdateQuery<IOrganization>): Promise<IOrganization | null> {
  return Organization.findByIdAndUpdate(data._id, data, { new: true });
}

function deleteOrganization(id: string): Promise<IOrganization | null> {
  return Organization.findByIdAndDelete(id);
}

function searchOrganization(params: any = {}): Promise<IOrganization[]> {
  const query = Organization.find();
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
  query: FilterQuery<IOrganization>,
  update?: UpdateQuery<IOrganization>,
  options?: { multi?: boolean }
): Promise<IOrganization | null | { modifiedCount: number }> {
  if (!update) {
    return Organization.findOne(query);
  }

  if (options?.multi) {
    const result = await Organization.updateMany(query, update);
    return { modifiedCount: result.modifiedCount };
  }

  return Organization.findOneAndUpdate(query, update, { new: true });
}

async function findOrCreate(query: any): Promise<IOrganization | null> {
  return await Organization.findOne(query).lean();
}

function archiveOrganization(id: string): Promise<IOrganization | null> {
  return Organization.findByIdAndUpdate(
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

function getOrganizationByCode(
  code: string,
  dbParams: DbParams = {}
): Promise<IOrganization | null> {
  let query = Organization.findOne({ code });

  if (!dbParams.query) {
    dbParams.query = {};
  }

  if (dbParams.query.includeArchived !== true) {
    query = query.where("archive.status").ne(true);

    (dbParams.options?.populateArray || []).forEach(
      (populate: string | { path: string; select?: string }) => {
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
      }
    );
  } else {
    (dbParams.options?.populateArray || []).forEach(
      (populate: string | { path: string; select?: string }) => {
        if (typeof populate === "string") {
          query.populate(populate);
        } else {
          query.populate(populate.path, populate.select);
        }
      }
    );
  }

  const options = {
    select: dbParams.options?.select || "_id",
    lean: dbParams.options?.lean ?? true,
  };

  query = query.select(options.select).lean(options.lean);

  return query.exec();
}
