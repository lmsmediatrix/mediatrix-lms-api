import { trimAll } from "../helper/commonHelper";
import { ICategory } from "../models/categoryModel";
import categoryRepository from "../repository/categoryRepository";
import { generatePagination } from "../utils/paginationUtils";
import { QueryCondition } from "../helper/types";
import { arrayToCSV } from "../utils/csvUtils/csvWriter";
import { flattenObject, prettifyHeader } from "../utils/csvUtils/csvResponse";
import { processBulkWriteError } from "../utils/batchProcessor";

const categoryService = {
  getCategory,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  searchCategory,
  exportCategory,
  bulkCreateCategory,
};

export default categoryService;

async function getCategory(id: string, params: any): Promise<ICategory | null> {
  if (!id) {
    throw new Error("Category ID is required");
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

    return await categoryRepository.getCategory(id, dbParams);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getCategories(
  params: any
): Promise<{ categories: ICategory[]; pagination: any; count?: number }> {
  if (!params) {
    throw new Error("Invalid parameters for retrieving categories");
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

      if (params.query.isActive !== undefined) {
        dbParams.query.isActive = params.query.isActive;
      }
    }

    const page = params.page || 1;
    const limit = params.limit || 10;

    const [categories, count] = await Promise.all([
      categoryRepository.getCategories(dbParams),
      categoryRepository.countCategories(dbParams.query),
    ]);

    const pagination = generatePagination(count, page, limit);

    return {
      ...(params.document && { categories }),
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

async function createCategory(data: Partial<ICategory>): Promise<ICategory> {
  if (!data) {
    throw new Error("Category data is required");
  }

  try {
    const trimmedData = trimAll(data);

    const existingCategory = await categoryRepository.searchCategory({
      query: { organizationId: trimmedData.organizationId },
      match: { name: trimmedData.name },
    });

    if (existingCategory && existingCategory.length > 0) {
      throw new Error("Category name already exists");
    }

    return await categoryRepository.createCategory(trimmedData);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function updateCategory(data: Partial<ICategory>): Promise<ICategory | null> {
  const categoryId = data._id?.toString();
  if (!categoryId) {
    throw new Error("Category ID is required");
  }

  try {
    const currentCategory = await categoryService.getCategory(categoryId, {
      select: ["_id", "isActive"],
      query: { organizationId: data.organizationId },
    });

    if (!currentCategory) {
      throw new Error("Category not found");
    }

    const trimmedData = trimAll(data);
    delete trimmedData._id;

    return await categoryRepository.updateCategory(categoryId, trimmedData);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function deleteCategory(id: string): Promise<ICategory | null> {
  if (!id) {
    throw new Error("Category ID is required");
  }

  try {
    const data = await categoryRepository.getCategory(id, {
      options: { select: ["_id", "archive"].join(" ") },
    });

    if (!data) {
      throw new Error("Category not found");
    }

    return await categoryRepository.deleteCategory(data);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function searchCategory(params: any): Promise<any> {
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

    const [categories, count] = await Promise.all([
      categoryRepository.searchCategory(dbParams),
      params.pagination || params.count
        ? categoryRepository.countCategories(dbParams.query)
        : Promise.resolve(0),
    ]);

    if (!params.pagination) {
      return params.count ? { categories, count } : categories;
    }

    const pagination = generatePagination(count, optionsObj.skip + 1, optionsObj.limit);
    return {
      ...(params.document && { categories }),
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

async function exportCategory(params: any, organizationId: string): Promise<string> {
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
      query: { organizationId, ...(params.query || {}) },
      populateArray: [],
      options: {},
      lean: true,
      match: {},
      includeArchived: false,
      archivedOnly: false,
    };

    if (params.match) {
      dbParams.query = { ...dbParams.query, ...params.match };
    }

    if (params.populateArray) {
      dbParams.populateArray = params.populateArray;
    }

    const optionsObj = {
      sort: params.sort || "-createdAt",
      skip: params.skip || 0,
      select: params.select || "name description isActive createdAt updatedAt",
      limit: params.limit || 10,
    };

    dbParams.options = optionsObj;
    dbParams.lean = params.lean ?? true;

    const categories = await categoryRepository.searchCategory(dbParams);
    const flatCategories = categories.map((category: any) => flattenObject(category));

    const allKeys = Array.from(
      flatCategories.reduce((keys, obj) => {
        Object.keys(obj).forEach((key) => keys.add(key));
        return keys;
      }, new Set<string>())
    ) as string[];
    const filteredKeys = allKeys.filter((key) => !key.endsWith("_id") && key !== "_id");
    const prettyHeaders = filteredKeys.map(prettifyHeader);

    const csvData = flatCategories.map((obj) => {
      const row: { [key: string]: string } = {};
      filteredKeys.forEach((key) => {
        if (
          (key.toLowerCase().includes("date") ||
            key.toLowerCase().includes("createdat") ||
            key.toLowerCase().includes("updatedat")) &&
          obj[key]
        ) {
          row[key] = new Date(obj[key]).toISOString().split("T")[0];
        } else if (key === "isActive") {
          row[key] = obj[key] ? "Active" : "Inactive";
        } else {
          row[key] = obj[key] !== undefined ? String(obj[key]) : "";
        }
      });
      return row;
    });

    const csvRaw = arrayToCSV(csvData, filteredKeys);
    const lines = csvRaw.split("\n");
    lines[0] = prettyHeaders.join(",");
    return lines.join("\n");
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function bulkCreateCategory(
  data: Partial<ICategory>[],
  options?: {
    chunkSize?: number;
    onProgress?: (processed: number, total: number, errors: number) => void;
  }
): Promise<{ inserted: ICategory[]; errors: any[] }> {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("No category data provided for bulk insert");
  }

  // For performance, use simple direct MongoDB insertMany for most cases
  const trimmedData = data.map((item) => ({ ...trimAll(item), isActive: true }));

  try {
    // Direct MongoDB insertMany - much faster
    const result = await categoryRepository.insertMany(trimmedData);

    if (options?.onProgress) {
      options.onProgress(data.length, data.length, 0);
    }

    return {
      inserted: result,
      errors: [],
    };
  } catch (error: any) {
    // Handle bulk write errors efficiently
    const { successful, failed } = processBulkWriteError(error);

    // Map failed records back to original data with better error messages
    const mappedErrors = failed.map((f, index) => {
      const originalData = data[f.index] || data[index] || f.data;
      let errorMessage = f.error;

      // Enhanced error message with original data context
      if (errorMessage.includes("already exists") && originalData) {
        if (originalData.name) {
          errorMessage = `Category name '${originalData.name}' already exists`;
        }
      }

      return {
        data: originalData,
        error: errorMessage,
      };
    });

    return {
      inserted: successful,
      errors: mappedErrors,
    };
  }
}
