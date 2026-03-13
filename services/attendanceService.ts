import { config } from "../config/common";
import { trimAll } from "../helper/commonHelper";
import attendanceRepository from "../repository/attendanceRepository";
import sectionRepository from "../repository/sectionRepository";
import { IAttendance } from "../models/attendanceModel";
import { QueryCondition } from "../helper/types";
import { generatePagination } from "../utils/paginationUtils";
const attendanceService = {
  getAttendance,
  getAttendances,
  createAttendance,
  updateAttendance,
  deleteAttendance,
  searchAttendance,
  getStudentAttendance,
};

export default attendanceService;

async function getAttendance(id: string, params: any): Promise<IAttendance | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.GET);
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

    if (params.select) {
      if (!Array.isArray(params.select)) {
        params.select = [params.select];
      }
      dbParams.options.select = params.select.join(" ");
    }
    if (params.lean !== undefined) {
      dbParams.options.lean = params.lean;
    }

    return await attendanceRepository.getAttendance(id, dbParams);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getStudentAttendance(studentId: string, params: any): Promise<IAttendance[] | null> {
  if (!studentId) {
    throw new Error(config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.GET);
  }

  try {
    const dbParams: any = { query: params.query || {}, options: {} };

    if (params.populateArray) {
      dbParams.options.populateArray = params.populateArray.map((item: any) => {
        if (typeof item === "string") {
          const [path, select] = item.split(":");
          return select ? { path, select: select.split(",").join(" ") } : { path };
        }
        return item;
      });
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

    return await attendanceRepository.getStudentAttendance(dbParams, studentId);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getAttendances(
  params: any
): Promise<{ attendances: IAttendance[]; pagination: any; count?: number }> {
  if (!params) {
    throw new Error(config.RESPONSE.ERROR.ATTENDANCE.INVALID_PARAMETER.GET_ALL);
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

    const [attendances, count] = await Promise.all([
      attendanceRepository.getAttendances(dbParams),
      attendanceRepository.attendanceCount(dbParams.query),
    ]);

    const pagination = generatePagination(count, page, limit);

    return {
      ...(params.document && { attendances }),
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
async function createAttendance(data: Partial<IAttendance>, user: any): Promise<IAttendance> {
  if (!data) {
    throw new Error(config.ERROR.USER.REQUIRED_FIELDS);
  }

  if (!data.section) {
    throw new Error("Section ID is required for attendance");
  }

  try {
    const trimmedData = trimAll(data);
    const currentDate = new Date();
    const startOfDay = new Date(currentDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(currentDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAttendance = await attendanceRepository.searchAttendance({
      query: {
        section: trimmedData.section,
        userId: user.id,
        date: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      },
    });

    if (existingAttendance && existingAttendance.length > 0) {
      throw new Error("You have already marked attendance for this section today");
    }

    const sectionData = await sectionRepository.getSection(trimmedData.section.toString(), {
      options: {
        lean: true,
        populateArray: [],
        select: "_id code schedule",
      },
    });

    if (!sectionData) {
      throw new Error("Section not found");
    }
    if (!sectionData.schedule) {
      throw new Error("Section schedule information is missing");
    }
    if (!sectionData.schedule.breakdown || !Array.isArray(sectionData.schedule.breakdown)) {
      throw new Error("Section schedule days information is missing or invalid");
    }
    const today = currentDate.getDay();
    const dayMap: Record<string, number> = {
      mon: 1,
      tue: 2,
      wed: 3,
      thu: 4,
      fri: 5,
      sat: 6,
      sun: 0,
    };

    const todaySchedule = sectionData.schedule.breakdown.find(
      (schedule: { day: string }) => dayMap[schedule.day.toLowerCase()] === today
    );

    if (!todaySchedule) {
      throw new Error("No class scheduled for today");
    }

    const startDate = new Date(sectionData.schedule.startDate);
    const endDate = new Date(sectionData.schedule.endDate);

    if (currentDate < startDate || currentDate > endDate) {
      throw new Error("Current date is outside the section schedule date range");
    }

    let status = "present" as (typeof config.ENUM.ATTENDANCE.STATUS)[number];

    const [startTime, startPeriod] = todaySchedule.time.start.split(" ");
    const [startHour, startMinute] = startTime.split(":").map(Number);

    let start24Hour = startHour;
    if (startPeriod?.toUpperCase() === "PM" && startHour < 12) {
      start24Hour += 12;
    } else if (startPeriod?.toUpperCase() === "AM" && startHour === 12) {
      start24Hour = 0;
    }

    const scheduleStartTime = new Date();
    scheduleStartTime.setHours(start24Hour, startMinute, 0, 0);
    if (currentDate > scheduleStartTime) {
      const lateThresholdMinutes = 15;
      const diffInMinutes = Math.floor(
        (currentDate.getTime() - scheduleStartTime.getTime()) / (1000 * 60)
      );

      if (diffInMinutes > lateThresholdMinutes) {
        status = "late" as (typeof config.ENUM.ATTENDANCE.STATUS)[number];
      }
    }

    const userRole = user.role.toLowerCase();
    const userType = userRole === "instructor" ? "instructor" : "student";

    const newAttendance = await attendanceRepository.createAttendance({
      ...trimmedData,
      userId: user.id,
      userType: userType,
      date: currentDate,
      status: status,
    });

    return newAttendance;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function updateAttendance(
  data: { _id: string } & Partial<Omit<IAttendance, "_id">>
): Promise<IAttendance | null> {
  if (!data || !data._id) {
    throw new Error(config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.UPDATE);
  }

  try {
    return await attendanceRepository.updateAttendance(data);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function deleteAttendance(id: string): Promise<IAttendance | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.REMOVE);
  }

  try {
    return await attendanceRepository.deleteAttendance(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function searchAttendance(params: any): Promise<any> {
  try {
    const dbParams = {
      query: {},
      populateArray: [],
      options: {},
      lean: true,
      match: {},
    };

    dbParams.query = params.query || {};

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
    const [attendances, count] = await Promise.all([
      attendanceRepository.searchAttendance(dbParams),
      params.pagination || params.count
        ? attendanceRepository.attendanceCount(dbParams.query)
        : Promise.resolve(0),
    ]);

    if (!params.pagination) {
      return params.count ? { attendances, count } : attendances;
    }

    const pagination = generatePagination(count, skip + 1, optionsObj.limit);
    return {
      ...(params.document && { attendances }),
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
