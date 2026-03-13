import * as bcrypt from "bcrypt";
import { config } from "../config/common";
import { trimAll } from "../helper/commonHelper";
import { IStudent } from "../models/studentModel";
import organizationRepository from "../repository/organizationRepository";
import studentRepository from "../repository/studentRepository";
import cloudinaryService from "./cloudinaryService";
import { QueryCondition } from "../helper/types";
import { generatePagination } from "../utils/paginationUtils";
import { arrayToCSV } from "../utils/csvUtils/csvWriter";
import { getSectionStudentGradesTable } from "../helper/service/gradeUtils";
import programRepository from "../repository/programRepository";
import { Types } from "mongoose";
import { flattenObject, prettifyHeader } from "../utils/csvUtils/csvResponse";

const studentService = {
  getStudent,
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  searchStudent,
  studentDashboard,
  studentCalendar,
  bulkImportStudent,
  getStudentGradeBySection,
  archiveStudent,
  exportStudent,
};

export default studentService;

async function getStudent(id: string, params: any): Promise<IStudent | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.STUDENT.ID);
  }
  try {
    const dbParams: any = { query: {}, options: {} };
    if (params.populateArray) {
      dbParams.options.populateArray = params.populateArray;
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

    return await studentRepository.getStudent(id, dbParams);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function studentDashboard(id: string, params: any): Promise<IStudent | null> {
  if (!id) {
    throw new Error(config.ERROR.USER.NO_ID);
  }

  try {
    const dbParams: any = { query: {}, options: {} };
    if (params.populateArray) {
      dbParams.options.populateArray = params.populateArray;
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

    return await studentRepository.studentDashboard(id, dbParams);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function studentCalendar(id: string, params: any): Promise<IStudent | null> {
  if (!id) {
    throw new Error(config.ERROR.USER.NO_ID);
  }

  try {
    const dbParams: any = { query: {}, options: {} };
    if (params.populateArray) {
      dbParams.options.populateArray = params.populateArray;
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
      if (params.query.view) {
        dbParams.query.view = params.query.view;
      }
    } else {
      return null;
    }

    return await studentRepository.studentCalendar(id, dbParams);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getStudents(params: any): Promise<any> {
  if (!params) {
    throw new Error(config.RESPONSE.ERROR.STUDENT.INVALID_PARAMETER.GET_ALL);
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
      dbParams.options.populateArray = params.populateArray;
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

    if (params.query && params.query.organizationId) {
      dbParams.query.organizationId = params.query.organizationId;
    } else {
      return { students: [], pagination: {} };
    }

    const page = params.page || 1;
    const limit = params.limit || 10;
    const [students, count] = await Promise.all([
      studentRepository.getStudents(dbParams),
      studentRepository.getStudentsCount(dbParams.query),
    ]);

    const pagination = generatePagination(count, page, limit);

    return {
      ...(params.document && { students }),
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

async function createStudent(
  data: Partial<IStudent> & { path?: string },
  files?: { [fieldname: string]: Express.Multer.File[] }
): Promise<IStudent> {
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

    if (!organizationId) {
      throw new Error("Organization ID is required to create a student");
    }

    const existingUser = await studentRepository.searchAndUpdate({
      email,
      organizationId,
    });
    if (existingUser) {
      throw new Error(config.ERROR.USER.ALREADY_EXIST);
    }

    if (otherData.studentId) {
      const existingUser = await studentRepository.searchAndUpdate({
        studentId: otherData.studentId,
        organizationId: organizationId,
      });
      if (existingUser) {
        throw new Error(
          `Student with ID ${otherData.studentId} already exists in this organization.`
        );
      }
    }

    if (files && files["avatar"]) {
      trimmedData.avatar = trimmedData.avatar || {};
      trimmedData.avatar = await cloudinaryService.uploadImage(files["avatar"][0], `${data.path}`);
    }

    const hashedPassword = await bcrypt.hash(defaultPassword, config.BCRYPT.SALT_ROUNDS);

    const newUser = await studentRepository.createStudent({
      ...otherData,
      email,
      password: hashedPassword,
      organizationId,
      avatar: trimmedData.avatar,
      role: "student",
    });

    if (organizationId) {
      await organizationRepository.updateOrganization({
        _id: organizationId,
        $push: { students: newUser._id },
      });
    }

    return newUser;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function updateStudent(
  data: Partial<IStudent> & { path?: string },
  files?: { [fieldname: string]: Express.Multer.File[] }
): Promise<IStudent | null> {
  if (!data) {
    throw new Error(config.RESPONSE.ERROR.STUDENT.INVALID_PARAMETER.UPDATE);
  }
  const extractPublicId = (url: string) => {
    const regex = /\/upload\/v\d+\/(.+)\.\w+$/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  try {
    const currentStudent = await studentService.getStudent(data._id, {
      select: ["avatar firstName lastName"],
      query: { organizationId: data.organizationId },
    });
    if (!currentStudent) {
      throw new Error("Student not found");
    }
    if (files?.["avatar"]) {
      if (currentStudent?.avatar) {
        const logoPublicId = extractPublicId(currentStudent.avatar);
        if (logoPublicId) {
          await cloudinaryService.deleteImage(logoPublicId);
        }
      }
      data.avatar = typeof data.avatar === "string" ? data.avatar : undefined;
      data.avatar = await cloudinaryService.uploadImage(files["avatar"][0], data.path);
    }
    return await studentRepository.updateStudent(data);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function deleteStudent(id: string): Promise<IStudent | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.STUDENT.INVALID_PARAMETER.REMOVE);
  }

  try {
    return await studentRepository.archiveStudent(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function searchStudent(params: any): Promise<any> {
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
      skip: params.skip * params.limit || 0,
      select: params.select || "_id",
      limit: params.limit || 10,
    };

    dbParams.options = optionsObj;
    dbParams.lean = params.lean ?? true;

    const [students, count] = await Promise.all([
      studentRepository.searchStudent(dbParams),
      params.pagination || params.count
        ? studentRepository.getStudentsCount(dbParams.query)
        : Promise.resolve(0),
    ]);

    if (!params.pagination) {
      return params.count ? { students, count } : students;
    }

    const pagination = generatePagination(count, params.skip + 1, optionsObj.limit);
    return {
      ...(params.document && { students }),
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

async function bulkImportStudent(
  csvData: any[],
  organizationId: string,
  req: any
): Promise<{
  successCount: number;
  successList: Array<{
    studentId: string;
    email: string;
    firstName: string;
    lastName: string;
  }>;
  errorCount: number;
  errorList: Array<{
    errorMessage: string;
    errorCode: number;
    row?: number;
  }>;
}> {
  if (!csvData?.length) throw new Error("Invalid CSV data");

  const successList: any[] = [];
  const errorList: any[] = [];

  const studentDataArray = await Promise.all(
    csvData.map(async (row: any) => {
      const currentYear = new Date().getFullYear();
      const plainPassword = `${row.firstName}${row.lastName}lmsapp${currentYear}`
        .toLowerCase()
        .replace(/\s+/g, "");
      const programs = await programRepository.getPrograms({
        query: { $or: [{ code: row.program }, { name: row.program }] },
      });
      const program = programs[0];

      return {
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email || `${row.firstName}.${row.lastName}@example.com`.toLowerCase(),
        studentId: row.studentId,
        password: await bcrypt.hash(plainPassword, config.BCRYPT.SALT_ROUNDS),
        organizationId,
        role: "student" as const,
        ...(program && { program: program._id as Types.ObjectId }),
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
      req.io.emit("bulkImportStart", { total: studentDataArray.length });
    }

    const result = await studentRepository.bulkCreate(studentDataArray);

    for (const student of result) {
      const successData = {
        studentId: student.studentId,
        email: student.email,
        firstName: student.firstName,
        lastName: student.lastName,
        program: student.program,
      };
      successList.push(successData);
      if (req.io) req.io.emit("bulkImportSuccessRow", successData);
    }

    if (result.length > 0) {
      await organizationRepository.updateOrganization({
        _id: organizationId,
        $push: { students: { $each: result.map((s: any) => s._id) } },
      });
    }
  } catch (error: any) {
    if (error && error.writeErrors && Array.isArray(error.writeErrors)) {
      for (const writeErr of error.writeErrors) {
        const row = writeErr.index + 1;
        const rawMsg =
          writeErr.errmsg ||
          writeErr.message ||
          error.message ||
          JSON.stringify(writeErr) ||
          "Unknown error";
        const errorData = {
          errorMessage: sanitizeDuplicateKeyError(rawMsg),
          errorCode: writeErr.code || 500,
          row,
        };
        errorList.push(errorData);
        if (req.io) req.io.emit("bulkImportErrorRow", errorData);
      }
    } else {
      const errorData = {
        errorMessage: sanitizeDuplicateKeyError(error.message || "Unknown error occurred"),
        errorCode: error.code || 500,
      };
      errorList.push(errorData);
      if (req.io) req.io.emit("bulkImportError", errorData);
    }
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

async function getStudentGradeBySection(sectionCode: string, params: any): Promise<any> {
  return getSectionStudentGradesTable(sectionCode, params);
}

async function archiveStudent(id: string): Promise<IStudent | null> {
  if (!id) {
    throw new Error("Invalid announcement ID");
  }

  try {
    const student = await studentRepository.getStudent(id, {});
    if (!student) {
      return null;
    }

    return await studentRepository.archiveStudent(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function exportStudent(params: any, organizationId: string): Promise<string> {
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
      query: { organizationId, role: "student", ...(params.query || {}) },
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

    console.log(params.select);
    const optionsObj = {
      sort: params.sort || "-createdAt",
      skip: params.skip || 0,
      select: params.select,
      populate: params.populate,
      limit: params.limit || 10,
    };
    dbParams.options = optionsObj;
    dbParams.lean = params.lean ?? true;
    const students = await studentRepository.searchStudent(dbParams);

    const flatStudents = students.map((student: any) => flattenObject(student));

    const allKeys = Array.from(
      flatStudents.reduce((keys, obj) => {
        Object.keys(obj).forEach((key) => keys.add(key));
        return keys;
      }, new Set<string>())
    ) as string[];

    const filteredKeys = allKeys.filter((key) => !key.endsWith("_id") && key !== "_id");

    const prettyHeaders = filteredKeys.map(prettifyHeader);

    const csvData = flatStudents.map((obj) => {
      const row: { [key: string]: string } = {};
      filteredKeys.forEach((key) => {
        if (
          (key.toLowerCase().includes("date") ||
            key.toLowerCase().includes("createdat") ||
            key.toLowerCase().includes("updatedat")) &&
          obj[key]
        ) {
          row[key] = new Date(obj[key]).toISOString().split("T")[0];
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
