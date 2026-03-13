import { config } from "../config/common";
import { IProgram } from "../models/programModel";
import organizationRepository from "../repository/organizationRepository";
import programRepository from "../repository/programRepository";
import { generatePagination } from "../utils/paginationUtils";
import { arrayToCSV } from "../utils/csvUtils/csvWriter";
import { flattenObject, prettifyHeader } from "../utils/csvUtils/csvResponse";
import mongoose from "mongoose";
import { processBulkWriteError } from "../utils/batchProcessor";

const programService = {
  getProgram,
  getPrograms,
  createProgram,
  updateProgram,
  deleteProgram,
  searchProgram,
  exportProgram,
  generateProgramCode,
  bulkCreateProgram,
};

export default programService;

async function getProgram(id: string, params: any): Promise<IProgram | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.PROGRAM.INVALID_PARAMETER.GET);
  }

  try {
    const dbParams: any = { query: {}, options: {} };

    if (params.populateArray) {
      dbParams.options.populateArray = params.populateArray;
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

    return await programRepository.getProgram(id, dbParams);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getPrograms(
  params: any
): Promise<{ programs: IProgram[]; pagination: any; count?: number }> {
  if (!params) {
    throw new Error(config.RESPONSE.ERROR.PROGRAM.INVALID_PARAMETER.GET_ALL);
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
    if (params.limit) {
      dbParams.options.limit = params.limit;
    }
    const limit = params.limit || 10;
    const skip = params.skip || 0;
    dbParams.options.limit = limit;
    dbParams.options.skip = skip * limit;
    if (params.select) {
      if (!Array.isArray(params.select)) {
        params.select = [params.select];
      }
      dbParams.options.select = params.select.join(" ");
    }
    if (params.lean !== undefined) {
      dbParams.options.lean = params.lean;
    }

    const page = params.page || 1;

    const [programs, count] = await Promise.all([
      programRepository.getPrograms(dbParams),
      programRepository.countPrograms(dbParams.query),
    ]);

    const pagination = generatePagination(count, page, limit);
    return {
      ...(params.document && { programs }),
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

async function createProgram(
  programQueryOrData: Partial<IProgram>,
  organizationId: string
): Promise<IProgram> {
  if (!organizationId) {
    throw new Error(config.RESPONSE.ERROR.PROGRAM.INVALID_PARAMETER.CREATE);
  }
  programQueryOrData.organizationId = organizationId;

  try {
    const program = await programRepository.createProgram(programQueryOrData as Partial<IProgram>);
    await organizationRepository.updateOrganization({
      _id: organizationId,
      $push: { programs: program._id },
    });
    return program;
  } catch (error: any) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const value = (Object.values(error.keyValue)[0] as string).replace(/["/]/g, "").trim();
      throw new Error(
        `Unable to create program: The ${field} "${value}" is already taken within this organization. Please use a different ${field}.`
      );
    }
    throw error;
  }
}

async function updateProgram(data: Partial<IProgram>): Promise<IProgram | null> {
  if (!data) {
    throw new Error(config.RESPONSE.ERROR.PROGRAM.INVALID_PARAMETER.UPDATE);
  }

  try {
    return await programRepository.updateProgram(data._id as string, data);
  } catch (error: any) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const value = (Object.values(error.keyValue)[0] as string).replace(/["/]/g, "").trim();
      throw new Error(
        `Unable to update program: The ${field} "${value}" is already taken within this organization. Please use a different ${field}.`
      );
    }
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function deleteProgram(id: string): Promise<IProgram | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.PROGRAM.INVALID_PARAMETER.REMOVE);
  }

  try {
    return await programRepository.deleteProgram(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function searchProgram(params: any): Promise<any> {
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

    const [programs, count] = await Promise.all([
      programRepository.searchProgram(dbParams),
      params.pagination || params.count
        ? programRepository.countPrograms(dbParams.query)
        : Promise.resolve(0),
    ]);

    if (!params.pagination) {
      return params.count ? { programs, count } : programs;
    }

    const pagination = generatePagination(count, skip + 1, optionsObj.limit);
    return {
      ...(params.document && { programs }),
      ...(params.pagination && { pagination }),
      ...(params.count && { count }),
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

async function exportProgram(params: any, organizationId: string): Promise<string> {
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
      select: params.select || "name code description faculty isActive createdAt updatedAt",
      limit: params.limit || 10,
    };

    dbParams.options = optionsObj;
    dbParams.lean = params.lean ?? true;

    const programs = await programRepository.searchProgram(dbParams);
    const flatPrograms = programs.map((program: any) => flattenObject(program));

    const allKeys = Array.from(
      flatPrograms.reduce((keys, obj) => {
        Object.keys(obj).forEach((key) => keys.add(key));
        return keys;
      }, new Set<string>())
    ) as string[];
    const filteredKeys = allKeys.filter((key) => !key.endsWith("_id") && key !== "_id");
    const prettyHeaders = filteredKeys.map(prettifyHeader);

    const csvData = flatPrograms.map((obj) => {
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

async function generateProgramCode(data: any, organizationId: string): Promise<string> {
  try {
    const randomNumber = Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, "0");

    if (data.code) {
      const existingProgram = await programRepository.findOrCreate({
        code: data.code,
        organizationId: new mongoose.Types.ObjectId(organizationId),
      });
      if (existingProgram) {
        throw new Error(`Program with code ${data.code} already exists`);
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

    const existingProgramWithInitials = await programRepository.findOrCreate({
      code: initials,
      organizationId: new mongoose.Types.ObjectId(organizationId),
    });
    if (existingProgramWithInitials) {
      throw new Error(`Program with code ${initials} already exists`);
    }

    return `${initials}${randomNumber}`;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

async function bulkCreateProgram(
  data: Partial<IProgram>[],
  organizationId: string,
  options?: {
    chunkSize?: number;
    onProgress?: (processed: number, total: number, errors: number) => void;
  }
): Promise<{ inserted: IProgram[]; errors: any[] }> {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("No program data provided for bulk insert");
  }

  const preparedData = data.map((item) => ({ ...item, organizationId, isActive: true }));

  try {
    // Direct MongoDB insertMany - much faster
    const result = await programRepository.insertMany(preparedData);

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
          errorMessage = `Program code '${originalData.code}' already exists`;
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
