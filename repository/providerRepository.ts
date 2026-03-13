import Provider, { IProvider } from "../models/providerModel";

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

const providerRepository = {
  getProvider,
  getProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  searchProvider,
  countProviders,
  insertMany,
};

export default providerRepository;

function getProvider(id: string, dbParams: DbParams = {}): Promise<IProvider | null> {
  let query = Provider.findById(id);

  if (!dbParams.query) {
    dbParams.query = {};
  }

  (dbParams.options?.populateArray || []).forEach(
    (populate: string | { path: string; select: string }) => {
      if (typeof populate === "string") {
        query.populate(populate);
      } else {
        query.populate(populate.path, populate.select);
      }
    }
  );

  const options = {
    select: dbParams.options?.select || "_id",
    lean: dbParams.options?.lean || true,
  };

  query = query.select(options.select).lean(options.lean);
  return query.exec();
}

function getProviders(dbParams: DbParams = {}): Promise<IProvider[]> {
  let query = Provider.find(dbParams.query || {});

  if (!dbParams.query) {
    dbParams.query = {};
  }

  (dbParams.options?.populateArray || []).forEach(
    (populate: string | { path: string; select: string }) => {
      if (typeof populate === "string") {
        query.populate(populate);
      } else {
        query.populate(populate.path, populate.select);
      }
    }
  );

  const options = {
    sort: dbParams.options?.sort || { createdAt: -1 },
    limit: dbParams.options?.limit || 10,
    select: dbParams.options?.select || "_id",
    lean: dbParams.options?.lean || true,
    skip: dbParams.options?.skip || 0,
  };

  query = query.sort(options.sort).limit(options.limit).select(options.select).skip(options.skip);

  if (dbParams.query?.organizationId) {
    query.where("organizationId").equals(dbParams.query.organizationId);
  }

  return query.exec();
}

function countProviders(query: any = {}): Promise<number> {
  return Provider.countDocuments({ ...query }).exec();
}

async function createProvider(data: Partial<IProvider>): Promise<IProvider> {
  const provider = await Provider.create(data);
  return provider;
}

function updateProvider(id: string, data: Partial<IProvider>): Promise<IProvider | null> {
  return Provider.findByIdAndUpdate(id, { $set: data }, { new: true });
}

async function deleteProvider(data: any): Promise<IProvider | null> {
  if (data?.archive?.status === true) {
    return Provider.findByIdAndDelete(data._id);
  }
  return Provider.findByIdAndUpdate(
    data._id,
    { $set: { archive: { status: true, date: new Date() } } },
    { new: true }
  );
}

function searchProvider(params: any = {}): Promise<IProvider[]> {
  const query = Provider.find();
  query.setQuery(params.query);

  if (params.populateArray) {
    params.populateArray.forEach((populate: any) => {
      query.populate(populate);
    });
  }

  if (params.projection) {
    query.projection(params.projection);
  }

  if (params.options) {
    query.setOptions(params.options);
  }

  query.lean(params.lean !== false);

  if (!params.includeDeleted) {
    query.where({ "archive.status": { $ne: true } });
  }

  if (params.match) {
    query.where(params.match);
  }

  return query.exec();
}

async function insertMany(data: Partial<IProvider>[]): Promise<IProvider[]> {
  return await Provider.insertMany(data, { ordered: false });
}
