import { trimAll } from "../helper/commonHelper";
import { IVoucher } from "../models/voucherModel";
import voucherRepository from "../repository/voucherRepository";
import { generatePagination } from "../utils/paginationUtils";
import { Types } from "mongoose";
import { QueryCondition } from "../helper/types";
import { processBulkWriteErrors } from "../utils/csvUtils/csvUtils";

const voucherService = {
  getVoucher,
  getVouchers,
  createVoucher,
  updateVoucher,
  deleteVoucher,
  searchVoucher,
  bulkCreateVouchers,
};

export default voucherService;

async function getVoucher(id: string, params: any): Promise<IVoucher | null> {
  if (!id) {
    throw new Error("Voucher ID is required");
  }

  try {
    const dbParams: any = { query: {}, options: {} };

    if (params.populateArray) {
      dbParams.options.populateArray = params.populateArray.map((item: any) => {
        if (typeof item === "string") {
          const [path, select] = item.split(":");
          return select ? { path, select: select.split(",").join(" ") } : { path };
        }
        return item;
      });
    }

    if (params.queryArray) {
      const queryArrayObj: { [key: string]: any } = {};
      queryArrayObj[params.queryArrayType] = params.queryArray;
      dbParams.query = { ...dbParams.query, ...queryArrayObj };
    }

    if (params.select) {
      if (!Array.isArray(params.select)) {
        params.select = [params.select];
      }
      dbParams.options.select = params.select.join(" ");
    }

    if (params.lean !== undefined) {
      dbParams.options.lean = params.lean;
    }

    return await voucherRepository.getVoucher(id, dbParams);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getVouchers(
  params: any
): Promise<{ vouchers: IVoucher[]; pagination: any; count?: number }> {
  if (!params) {
    throw new Error("Invalid parameters for retrieving vouchers");
  }

  try {
    const dbParams: any = { query: {}, options: {} };

    if (
      params.queryArray &&
      params.queryArray.length > 0 &&
      params.queryArrayType &&
      params.queryArrayType.length > 0
    ) {
      const queryArray = Array.isArray(params.queryArray) ? params.queryArray : [params.queryArray];
      const queryArrayType = Array.isArray(params.queryArrayType)
        ? params.queryArrayType
        : [params.queryArrayType];

      const queryConditions: QueryCondition[] = queryArrayType.map((type: string | number) => {
        const trimmedType = String(type).trim();
        return { [trimmedType]: { $in: queryArray } };
      });

      queryConditions.forEach((condition) => {
        dbParams.query = { ...dbParams.query, ...condition };
      });
    }

    if (params.populateArray) {
      dbParams.options.populateArray = params.populateArray.map((item: any) => {
        if (typeof item === "string") {
          const [path, select] = item.split(":");
          return select ? { path, select: select.split(",").join(" ") } : { path };
        }
        return item;
      });
    }

    if (params.sort) {
      dbParams.options.sort = params.sort;
    }

    if (params.limit) {
      dbParams.options.limit = params.limit;
    }

    if (params.skip) {
      dbParams.options.skip = params.skip * params.limit;
    }

    if (params.select) {
      if (!Array.isArray(params.select)) {
        params.select = [params.select];
      }
      dbParams.options.select = params.select.join(" ");
    }

    if (params.lean !== undefined) {
      dbParams.options.lean = params.lean;
    }

    if (params.query) {
      if (params.query.organizationId) {
        dbParams.query.organizationId = params.query.organizationId;
      }

      if (params.query.status) {
        dbParams.query.status = params.query.status;
      }

      if (params.query.issuedTo) {
        dbParams.query.issuedTo = params.query.issuedTo;
      }

      if (params.query.providerName) {
        dbParams.query.providerName = params.query.providerName;
      }
    }

    const page = params.page || 1;
    const limit = params.limit || 10;

    const [vouchers, count] = await Promise.all([
      voucherRepository.getVouchers(dbParams),
      voucherRepository.countVouchers(dbParams.query),
    ]);

    const pagination = generatePagination(count, page, limit);

    return {
      ...(params.document && { vouchers }),
      ...(params.pagination && { pagination }),
      ...(params.count && { count }),
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function createVoucher(data: Partial<IVoucher>): Promise<IVoucher> {
  if (!data) {
    throw new Error("Voucher data is required");
  }

  try {
    const trimmedData = trimAll(data);
    const existingVoucher = await voucherRepository.searchVoucher({
      query: { organizationId: trimmedData.organizationId },
      match: { code: trimmedData.code },
    });

    if (existingVoucher && existingVoucher.length > 0) {
      throw new Error("Voucher code already exists");
    }

    return await voucherRepository.createVoucher(trimmedData);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function updateVoucher(data: Partial<IVoucher>): Promise<IVoucher | null> {
  const voucherId = data._id?.toString();
  if (!voucherId) {
    throw new Error("Voucher ID is required");
  }

  try {
    const currentVoucher = await voucherService.getVoucher(voucherId, {
      select: ["_id", "status"],
      query: { organizationId: data.organizationId },
    });

    if (!currentVoucher) {
      throw new Error("Voucher not found");
    }

    const trimmedData = trimAll(data);
    delete trimmedData._id;

    return await voucherRepository.updateVoucher(voucherId, trimmedData);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function deleteVoucher(id: string): Promise<IVoucher | null> {
  if (!id) {
    throw new Error("Voucher ID is required");
  }

  try {
    const data = await voucherRepository.getVoucher(id, {
      options: { select: ["_id", "archive"].join(" ") },
    });

    if (!data) {
      throw new Error("Voucher not found");
    }

    return await voucherRepository.deleteVoucher(data);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function searchVoucher(params: any): Promise<any> {
  try {
    const dbParams: {
      query: any;
      populateArray: any[];
      options: any;
      lean: boolean;
      match: any;
      includeArchived?: boolean | string;
      archivedOnly?: boolean;
      pagination?: boolean;
      document?: boolean;
    } = {
      query: {},
      populateArray: [],
      options: {},
      lean: true,
      match: {},
      includeArchived: params.includeArchived,
      archivedOnly: params.archivedOnly,
    };

    dbParams.query = params.query || {};

    if (params.archivedOnly === true) {
      dbParams.query["archive.status"] = true;
      dbParams.includeArchived = true;
    }

    if (params.match) {
      dbParams.query = { ...dbParams.query, ...params.match };
    }

    if (params.populateArray) {
      dbParams["populateArray"] = params.populateArray;
    }

    const optionsObj = {
      sort: params.sort || "-createdAt",
      skip: params.skip || 0,
      select: params.select || "_id",
      limit: params.limit || 10,
    };

    dbParams.options = optionsObj;
    dbParams.lean = params.lean ?? true;

    const [vouchers, count] = await Promise.all([
      voucherRepository.searchVoucher(dbParams),
      params.pagination || params.count
        ? voucherRepository.countVouchers(dbParams.query)
        : Promise.resolve(0),
    ]);

    if (!params.pagination) {
      return params.count ? { vouchers, count } : vouchers;
    }

    const pagination = generatePagination(count, optionsObj.skip + 1, optionsObj.limit);
    return {
      ...(params.document && { vouchers }),
      ...(params.pagination && { pagination }),
      ...(params.count && { count }),
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function bulkCreateVouchers(data: {
  expiryDate?: Date | string;
  organizationId: string;
  name?: string;
  description?: string;
  discount?: number;
  providerName?: string;
  csvData?: any[];
}): Promise<{
  successCount: number;
  successList: Array<{ _id: string; code: string; name: string }>;
  errorCount: number;
  errorList: Array<{ errorMessage: string; errorCode: number; row?: number }>;
}> {
  const isCSVImport = data.csvData && Array.isArray(data.csvData) && data.csvData.length > 0;
  const successList: Array<{ _id: string; code: string; name: string }> = [];
  const errorList: Array<{ errorMessage: string; errorCode: number; row?: number }> = [];

  if (!isCSVImport && !data.name) {
    throw new Error("Voucher name is required when not using CSV import");
  }

  try {
    let voucherDocuments: any[] = [];
    if (isCSVImport) {
      voucherDocuments = data
        .csvData!.map((row, index) => {
          try {
            if (!row.name) {
              errorList.push({
                errorMessage: "Voucher name is required",
                errorCode: 400,
                row: index + 1,
              });
              return null;
            }

            if (!row.code || row.code.length < 6) {
              errorList.push({
                errorMessage: "Voucher code must be at least 6 characters",
                errorCode: 400,
                row: index + 1,
              });
              return null;
            }

            let expiryDate;
            if (row.expiryDate) {
              const dateParts = row.expiryDate.split("/");
              if (dateParts.length === 3) {
                expiryDate = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`);

                if (isNaN(expiryDate.getTime())) {
                  errorList.push({
                    errorMessage: `Invalid date format: ${row.expiryDate}. Use DD/MM/YYYY format.`,
                    errorCode: 400,
                    row: index + 1,
                  });
                  return null;
                }
              } else {
                expiryDate = new Date(row.expiryDate);
                if (isNaN(expiryDate.getTime())) {
                  errorList.push({
                    errorMessage: `Invalid date format: ${row.expiryDate}. Use DD/MM/YYYY format.`,
                    errorCode: 400,
                    row: index + 1,
                  });
                  return null;
                }
              }
            }

            return {
              name: row.name,
              code: row.code,
              description: row.description || "",
              organizationId: new Types.ObjectId(data.organizationId),
              expiryDate: expiryDate,
              discount: row.discount !== undefined ? Number(row.discount) : undefined,
              providerName: row.providerName || "",
              status: row.status || "active",
            };
          } catch (error) {
            errorList.push({
              errorMessage: error instanceof Error ? error.message : "Invalid data in CSV row",
              errorCode: 400,
              row: index + 1,
            });
            return null;
          }
        })
        .filter(Boolean);
    }

    if (voucherDocuments.length === 0) {
      return { successCount: 0, successList, errorCount: errorList.length, errorList };
    }

    try {
      const result = await voucherRepository.insertMany(voucherDocuments);

      result.forEach((voucher: any) => {
        successList.push({
          _id: voucher._id.toString(),
          code: voucher.code,
          name: voucher.name,
        });
      });
    } catch (bulkError: any) {
      if (bulkError.name === "MongoBulkWriteError") {
        if (bulkError.insertedDocs && Array.isArray(bulkError.insertedDocs)) {
          bulkError.insertedDocs.forEach((doc: any) => {
            if (doc && doc._id) {
              successList.push({
                _id: doc._id.toString(),
                code: doc.code,
                name: doc.name,
              });
            }
          });
        }
        const processedErrors = processBulkWriteErrors(bulkError);
        errorList.push(...processedErrors);
      } else {
        errorList.push({
          errorMessage: bulkError.message || "Unknown error occurred",
          errorCode: bulkError.code || 500,
        });
      }
    }
  } catch (error: any) {
    errorList.push({
      errorMessage: error.message || "Unknown error occurred",
      errorCode: error.code || 500,
    });
  }

  return {
    successCount: successList.length,
    successList,
    errorCount: errorList.length,
    errorList,
  };
}
