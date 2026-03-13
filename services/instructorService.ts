import * as bcrypt from "bcrypt";
import { config } from "../config/common";
import { trimAll } from "../helper/commonHelper";
import { IInstructor } from "../models/instructorModel";
import instructorRepository from "../repository/instructorRepository";
import organizationRepository from "../repository/organizationRepository";
import cloudinaryService from "./cloudinaryService";
import { QueryCondition } from "../helper/types";
import { generatePagination } from "../utils/paginationUtils";
import { arrayToCSV } from "../utils/csvUtils/csvWriter";
import { sanitizeEmploymentType } from "../utils/employmentTypeSanitize";
import facultyRepository from "../repository/facultyRepository";
import { Types } from "mongoose";
import { flattenObject } from "../utils/csvUtils/csvResponse";
import { prettifyHeader } from "../utils/csvUtils/csvResponse";

const instructorService = {
  getInstructor,
  getInstructors,
  createInstructor,
  updateInstructor,
  deleteInstructor,
  searchInstructor,
  instructorDashboard,
  bulkImportInstructor,
  archiveInstructor,
  exportInstructor,
};

export default instructorService;

async function getInstructor(id: string, params: any): Promise<IInstructor | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.INSTRUCTOR.ID);
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
    if (params.query && params.query.organizationId) {
      dbParams.query.organizationId = params.query.organizationId;
    } else {
      return null;
    }

    return await instructorRepository.getInstructor(id, dbParams);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function instructorDashboard(id: string, params: any): Promise<any> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.INSTRUCTOR.ID);
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
    if (params.query && params.query.organizationId) {
      dbParams.query.organizationId = params.query.organizationId;
    } else {
      return null;
    }

    return await instructorRepository.instructorDashboard(id, dbParams);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getInstructors(
  params: any
): Promise<{ instructors: IInstructor[]; pagination: any; count?: number }> {
  if (!params) {
    throw new Error(config.RESPONSE.ERROR.INSTRUCTOR.INVALID_PARAMETER.GET_ALL);
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

    if (params.query && params.query.organizationId) {
      dbParams.query.organizationId = params.query.organizationId;
    } else {
      return { instructors: [], pagination: {} };
    }

    const page = params.page || 1;

    const [instructors, count] = await Promise.all([
      instructorRepository.getInstructors(dbParams),
      instructorRepository.getInstructorsCount(dbParams.query),
    ]);

    const pagination = generatePagination(count, page, limit);

    return {
      ...(params.document && { instructors }),
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

async function createInstructor(
  data: Partial<IInstructor> & { path?: string },
  files?: { [fieldname: string]: Express.Multer.File[] }
): Promise<IInstructor> {
  if (!data) {
    throw new Error(config.ERROR.USER.REQUIRED_FIELDS);
  }

  try {
    const trimmedData = trimAll(data);
    const { email, password, organizationId, ...otherData } = trimmedData;
    const currentYear = new Date().getFullYear();
    const defaultPassword =
      password ||
      `${trimmedData.firstName}${trimmedData.lastName}lmsapp${currentYear}`
        .toLowerCase()
        .replace(/\s+/g, "");

    const existingUser = await instructorRepository.searchAndUpdate({ email, organizationId });

    if (existingUser) {
      throw new Error(config.ERROR.USER.ALREADY_EXIST);
    }

    if (files && files["avatar"]) {
      trimmedData.avatar = trimmedData.avatar || {};
      trimmedData.avatar = await cloudinaryService.uploadImage(files["avatar"][0], `${data.path}`);
    }

    const hashedPassword = await bcrypt.hash(defaultPassword, config.BCRYPT.SALT_ROUNDS);

    const newInstructor = await instructorRepository.createInstructor({
      ...otherData,
      email,
      password: hashedPassword,
      organizationId,
      avatar: trimmedData.avatar,
    });

    if (newInstructor.role === "instructor" && organizationId) {
      await organizationRepository.updateOrganization({
        _id: organizationId,
        $push: { instructors: newInstructor._id },
      });
    }

    return newInstructor;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function updateInstructor(
  data: Partial<IInstructor> & { path?: string },
  files?: { [fieldname: string]: Express.Multer.File[] }
): Promise<IInstructor | null> {
  if (!data) {
    throw new Error(config.RESPONSE.ERROR.INSTRUCTOR.INVALID_PARAMETER.UPDATE);
  }
  const extractPublicId = (url: string) => {
    const regex = /\/upload\/v\d+\/(.+)\.\w+$/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  try {
    const currentInstructor = await instructorService.getInstructor(data._id, {
      select: ["avatar firstName lastName organizationId"],
      query: { organizationId: data.organizationId },
    });
    if (!currentInstructor) {
      throw new Error("Instructor not found");
    }
    if (files?.["avatar"]) {
      if (currentInstructor?.avatar) {
        const logoPublicId = extractPublicId(currentInstructor.avatar);
        if (logoPublicId) {
          await cloudinaryService.deleteImage(logoPublicId);
        }
      }
      data.avatar = typeof data.avatar === "string" ? data.avatar : undefined;
      data.avatar = await cloudinaryService.uploadImage(files["avatar"][0], data.path);
    }
    return await instructorRepository.updateInstructor(data);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function deleteInstructor(id: string): Promise<IInstructor | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.INSTRUCTOR.INVALID_PARAMETER.REMOVE);
  }

  try {
    return await instructorRepository.archiveInstructor(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function searchInstructor(params: any): Promise<any> {
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
    if (!dbParams.includeArchived && !dbParams.archivedOnly) {
      dbParams.query["archive.status"] = { $ne: true };
    }

    const optionsObj = {
      sort: params.sort || "-createdAt",
      skip: params.skip * params.limit || 0,
      select: params.select || "_id",
      limit: params.limit || 10,
    };

    dbParams.options = optionsObj;
    dbParams.lean = params.lean ?? true;

    dbParams.pagination = params.pagination;
    dbParams.document = params.document;

    const skip = params.skip || 0;
    const [instructors, count] = await Promise.all([
      instructorRepository.searchInstructor(dbParams),
      params.pagination || params.count
        ? instructorRepository.getInstructorsCount(
            params.archivedOnly ? { ...dbParams.query, "archive.status": false } : dbParams.query
          )
        : Promise.resolve(0),
    ]);
    if (!params.pagination) {
      return params.count ? { instructors, count } : instructors;
    }

    const pagination = generatePagination(count, skip + 1, optionsObj.limit);
    return {
      ...(params.document && { instructors }),
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

async function bulkImportInstructor(
  csvData: any[],
  organizationId: string,
  req: any
): Promise<{
  successCount: number;
  successList: Array<{
    email: string;
    firstName: string;
    lastName: string;
    faculty: string;
  }>;
  errorCount: number;
  errorList: Array<{
    errorMessage: string;
    errorCode: number;
    row?: number;
  }>;
}> {
  if (!csvData?.length) throw new Error("Invalid CSV data");

  // Sanitize CSV data by cleaning up property names
  const sanitizedData = csvData.map((row) => {
    const cleanRow: any = {};
    Object.entries(row).forEach(([key, value]) => {
      // Remove quotes and clean up the key
      const cleanKey = key.replace(/['"]/g, "").trim();
      cleanRow[cleanKey] = value;
    });
    return cleanRow;
  });

  const successList: any[] = [];
  const errorList: any[] = [];

  const instructorDataArray = await Promise.all(
    sanitizedData.map(async (row: any) => {
      const email = row.email || `${row.firstName}.${row.lastName}@example.com`.toLowerCase();

      const currentYear = new Date().getFullYear();
      const plainPassword = `${row.firstName}${row.lastName}lmsapp${currentYear}`
        .toLowerCase()
        .replace(/\s+/g, "");
      const password = await bcrypt.hash(plainPassword, config.BCRYPT.SALT_ROUNDS);

      const faculties = await facultyRepository.getFaculties({
        query: { $or: [{ code: row.faculty }, { name: row.faculty }] },
      });
      const facultyObj = faculties[0];

      return {
        firstName: row.firstName,
        lastName: row.lastName,
        email,
        employeeId: row.employeeId,
        employmentType: row.employmentType || "full_time",
        ...(facultyObj && { faculty: facultyObj._id as Types.ObjectId }),
        password,
        organizationId,
        role: "instructor" as const,
      };
    })
  );

  function sanitizeDuplicateKeyError(msg: string) {
    if (msg && msg.includes("E11000 duplicate key error")) {
      const match = msg.match(/dup key: (.*)/);
      if (match && match[1]) {
        return `Duplicate entry: ${match[1]}`;
      }
      return "Duplicate entry";
    }
    return msg;
  }

  try {
    if (req.io) {
      req.io.emit("bulkImportStart", { total: instructorDataArray.length });
    }

    // Process instructors one by one to handle duplicates
    for (let i = 0; i < instructorDataArray.length; i++) {
      const instructor = instructorDataArray[i];
      try {
        // Try to find existing instructor
        const existingInstructor = await instructorRepository.searchAndUpdate({
          email: instructor.email,
          organizationId,
        });

        if (existingInstructor) {
          const errorData = {
            errorMessage: `Duplicate entry: { email: "${instructor.email}" }`,
            errorCode: 500,
            row: i + 1,
          };
          errorList.push(errorData);
          if (req.io) req.io.emit("bulkImportErrorRow", errorData);
          continue;
        }
        const result = await instructorRepository.createInstructor(instructor);

        const successData = {
          email: result.email,
          firstName: result.firstName,
          lastName: result.lastName,
          faculty: result.faculty?.toString() || "",
        };
        successList.push(successData);
        if (req.io) req.io.emit("bulkImportSuccessRow", successData);

        // Update organization
        await organizationRepository.updateOrganization({
          _id: organizationId,
          $push: { instructors: result._id },
        });
      } catch (error: any) {
        const errorData = {
          errorMessage: sanitizeDuplicateKeyError(error.message || "Unknown error occurred"),
          errorCode: error.code || 500,
          row: i + 1,
        };
        errorList.push(errorData);
        if (req.io) req.io.emit("bulkImportErrorRow", errorData);
      }
    }
  } catch (error: any) {
    const errorData = {
      errorMessage: sanitizeDuplicateKeyError(error.message || "Unknown error occurred"),
      errorCode: error.code || 500,
    };
    errorList.push(errorData);
    if (req.io) req.io.emit("bulkImportError", errorData);
  }

  if (req.io) {
    req.io.emit("bulkImportComplete", {
      successCount: successList.length,
      errorCount: errorList.length,
      successList,
      errorList,
    });
  }

  return {
    successCount: successList.length,
    successList,
    errorCount: errorList.length,
    errorList,
  };
}

async function archiveInstructor(id: string): Promise<IInstructor | null> {
  if (!id) {
    throw new Error("Invalid instructor ID");
  }

  try {
    const instructor = await instructorRepository.getInstructor(id, {});
    if (!instructor) {
      return null;
    }

    return await instructorRepository.archiveInstructor(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function exportInstructor(params: any, organizationId: string): Promise<string> {
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
      query: { organizationId, role: "instructor", ...(params.query || {}) },
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
      select: params.select,
      populate: params.populate,
      limit: params.limit || 10,
    };
    dbParams.options = optionsObj;
    dbParams.lean = params.lean ?? true;
    const instructors = await instructorRepository.searchInstructor(dbParams);

    const flatInstructors = instructors.map((instructor: any) => flattenObject(instructor));

    const allKeys = Array.from(
      flatInstructors.reduce((keys, obj) => {
        Object.keys(obj).forEach((key) => keys.add(key));
        return keys;
      }, new Set<string>())
    ) as string[];

    const csvData = flatInstructors.map((obj) => {
      const row: { [key: string]: string } = {};
      allKeys.forEach((key) => {
        if (key === "employmentType" && obj[key] !== undefined) {
          row[key] = sanitizeEmploymentType(obj[key]);
        } else {
          row[key] = obj[key] !== undefined ? String(obj[key]) : "";
        }
      });
      return row;
    });

    const filteredKeys = allKeys.filter((key) => !key.endsWith("_id") && key !== "_id");

    const prettyHeaders = filteredKeys.map(prettifyHeader);

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
