import { FilterQuery, UpdateQuery } from "mongoose";
import Category, { ICategory } from "../models/categoryModel";

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

const categoryRepository = {
  getCategory,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  searchCategory,
  searchAndUpdate,
  findOrCreate,
  countCategories,
  archiveCategory,
  bulkCreate,
  insertMany,
};

export default categoryRepository;

function getCategory(id: string, dbParams: DbParams = {}): Promise<ICategory | null> {
  let query = Category.findById(id);

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

function getCategories(dbParams: DbParams): Promise<ICategory[]> {
  let query = Category.find(dbParams.query);

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

function countCategories(query: any): Promise<number> {
  return Category.countDocuments(query).exec();
}

function createCategory(data: Partial<ICategory>): Promise<ICategory> {
  return Category.create(data);
}

async function updateCategory(id: string, data: Partial<ICategory>): Promise<ICategory | null> {
  return await Category.findByIdAndUpdate(id, { $set: data }, { new: true }).exec();
}

function deleteCategory(data: ICategory): Promise<ICategory | null> {
  return Category.findByIdAndUpdate(
    data._id,
    {
      $set: {
        "archive.status": true,
        "archive.date": new Date(),
      },
    },
    { new: true }
  );
}

function searchCategory(params: any = {}): Promise<ICategory[]> {
  const query = Category.find();
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
  query: FilterQuery<ICategory>,
  update?: UpdateQuery<ICategory>,
  options?: { multi?: boolean }
): Promise<ICategory | null | { modifiedCount: number }> {
  if (!update) {
    return Category.findOne(query);
  }

  if (options?.multi) {
    const result = await Category.updateMany(query, update);
    return { modifiedCount: result.modifiedCount };
  }

  return Category.findOneAndUpdate(query, update, { new: true });
}

async function findOrCreate(query: any): Promise<ICategory | null> {
  return await Category.findOne(query).lean();
}

function archiveCategory(id: string): Promise<ICategory | null> {
  return Category.findByIdAndUpdate(
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

async function bulkCreate(data: Partial<ICategory>[]): Promise<ICategory[]> {
  return Category.insertMany(data, { ordered: true });
}

async function insertMany(data: Partial<ICategory>[]): Promise<ICategory[]> {
  return Category.insertMany(data, { ordered: false });
}
