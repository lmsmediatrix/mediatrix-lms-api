import * as bcrypt from "bcrypt";
import { config } from "../config/common";
import { trimAll } from "../helper/commonHelper";
import { IUser } from "../models/userModel";
import userRepository from "../repository/userRepository";
import { CustomRequest } from "../type/types";
import { generateToken } from "../utils/token";
import organizationRepository from "../repository/organizationRepository";
import cloudinaryService from "./cloudinaryService";
import { QueryCondition } from "../helper/types";
import {
  getMetricComparison,
  getTeacherStudentRatioComparison,
  getDateRange,
} from "../helper/service/metricsUtil";
import { generatePagination } from "../utils/paginationUtils";

const userService = {
  getUser,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  loginUser,
  logoutUser,
  currentUser,
  searchUser,
  cleanUpInactiveUsers,
  getUserMetrics,
  bulkCreate,
  archiveUser,
  resetPassword,
};

export default userService;

async function getUser(id: string, params: any): Promise<IUser | null> {
  if (!id) {
    throw new Error(config.ERROR.USER.NO_ID);
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

    return await userRepository.getUser(id, dbParams);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getUsers(params: any): Promise<{ users: IUser[]; pagination: any; count?: number }> {
  if (!params) {
    throw new Error(config.RESPONSE.ERROR.USER.INVALID_PARAMETER.GET_ALL);
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

    if (params.query && params.query.organizationId) {
      dbParams.query.organizationId = params.query.organizationId;
    } else {
      return { users: [], pagination: {} };
    }

    const page = params.page || 1;
    const limit = params.limit || 10;

    const [users, count] = await Promise.all([
      userRepository.getUsers(dbParams),
      userRepository.countUsers(dbParams.query),
    ]);

    const pagination = generatePagination(count, page, limit);

    return {
      ...(params.document && { users }),
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

async function createUser(
  data: Partial<IUser>,
  files?: { [fieldname: string]: Express.Multer.File[] }
): Promise<IUser> {
  if (!data) {
    throw new Error(config.ERROR.USER.REQUIRED_FIELDS);
  }

  try {
    const trimmedData = trimAll(data);
    const { email, password, organizationId, role, ...otherData } = trimmedData;
    const existingUser = await userRepository.searchAndUpdate({ email });
    if (existingUser) {
      throw new Error(config.ERROR.USER.ALREADY_EXIST);
    }

    if (files && files["avatar"]) {
      trimmedData.avatar = trimmedData.avatar || {};
      trimmedData.avatar = await cloudinaryService.uploadImage(
        files["avatar"][0],
        `${otherData.path}`
      );
    }

    const hashedPassword = await bcrypt.hash(password!, config.BCRYPT.SALT_ROUNDS);

    const newUser = await userRepository.createUser({
      ...otherData,
      email,
      password: hashedPassword,
      organizationId,
      role,
      avatar: trimmedData.avatar,
    });
    if (role === "admin" && organizationId) {
      await organizationRepository.updateOrganization({
        _id: organizationId,
        $push: { admins: newUser._id },
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

async function updateUser(
  data: Partial<IUser> & { path?: string; oldPassword?: string; newPassword?: string },
  files?: { [fieldname: string]: Express.Multer.File[] }
): Promise<IUser | null> {
  const userId = data._id?.toString();
  if (!userId) {
    throw new Error(config.ERROR.USER.INVALID_ID);
  }
  const extractPublicId = (url: string) => {
    const regex = /\/upload\/v\d+\/(.+)\.\w+$/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };
  try {
    const currentUser = await userService.getUser(userId, {
      select: ["avatar", "password"],
      query: { organizationId: data.organizationId },
    });
    if (!currentUser) {
      throw new Error(config.ERROR.USER.NOT_FOUND);
    }
    if (files?.["avatar"]) {
      if (currentUser?.avatar) {
        const logoPublicId = extractPublicId(currentUser.avatar);
        if (logoPublicId) {
          await cloudinaryService.deleteImage(logoPublicId);
        }
      }
      data.avatar = typeof data.avatar === "string" ? data.avatar : undefined;
      data.avatar = await cloudinaryService.uploadImage(files["avatar"][0], data.path);
    }
    const trimmedData = trimAll(data);
    if (trimmedData.password) {
      trimmedData.password = await bcrypt.hash(trimmedData.password, config.BCRYPT.SALT_ROUNDS);
    }

    if (data.oldPassword && data.newPassword && currentUser?.password) {
      if (data.oldPassword === data.newPassword) {
        throw new Error(config.ERROR.USER.SAME_PASSWORD);
      }
      const isOldPasswordValid = await bcrypt.compare(data.oldPassword, currentUser.password);
      if (!isOldPasswordValid) {
        throw new Error(config.ERROR.USER.INVALID_OLD_PASSWORD);
      }
      trimmedData.password = await bcrypt.hash(data.newPassword, config.BCRYPT.SALT_ROUNDS);
      trimmedData.isPasswordChanged = true;
      trimmedData.passwordChangedAt = new Date();
    } else if (trimmedData.password) {
      trimmedData.password = await bcrypt.hash(trimmedData.password, config.BCRYPT.SALT_ROUNDS);
      trimmedData.isPasswordChanged = true;
      trimmedData.passwordChangedAt = new Date();
    }

    delete trimmedData._id;
    delete trimmedData.oldPassword;
    delete trimmedData.newPassword;

    trimmedData.lastActive = new Date();

    const newData = await userRepository.updateUser(userId, trimmedData);
    return newData;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function deleteUser(id: string): Promise<IUser | null> {
  if (!id) {
    throw new Error(config.ERROR.USER.NO_ID);
  }

  try {
    return await userRepository.archiveUser(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function loginUser(credentials: { email: string; password: string }) {
  try {
    const user = await userRepository.searchAndUpdate({ email: credentials.email });
    if (!user || !("archive" in user)) {
      throw new Error(config.ERROR.USER.NO_ACCOUNT);
    }
    if (user.archive?.status === true) {
      throw new Error(config.ERROR.USER.ARCHIVED);
    }

    if (!("password" in user)) {
      throw new Error(config.RESPONSE.ERROR.USER.INVALID_PARAMETER.LOGIN);
    }

    const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
    if (!isPasswordValid) {
      throw new Error(config.ERROR.USER.INVALID_CREDENTIALS);
    }

    if (user.status === "deactivated") {
      throw new Error(config.ERROR.USER.DEACTIVATED);
    }

    const currentDate = new Date();
    await userRepository.searchAndUpdate(
      { _id: user._id },
      { $set: { lastActive: currentDate, lastLogin: currentDate } }
    );
    const tokenUser = {
      id: user.id,
      email: user.email,
      firstname: user.firstName,
      lastname: user.lastName,
      role: user.role,
      avatar: user.avatar,
      organizationId: user.organizationId?.toString(),
      isPasswordChanged: user.isPasswordChanged,
    };

    const token = generateToken(tokenUser);

    return {
      user: tokenUser,
      token,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function logoutUser(req: CustomRequest): Promise<void> {
  try {
    if (!req.user) {
      throw new Error(config.ERROR.USER.NOT_AUTHORIZED);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function currentUser(req: CustomRequest) {
  if (!req.user || !req.user.id) {
    throw new Error(config.ERROR.USER.NOT_AUTHORIZED);
  }

  try {
    const user = await userRepository.getUser(req.user.id, {
      options: {
        select: "-password -__v",
        populateArray: [{ path: "organizationId", select: "name code branding type" }],
      },
    });

    if (!user) {
      throw new Error(config.ERROR.USER.NOT_FOUND);
    }

    return {
      user: {
        id: req.user.id,
        email: user.email,
        firstname: user.firstName,
        lastname: user.lastName,
        avatar: user.avatar,
        status: user.status,
        role: user.role,
        organization: user.organizationId,
        isPasswordChanged: user.isPasswordChanged,
      },
    };
  } catch (error) {
    console.error("Error fetching current user:", error);
    throw new Error(config.ERROR.USER.NOT_AUTHORIZED);
  }
}

async function searchUser(params: any): Promise<any> {
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

    const [users, count] = await Promise.all([
      userRepository.searchUser(dbParams),
      params.pagination || params.count
        ? userRepository.countUsers(dbParams.query)
        : Promise.resolve(0),
    ]);

    if (!params.pagination) {
      return params.count ? { users, count } : users;
    }

    const pagination = generatePagination(count, optionsObj.skip + 1, optionsObj.limit);
    return {
      ...(params.document && { users }),
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

async function cleanUpInactiveUsers(): Promise<void> {
  try {
    const now = new Date();

    const deactivateSince = new Date(now);
    deactivateSince.setMonth(
      deactivateSince.getMonth() - config.CRON.CLEAN_UP.INACTIVE_USERS_DEACTIVATE_THRESHOLD
    );

    await userRepository.searchAndUpdate(
      { lastActive: { $lt: deactivateSince } },
      { $set: { status: "deactivated" } },
      { multi: true }
    );

    const archiveSince = new Date(now);
    archiveSince.setFullYear(
      archiveSince.getFullYear() - config.CRON.CLEAN_UP.INACTIVE_USERS_ARCHIVE_THRESHOLD
    );

    await userRepository.searchAndUpdate(
      { lastActive: { $lt: archiveSince } },
      { $set: { status: "archived" } },
      { multi: true }
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getUserMetrics(organizationId: string, filter: string, type: string): Promise<any> {
  try {
    const { currentStart, currentEnd, previousStart, previousEnd } = getDateRange(filter);

    const [currentMetrics, previousMetrics] = await Promise.all([
      userRepository.getUserMetrics(organizationId, currentStart, currentEnd),
      userRepository.getUserMetrics(organizationId, previousStart, previousEnd),
    ]);

    if (type === "instructor") {
      return {
        fullTime: getMetricComparison(
          currentMetrics?.fullTimeCount ?? 0,
          previousMetrics?.fullTimeCount ?? 0
        ),
        partTime: getMetricComparison(
          currentMetrics?.partTimeCount ?? 0,
          previousMetrics?.partTimeCount ?? 0
        ),
        probationary: getMetricComparison(
          currentMetrics?.probationaryCount ?? 0,
          previousMetrics?.probationaryCount ?? 0
        ),
        instructor: getMetricComparison(
          currentMetrics?.instructorCount ?? 0,
          previousMetrics?.instructorCount ?? 0
        ),
        teacherStudentRatio: getTeacherStudentRatioComparison(
          currentMetrics?.teacherStudentRatio ?? 0,
          previousMetrics?.teacherStudentRatio ?? 0
        ),
      };
    } else if (type === "student") {
      return {
        studentCount: getMetricComparison(
          currentMetrics?.studentCount ?? 0,
          previousMetrics?.studentCount ?? 0
        ),
        activeStudent: getMetricComparison(
          currentMetrics?.activeStudentCount ?? 0,
          previousMetrics?.activeStudentCount ?? 0
        ),
        inactiveStudent: getMetricComparison(
          currentMetrics?.inactiveStudentCount ?? 0,
          previousMetrics?.inactiveStudentCount ?? 0
        ),
      };
    }

    throw new Error("Invalid type specified. Must be either 'instructor' or 'student'");
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error(String(error));
  }
}

async function bulkCreate(
  csvData: any[],
  organizationId: string
): Promise<{
  successCount: number;
  successList: Array<{ userId: string; email: string; firstName: string; lastName: string }>;
  errorCount: number;
  errorList: Array<{ errorMessage: string; errorCode: number }>;
}> {
  if (!csvData?.length) throw new Error("Invalid CSV data");

  const successList: any[] = [];
  const errorList: any[] = [];

  const prepareUserData = async (row: any) => {
    const currentYear = new Date().getFullYear();
    const plainPassword = `${row.firstName}${row.lastName}lmsapp${currentYear}`
      .toLowerCase()
      .replace(/\s+/g, "");
    return {
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email || `${row.firstName}.${row.lastName}@domain.com`.toLowerCase(),
      password: await bcrypt.hash(plainPassword, config.BCRYPT.SALT_ROUNDS),
      organizationId,
      role: row.role || "user",
      ...(row.role === "student" && { program: row.program, studentId: row.studentId }),
      ...(row.role === "instructor" && { faculty: row.faculty }),
    };
  };

  const updateOrganization = async (user: IUser) => {
    const field =
      user.role === "admin"
        ? "admins"
        : user.role === "student"
          ? "students"
          : user.role === "instructor"
            ? "instructors"
            : null;

    if (field) {
      await organizationRepository.updateOrganization({
        _id: organizationId,
        $push: { [field]: user._id },
      });
    }
  };

  try {
    const userDataArray = await Promise.all(csvData.map(prepareUserData));

    for (const userData of userDataArray) {
      try {
        const user = await userRepository.createUser(userData);
        await updateOrganization(user);
        successList.push({
          userId: user._id.toString(),
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        });
      } catch (error: any) {
        errorList.push({
          errorMessage:
            error.code === 11000
              ? `Duplicate email: "${userData.email}"`
              : error.message || "Unknown error",
          errorCode: error.code || 500,
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

async function archiveUser(id: string): Promise<IUser | null> {
  if (!id) {
    throw new Error("Invalid announcement ID");
  }

  try {
    const student = await userRepository.getUser(id, {});
    if (!student) {
      return null;
    }

    return await userRepository.archiveUser(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

export async function resetPassword(
  id: string,
  firstName: string,
  lastName: string
): Promise<IUser | null> {
  if (!id || !firstName || !lastName) {
    throw new Error("id, firstName, and lastName are required");
  }
  const user = await userRepository.getUser(id, {});
  if (!user) {
    return null;
  }
  const currentYear = new Date().getFullYear();
  const plainPassword = `${firstName}${lastName}lmsapp${currentYear}`
    .toLowerCase()
    .replace(/\s+/g, "");
  const hashedPassword = await bcrypt.hash(plainPassword, config.BCRYPT.SALT_ROUNDS);

  const updatedUser = await userRepository.updateUser(id, {
    password: hashedPassword,
    isPasswordChanged: false,
  });
  return updatedUser;
}
