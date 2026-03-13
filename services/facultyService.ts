import mongoose from "mongoose";
import { IFaculty } from "../models/facultyModel";
import facultyRepository from "../repository/facultyRepository";
import { generatePagination } from "../utils/paginationUtils";
import { arrayToCSV } from "../utils/csvUtils/csvWriter";
import { flattenObject, prettifyHeader } from "../utils/csvUtils/csvResponse";
import { processBulkWriteError } from "../utils/batchProcessor";

const facultyService = {
  getFaculty,
  getFaculties,
  createFaculty,
  updateFaculty,
  deleteFaculty,
  searchFaculty,
  generateFacultyCode,
  exportFaculty,
  bulkCreateFaculty,
};

export default facultyService;

async function getFaculty(id: string, params: any): Promise<IFaculty | null> {
  if (!id) {
    throw new Error("Invalid faculty ID parameter.");
  }

  try {
    const dbParams: any = { query: {}, options: {} };

    if (params.populateArray) {
      dbParams.options.populateArray = params.populateArray;
    }

    if (params.select) {
      dbParams.options.select = Array.isArray(params.select)
        ? params.select.join(" ")
        : params.select;
    }

    if (params.lean !== undefined) {
      dbParams.options.lean = params.lean;
    }

    return await facultyRepository.getFaculty(id, dbParams);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

async function getFaculties(
  params: any,
  organizationId: string
): Promise<{ faculties: IFaculty[]; pagination?: any; count?: number }> {
  if (!params) {
    throw new Error("Invalid faculty getAll parameter.");
  }

  try {
    const dbParams: any = {
      query: { organizationId: new mongoose.Types.ObjectId(organizationId) },
      options: {},
    };

    if (params.queryArray && params.queryArrayType) {
      const queryArray = Array.isArray(params.queryArray) ? params.queryArray : [params.queryArray];
      const queryArrayType = Array.isArray(params.queryArrayType)
        ? params.queryArrayType
        : [params.queryArrayType];

      const queryConditions = queryArrayType.map((type: string | number) => {
        const trimmedType = String(type).trim();
        return { [trimmedType]: { $in: queryArray } };
      });

      queryConditions.forEach((condition: any) => {
        dbParams.query = { ...dbParams.query, ...condition };
      });
    }

    if (params.populateArray) {
      dbParams.options.populateArray = params.populateArray;
    }

    if (params.sort) {
      dbParams.options.sort = params.sort;
    }

    const limit = params.limit || 10;
    const skip = params.skip || 0;
    dbParams.options.limit = limit;
    dbParams.options.skip = skip * limit;

    if (params.select) {
      dbParams.options.select = Array.isArray(params.select)
        ? params.select.join(" ")
        : params.select;
    }

    if (params.lean !== undefined) {
      dbParams.options.lean = params.lean;
    }
    const page = params.page || 1;
    const [faculties, count] = await Promise.all([
      facultyRepository.getFaculties(dbParams),
      params.pagination || params.count
        ? facultyRepository.facultyCount(dbParams.query)
        : Promise.resolve(0),
    ]);

    const pagination = params.pagination ? generatePagination(count, page, limit) : undefined;

    return {
      faculties,
      ...(params.pagination && { pagination }),
      ...(params.count && { count }),
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

async function createFaculty(
  facultyData: Partial<IFaculty>,
  organizationId: string
): Promise<IFaculty> {
  if (!facultyData) {
    throw new Error("Invalid faculty create parameter.");
  }
  try {
    facultyData.organizationId = new mongoose.Types.ObjectId(organizationId);
    return await facultyRepository.createFaculty(facultyData);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

async function updateFaculty(updateData: Partial<IFaculty>): Promise<IFaculty | null> {
  try {
    return await facultyRepository.updateFaculty(updateData);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

async function deleteFaculty(id: string): Promise<IFaculty | null> {
  if (!id) {
    throw new Error("Invalid faculty delete parameter.");
  }

  try {
    return await facultyRepository.deleteFaculty(id);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

async function searchFaculty(params: any, organizationId: string): Promise<any> {
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
      query: { organizationId: new mongoose.Types.ObjectId(organizationId) },
      populateArray: [],
      options: {},
      lean: true,
      match: {},
      includeArchived: params.includeArchived,
      archivedOnly: params.archivedOnly,
      pagination: params.pagination,
      document: params.document,
    };

    dbParams.query = params.query || {};

    if (params.archivedOnly === true) {
      dbParams.query["archive.status"] = true;
      dbParams.includeArchived = true;
    } else if (params.includeArchived !== true) {
      dbParams.query["archive.status"] = { $ne: true };
    }

    if (params.match) {
      dbParams.query = { ...dbParams.query, ...params.match };
    }

    if (params.populateArray) {
      dbParams["populateArray"] = params.populateArray;
    }

    const optionsObj = {
      sort: params.sort || "-createdAt",
      skip: params.skip * params.limit || 0,
      select: params.select || "_id",
      limit: params.limit || 10,
    };

    dbParams.options = optionsObj;
    dbParams.lean = params.lean ?? true;

    const skip = params.skip || 0;
    const [faculties, count] = await Promise.all([
      facultyRepository.searchFaculty(dbParams),
      params.pagination || params.count
        ? facultyRepository.facultyCount(dbParams.query)
        : Promise.resolve(0),
    ]);

    if (!params.pagination) {
      return params.count ? { faculties, count } : faculties;
    }

    const pagination = generatePagination(count, skip + 1, optionsObj.limit);
    return {
      ...(params.document && { faculties }),
      ...(params.pagination && { pagination }),
      ...(params.count && { count }),
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

async function generateFacultyCode(data: any, organizationId: string): Promise<string> {
  try {
    const randomNumber = Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, "0");

    if (data.code) {
      const existingFaculty = await facultyRepository.findOrCreate({
        code: data.code,
        organizationId: new mongoose.Types.ObjectId(organizationId),
      });
      if (existingFaculty) {
        throw new Error(`Faculty with code ${data.code} already exists`);
      }
      return `${data.code}${randomNumber}`;
    }

    const words = data.name.split(" ");
    let initials;
    if (words.length === 1) {
      const word = words[0];
      initials = (word.charAt(0) + word.charAt(word.length - 1)).toUpperCase();
    } else {
      initials = words.map((word: string) => word.charAt(0).toUpperCase()).join("");
    }

    const existingFacultyWithInitials = await facultyRepository.findOrCreate({
      code: initials,
      organizationId: new mongoose.Types.ObjectId(organizationId),
    });
    if (existingFacultyWithInitials) {
      throw new Error(`Faculty with code ${initials} already exists`);
    }

    return `${initials}${randomNumber}`;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export async function exportFaculty(params: any, organizationId: string): Promise<string> {
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
      select: params.select || "name code description isActive createdAt updatedAt",
      limit: params.limit || 10,
    };
    dbParams.options = optionsObj;
    dbParams.lean = params.lean ?? true;

    const faculties = await facultyRepository.searchFaculty(dbParams);

    const flatFaculties = faculties.map((faculty: any) => flattenObject(faculty));

    const allKeys = Array.from(
      flatFaculties.reduce((keys, obj) => {
        Object.keys(obj).forEach((key) => keys.add(key));
        return keys;
      }, new Set<string>())
    ) as string[];

    const filteredKeys = allKeys.filter((key) => !key.endsWith("_id") && key !== "_id");

    const prettyHeaders = filteredKeys.map(prettifyHeader);

    const csvData = flatFaculties.map((obj) => {
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

async function bulkCreateFaculty(
  data: Partial<IFaculty>[],
  organizationId: string,
  options?: {
    chunkSize?: number;
    onProgress?: (processed: number, total: number, errors: number) => void;
  }
): Promise<{ inserted: IFaculty[]; errors: any[] }> {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("No faculty data provided for bulk insert");
  }

  const orgId = new mongoose.Types.ObjectId(organizationId);
  const preparedData = data.map((item) => ({ ...item, organizationId: orgId, isActive: true }));

  try {
    // Direct MongoDB insertMany - much faster
    const result = await facultyRepository.insertMany(preparedData);

    if (options?.onProgress) {
      options.onProgress(data.length, data.length, 0);
    }

    return {
      inserted: result,
      errors: [],
    };
  } catch (error: any) {
    const { successful, failed } = processBulkWriteError(error);

    // Map failed records back to original data with better error messages
    const mappedErrors = failed.map((f, index) => {
      const originalData = data[f.index] || data[index] || f.data;
      let errorMessage = f.error;

      // Enhanced error message with original data context
      if (errorMessage.includes("already exists") && originalData) {
        if (originalData.code) {
          errorMessage = `Faculty code '${originalData.code}' already exists`;
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
