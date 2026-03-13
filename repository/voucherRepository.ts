import Voucher, { IVoucher } from "../models/voucherModel";

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

const voucherRepository = {
  getVoucher,
  getVouchers,
  createVoucher,
  updateVoucher,
  deleteVoucher,
  searchVoucher,
  countVouchers,
  insertMany,
};

export default voucherRepository;

function getVoucher(id: string, dbParams: DbParams = {}): Promise<IVoucher | null> {
  let query = Voucher.findById(id);

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

function getVouchers(dbParams: DbParams = {}): Promise<IVoucher[]> {
  let query = Voucher.find(dbParams.query || {});

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

function countVouchers(query: any = {}): Promise<number> {
  return Voucher.countDocuments({ ...query }).exec();
}

async function createVoucher(data: Partial<IVoucher>): Promise<IVoucher> {
  const voucher = await Voucher.create(data);
  return voucher;
}

function updateVoucher(id: string, data: Partial<IVoucher>): Promise<IVoucher | null> {
  return Voucher.findByIdAndUpdate(id, { $set: data }, { new: true });
}

async function deleteVoucher(data: any): Promise<IVoucher | null> {
  if (data?.archive?.status === true) {
    return Voucher.findByIdAndDelete(data._id);
  }
  return Voucher.findByIdAndUpdate(
    data._id,
    { $set: { archive: { status: true, date: new Date() } } },
    { new: true }
  );
}

function searchVoucher(params: any = {}): Promise<IVoucher[]> {
  const query = Voucher.find();
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

async function insertMany(data: Partial<IVoucher>[]): Promise<IVoucher[]> {
  return await Voucher.insertMany(data, { ordered: false });
}
