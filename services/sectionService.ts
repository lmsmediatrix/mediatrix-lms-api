import { config } from "../config/common";
import { trimAll } from "../helper/commonHelper";
import sectionRepository from "../repository/sectionRepository";
import studentRepository from "../repository/studentRepository";
import { ISection } from "../models/sectionModel";
import { FilterQuery } from "mongoose";
import { UpdateQuery } from "mongoose";
import { QueryCondition } from "../helper/types";
import { generatePagination } from "../utils/paginationUtils";
import { getGradeLabel, formatPercentage, formatGradeLabel } from "../helper/service/gradeUtils";
import instructorRepository from "../repository/instructorRepository";
import studentAssessmentGradeRepository from "../repository/studentAssessmentGradeRepository";
import attendanceRepository from "../repository/attendanceRepository";
import gradeRepository from "../repository/gradeRepository";
import { arrayToCSV } from "../utils/csvUtils/csvWriter";
import mongoose from "mongoose";
import { getSectionStudentGradesTable } from "../helper/service/gradeUtils";
import userService from "./userService";
import { flattenObject, prettifyHeader } from "../utils/csvUtils/csvResponse";

const sectionService = {
  getSection,
  getSections,
  createSection,
  updateSection,
  deleteSection,
  searchSection,
  markAttendance,
  getSectionAttendance,
  bulkAddStudents,
  archiveSection,
  getSectionAssessment,
  getStudentGrades,
  getSectionStudentGradesAnalytics,
  exportSection,
  removeStudentFromSection,
  generateCode,
  updateAttendanceStatus,
  getSectionModules,
  getSectionAnnouncements,
  getSectionStudents,
  exportSectionStudents,
  exportSectionStudentGrades,
  getSectionGradeSystem,
  getSectionByCode,
  addStudentsToSectionByCode,
  getSectionSchedule,
};

export default sectionService;

async function getSection(idOrCode: string, params: any): Promise<ISection | null> {
  if (!idOrCode) {
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
    if (params.query && params.query.organizationId) {
      dbParams.query.organizationId = params.query.organizationId;
    } else {
      return null;
    }

    return await sectionRepository.getSection(idOrCode, dbParams);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}
async function getSections(
  params: any
): Promise<{ sections: ISection[]; pagination: any; count?: number }> {
  if (!params) {
    throw new Error(config.RESPONSE.ERROR.SECTION.INVALID_PARAMETER.GET_ALL);
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
      return { sections: [], pagination: {} };
    }

    const page = params.page || 1;
    const limit = params.limit || 10;

    const [sections, count] = await Promise.all([
      sectionRepository.getSections(dbParams),
      sectionRepository.getSectionCount(dbParams.query),
    ]);
    const pagination = generatePagination(count, page, limit);

    return {
      sections,
      pagination,
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

async function createSection(data: Partial<ISection>, user?: any): Promise<ISection> {
  if (!data) {
    throw new Error(config.ERROR.USER.REQUIRED_FIELDS);
  }

  try {
    const trimmedData = trimAll(data);

    if (!user || !user.organizationId) {
      throw new Error("User not authenticated or missing organization");
    }

    const newSection = await sectionRepository.createSection({
      ...trimmedData,
      organizationId: user.organizationId,
    });

    return newSection;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function updateSection(data: Partial<ISection>): Promise<ISection | null> {
  if (!data) {
    throw new Error(config.RESPONSE.ERROR.SECTION.INVALID_PARAMETER.UPDATE);
  }

  try {
    const filter: FilterQuery<ISection> = data._id ? { _id: data._id } : { code: data.code };
    const update: UpdateQuery<ISection> = { ...data };
    const updatedSection = await sectionRepository.updateSection(filter, update);

    return updatedSection;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function deleteSection(id: string): Promise<ISection | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.SECTION.INVALID_PARAMETER.REMOVE);
  }

  try {
    return await sectionRepository.archiveSection(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function searchSection(params: any): Promise<any> {
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

    let numericLimit = 10;
    if (params.limit !== undefined) {
      const parsedLimit = parseInt(String(params.limit), 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        numericLimit = parsedLimit;
      }
    }

    let skip = 0;
    if (params.skip !== undefined) {
      const parsedSkip = parseInt(String(params.skip), 10);
      if (!isNaN(parsedSkip) && parsedSkip >= 0) {
        skip = parsedSkip * numericLimit;
      }
    }

    if (params.populateArray) {
      dbParams["populateArray"] = params.populateArray.map((item: any) => {
        if (typeof item === "object" && item.path === "assessments") {
          const assessmentItemLimitRaw =
            item.limit === undefined ? 10 : parseInt(String(item.limit), 10);
          const validAssessmentItemLimit =
            !isNaN(assessmentItemLimitRaw) && assessmentItemLimitRaw > 0
              ? assessmentItemLimitRaw
              : 10;

          let assessmentItemSkip = 0;
          if (item.skip !== undefined) {
            const parsedSkip = parseInt(String(item.skip), 10);
            if (!isNaN(parsedSkip) && parsedSkip >= 0) {
              assessmentItemSkip = parsedSkip * validAssessmentItemLimit;
            }
          }

          return {
            ...item,
            countPending: true,
            skip: assessmentItemSkip,
          };
        }
        if (typeof item === "object" && item.pagination) {
          const itemLimit = item.limit || 10;
          const itemSkip = item.skip || 0;
          return {
            ...item,
            limit: itemLimit,
            skip: itemSkip,
            countPending: true,
          };
        }
        return item;
      });
    }

    const optionsObj = {
      sort: params.sort || "-createdAt",
      skip: skip,
      select: params.select || "_id",
      limit: numericLimit,
    };

    dbParams.options = optionsObj;
    dbParams.lean = params.lean ?? true;
    const [sections, count] = await Promise.all([
      sectionRepository.searchSection(dbParams),
      params.count || params.pagination ? sectionRepository.getSectionCount(dbParams.query) : 0,
    ]);

    if (sections?.length > 0) {
      for (const section of sections) {
        if (section._paginations) {
          Object.keys(section._paginations).forEach((fieldPath) => {
            const fieldData = (section as any)[fieldPath];
            const fieldPagination = section._paginations[fieldPath];

            if (Array.isArray(fieldData)) {
              (section as any)[fieldPath] = {
                data: fieldData,
                pagination: fieldPagination,
              };
            }
          });

          delete section._paginations;
        }
      }

      const response = {
        sections,
        pagination: params.pagination
          ? generatePagination(count, skip / numericLimit + 1, numericLimit)
          : undefined,
        count: params.count ? count : undefined,
      };

      return Object.fromEntries(Object.entries(response).filter(([_, v]) => v !== undefined));
    }

    if (!params.pagination) {
      return params.count ? { sections, count } : sections;
    }

    const pagination = generatePagination(count, skip / numericLimit + 1, numericLimit);

    return {
      ...(params.document && { sections }),
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

async function markAttendance(sectionId: string, user: any, remarks?: string): Promise<any[]> {
  if (!sectionId) {
    throw new Error("Section ID is required");
  }

  if (!user || !user.id) {
    throw new Error("User information is required");
  }

  try {
    const sectionData = await sectionRepository.getSection(sectionId, {
      options: {
        lean: true,
        select: "_id code schedule attendance organizationId",
      },
    });

    if (!sectionData) {
      throw new Error("Section not found");
    }

    if (user.organizationId && sectionData.organizationId) {
      if (user.organizationId.toString() !== sectionData.organizationId.toString()) {
        throw new Error("You don't have access to this section");
      }
    }

    const currentDate = new Date();

    if (sectionData.attendance && Array.isArray(sectionData.attendance)) {
      const startOfDay = new Date(currentDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(currentDate);
      endOfDay.setHours(23, 59, 59, 999);

      const existingAttendance = sectionData.attendance.find(
        (record: { userId: mongoose.Types.ObjectId | string; date: Date }) =>
          record.userId.toString() === user.id.toString() &&
          new Date(record.date) >= startOfDay &&
          new Date(record.date) <= endOfDay
      );

      if (existingAttendance) {
        throw new Error("You have already marked attendance for this section today");
      }
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

    const attendanceRecord = {
      userId: user.id,
      userType: userType,
      date: currentDate,
      status: status,
      remarks: remarks || "",
    };

    const updatedSection = await sectionRepository.updateSection(
      { _id: sectionId },
      { $push: { attendance: attendanceRecord } }
    );

    if (updatedSection && updatedSection.attendance && updatedSection.attendance.length > 0) {
      return [updatedSection.attendance[updatedSection.attendance.length - 1]];
    }

    return [];
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getSectionAttendance(
  sectionCode: string,
  fromDate?: string,
  toDate?: string,
  user?: any
): Promise<{ data: any; totalEnrolled: number }> {
  if (!sectionCode) {
    throw new Error("Section code is required");
  }

  try {
    const startDate = fromDate ? new Date(fromDate) : new Date();
    const endDate = toDate ? new Date(toDate) : undefined;
    if (fromDate && toDate) {
      if (isNaN(startDate.getTime()) || (endDate && isNaN(endDate.getTime()))) {
        throw new Error("Invalid date format. Please use YYYY-MM-DD format.");
      }
    }

    if (!user || !user.id) {
      throw new Error("User not authenticated");
    }
    const sectionParams = {
      query: {
        code: sectionCode,
        "archive.status": { $ne: true },
      },
      options: {
        lean: true,
        select: "_id code students instructor organizationId",
      },
    };

    const sections = await sectionRepository.getSections(sectionParams);

    if (sections.length === 0) {
      throw new Error("Section not found");
    }

    const section = sections[0];
    const isInstructor = user.role === "instructor";
    const isStudent = user.role === "student";
    const isAdmin = user.role === "admin" || user.role === "superadmin";

    if (!isInstructor && !isStudent && !isAdmin) {
      throw new Error("User is not authorized to view this section's attendance");
    }
    if (isStudent) {
      const studentExists =
        section.students &&
        Array.isArray(section.students) &&
        section.students.some((studentId) => studentId.toString() === user.id);

      if (!studentExists) {
        throw new Error("Student does not belong to this section");
      }
    }
    if (isInstructor) {
      const isAssignedInstructor = section.instructor && section.instructor.toString() === user.id;

      if (!isAssignedInstructor) {
        throw new Error("Instructor is not assigned to this section");
      }
    }
    const result = await sectionRepository.getSectionAttendance(
      sectionCode,
      startDate,
      user.organizationId,
      isStudent ? user.id : undefined,
      endDate
    );
    if (result.data && result.data.students) {
      result.data.data = result.data.students;
      delete result.data.students;
    }

    return result;
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes("not authorized") ||
        error.message.includes("does not belong") ||
        error.message.includes("not assigned")
      ) {
        throw new Error(error.message);
      }
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getSectionAssessment(
  sectionCode: string,
  user?: any,
  params?: any
): Promise<{
  newAssessmentCount?: number;
  newAssessmentId?: string[];
  assessment?: any[];
  pagination?: any;
  count?: number;
}> {
  if (!sectionCode) {
    throw new Error("Section code is required");
  }

  try {
    if (!user || !user.id) {
      throw new Error("User not authenticated");
    }

    const limit = parseInt(params?.limit) || 10;
    const skip = parseInt(params?.skip) || 0;

    let pendingAssessment = 0;
    let assessmentId: string[] = [];
    let assessmentsData: any[] = [];
    let totalItems = 0;

    const needsDocument = params?.document === true;
    const needsPagination = params?.pagination === true;
    const needsCount = params?.count === true || needsPagination;
    const needsPendingAssessment = params?.pendingAssessment === true;
    const needsAssessmentId = params?.assessmentId === true;

    const queries: Promise<any>[] = [];

    const sectionQuery = sectionRepository.getSection(sectionCode, {
      query: {
        ...(user.organizationId ? { organizationId: user.organizationId } : {}),
        "archive.status": { $ne: true },
      },
      options: { lean: true, select: "_id" },
    });
    queries.push(sectionQuery);

    if (needsDocument) {
      const assessmentQuery = sectionRepository.searchSection({
        query: {
          code: sectionCode,
          ...(user.organizationId ? { organizationId: user.organizationId } : {}),
          "archive.status": { $ne: true },
        },
        select: "assessments",
        populateArray: [
          {
            path: "assessments",
            select: "_id title type endDate startDate numberOfItems totalPoints assessmentNo",
          },
        ],
        lean: true,
      });
      queries.push(assessmentQuery);
    } else {
      queries.push(Promise.resolve(null));
    }

    if (needsPendingAssessment || needsAssessmentId) {
      const pendingQuery = sectionRepository.getSectionAssessment(sectionCode, user.id);
      queries.push(pendingQuery);
    } else {
      queries.push(Promise.resolve({ pendingAssessment: 0, assessmentId: [] }));
    }

    const [section, assessmentSection, pendingResult] = await Promise.all(queries);

    if (!section) {
      throw new Error("Section not found");
    }

    if (needsDocument && assessmentSection && assessmentSection.length > 0) {
      const allAssessments = assessmentSection[0]?.assessments || [];
      totalItems = allAssessments.length;
      assessmentsData = allAssessments.slice(skip, skip + limit);
    }

    if (needsCount && !needsDocument) {
      const countQuery = await sectionRepository.getSection(sectionCode, {
        options: { select: "assessments", lean: true },
      });
      totalItems = countQuery?.assessments?.length || 0;
    }

    if ((needsPendingAssessment || needsAssessmentId) && pendingResult) {
      pendingAssessment = pendingResult.pendingAssessment;
      assessmentId = pendingResult.assessmentId;
    }

    let pagination;
    if (needsPagination) {
      const totalPages = Math.ceil(totalItems / limit);
      const currentPage = skip / limit + 1;

      pagination = {
        totalItems,
        totalPages,
        currentPage,
        pageSize: limit,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
      };
    }

    const response: {
      newAssessmentCount?: number;
      newAssessmentId?: string[];
      assessment?: any[];
      pagination?: any;
      count?: number;
    } = {};

    if (needsPendingAssessment) response.newAssessmentCount = pendingAssessment;
    if (needsAssessmentId) response.newAssessmentId = assessmentId;
    if (needsDocument) response.assessment = assessmentsData;
    if (needsPagination) response.pagination = pagination;
    if (needsCount) response.count = totalItems;

    return response;
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes("not authorized") ||
        error.message.includes("does not belong") ||
        error.message.includes("not assigned")
      ) {
        throw new Error(error.message);
      }
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function bulkAddStudents(
  sectionCode: string,
  userIds: string[]
): Promise<{
  section: ISection | null;
  results: {
    success: string[];
    errors: {
      [x: string]: any;
      id: string;
      message: string;
    }[];
  };
}> {
  if (!sectionCode || !userIds || userIds.length === 0) {
    throw new Error("Section code and user IDs are required");
  }

  try {
    const trimmedUserIds = userIds.map((id) => id.trim());
    const response = await sectionRepository.bulkAddStudents(sectionCode, trimmedUserIds);

    if (!response.section) {
      throw new Error("Failed to bulk add students to section");
    }

    return response;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function archiveSection(id: string): Promise<ISection | null> {
  if (!id) {
    throw new Error("Invalid announcement ID");
  }

  try {
    const section = await sectionRepository.getSection(id, {});
    if (!section) {
      return null;
    }

    return await sectionRepository.archiveSection(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getStudentGrades(sectionCode: string, studentId: string): Promise<any> {
  if (!sectionCode) {
    throw new Error("Section code is required");
  }

  if (!studentId) {
    throw new Error("Student ID is required");
  }

  try {
    const section = await sectionRepository.getSection(sectionCode, {
      options: {
        populateArray: [
          {
            path: "assessments",
            select: "_id title type endDate numberOfItems totalPoints gradeMethod passingScore",
          },
          { path: "grade" },
        ],
        lean: true,
      },
    });

    if (!section) {
      throw new Error("Section not found");
    }

    const assessmentIds = section.assessments?.map((assessment) => assessment._id) || [];
    if (assessmentIds.length === 0) {
      return [];
    }

    const student = await studentRepository.getStudent(studentId, {
      options: {
        select: "_id studentAssessmentResults",
        lean: true,
      },
    });

    if (!student) {
      throw new Error("Student not found");
    }

    const allAssessmentsMap = new Map();
    const now = new Date();
    section.assessments?.forEach((assessment: any) => {
      const assessmentId = assessment._id.toString();
      const isOverdue = assessment.endDate && new Date(assessment.endDate) < now;
      if (isOverdue) {
        allAssessmentsMap.set(assessmentId, {
          assessmentId: assessment._id,
          assessmentType: assessment.type || "unknown",
          points: `0/${assessment.totalPoints || assessment.numberOfItems || 0}`,
          endDate: assessment.endDate || new Date().toISOString(),
          status: "overdue",
          percentage: "0%",
          grade: "5",
          isPassed: false,
        });
      } else {
        allAssessmentsMap.set(assessmentId, {
          assessmentId: assessment._id,
          assessmentType: assessment.type || "unknown",
          points: "--",
          endDate: assessment.endDate || new Date().toISOString(),
          status: "not started",
          percentage: "--",
          grade: "--",
          isPassed: false,
        });
      }
    });

    if (student.studentAssessmentResults?.length) {
      // Fetch all StudentAssessmentGrade records for this student in one query
      const sagRecords = await studentAssessmentGradeRepository.getStudentAssessmentGrades({
        query: {
          studentId: student._id,
          assessmentId: { $in: assessmentIds },
          isDeleted: { $ne: true },
        },
        options: { select: "assessmentId gradeLabel", lean: true },
      });
      const sagMap = new Map(
        sagRecords.map((r: any) => [r.assessmentId.toString(), r.gradeLabel || "--"])
      );

      const assessmentResults = student.studentAssessmentResults.filter(
        (result) =>
          assessmentIds.some((id) => id.toString() === result.assessmentId.toString()) &&
          !result.isDeleted
      );

      assessmentResults.forEach((result) => {
        const assessmentId = result.assessmentId.toString();
        if (allAssessmentsMap.has(assessmentId)) {
          const assessment = section.assessments.find(
            (a: any) => a._id.toString() === assessmentId
          );

          const studentScore = result.totalScore;
          const attemptTotalPoints = result.totalPoints;

          let pointsString: string;
          let calculatedPercentage: number;

          if (typeof attemptTotalPoints === "number" && typeof studentScore === "number") {
            if (attemptTotalPoints > 0) {
              pointsString = `${studentScore}/${attemptTotalPoints}`;
              calculatedPercentage = (studentScore / attemptTotalPoints) * 100;
            } else {
              pointsString = `${studentScore}/${attemptTotalPoints}`;
              calculatedPercentage = studentScore === 0 ? 0 : 100;
            }
          } else {
            pointsString = `${studentScore ?? "N/A"}/${attemptTotalPoints ?? "N/A"}`;
            calculatedPercentage = 0;
          }

          if (
            typeof attemptTotalPoints === "number" &&
            attemptTotalPoints >= 1 &&
            attemptTotalPoints <= 10 &&
            calculatedPercentage < 100 &&
            calculatedPercentage > 50
          ) {
            const boostFactor = 5 * (1 - (attemptTotalPoints - 1) / 10);
            calculatedPercentage = Math.min(100, calculatedPercentage + boostFactor);
          }

          const assessmentTypeWithNumber =
            result.type && result.assessmentNo
              ? `${result.type} ${result.assessmentNo}`
              : result.type || "unknown";

          const sagGrade = sagMap.get(assessmentId);
          // Per-assessment grade = numeric percentage score (e.g. "100", "96.5")
          // The gradingScale (1.0, 1.5, A, B+) is only used for the final section grade
          // For manual assessments graded by instructor via SAG, use their assigned gradeLabel
          let gradeLabel: string;
          if (sagGrade && sagGrade !== "--") {
            // Instructor explicitly graded this (manual/mixed)
            gradeLabel = sagGrade;
          } else if (result.isFinished) {
            // Auto-graded: show numeric percentage
            gradeLabel = formatPercentage(calculatedPercentage).replace("%", "").trim();
          } else {
            gradeLabel = "--";
          }

          allAssessmentsMap.set(assessmentId, {
            assessmentId: result.assessmentId,
            assessmentType: assessmentTypeWithNumber,
            points: pointsString,
            endDate: (assessment as any)?.endDate || new Date().toISOString(),
            status: result.isFinished ? "done" : "pending",
            percentage: formatPercentage(calculatedPercentage),
            grade: gradeLabel,
            isPassed: result.isPassed,
          });
        }
      });
    }
    const result = Array.from(allAssessmentsMap.values());
    let percentageSum = 0,
      percentageCount = 0;

    for (const assessment of result) {
      const pct = parseFloat(assessment.percentage);
      if (!isNaN(pct)) {
        percentageSum += pct;
        percentageCount++;
      }
    }

    const average =
      percentageCount > 0 ? parseFloat((percentageSum / percentageCount).toFixed(2)) : null;

    // ── Final weighted grade computation ─────────────────────────────────────
    let finalGrade: any = null;
    const gradeRubric = (section as any).grade as any;

    if (
      gradeRubric &&
      Array.isArray(gradeRubric.gradeDistribution) &&
      gradeRubric.gradeDistribution.length > 0 &&
      Array.isArray(gradeRubric.gradingScale) &&
      gradeRubric.gradingScale.length > 0
    ) {
      // 1. Attendance percentage for this student in this section
      const attendanceRecords = await attendanceRepository.getStudentAttendance(
        {
          query: { section: section._id, "archive.status": { $ne: true } },
          options: { select: "status", lean: true, limit: 10000 },
        },
        studentId
      );
      const totalSessions = attendanceRecords.length;
      const attendedSessions = attendanceRecords.filter(
        (r: any) => r.status === "present" || r.status === "excused" || r.status === "late"
      ).length;
      // null = no sessions yet (treated as missing data, not 0% — avoids skewing the weighted total)
      const attendancePercentage: number | null =
        totalSessions > 0
          ? parseFloat(((attendedSessions / totalSessions) * 100).toFixed(2))
          : null;

      // 2. Build per-type average map from computed assessment results
      const typeAvgMap = new Map<string, { sum: number; count: number }>();
      let allSum = 0,
        allCount = 0;

      for (const a of result) {
        const pct = parseFloat(a.percentage);
        if (!isNaN(pct)) {
          // assessmentType looks like "quiz 1", "exam 2" — take the first word as type
          const rawType = (a.assessmentType || "").toLowerCase().split(" ")[0].trim();
          if (!typeAvgMap.has(rawType)) typeAvgMap.set(rawType, { sum: 0, count: 0 });
          typeAvgMap.get(rawType)!.sum += pct;
          typeAvgMap.get(rawType)!.count += 1;
          allSum += pct;
          allCount += 1;
        }
      }

      // 3. Compute weighted total using gradeDistribution
      let weightedTotal = 0;
      let totalWeightUsed = 0;
      const totalDefinedWeight = gradeRubric.gradeDistribution.reduce(
        (s: number, d: any) => s + (d.weight || 0),
        0
      );
      const breakdown: any[] = [];

      for (const dist of gradeRubric.gradeDistribution) {
        const category = (dist.category || "").toLowerCase().trim();
        const weight = dist.weight || 0;
        let categoryScore: number | null = null;

        if (category === "attendance") {
          categoryScore = attendancePercentage;
        } else if (category === "assessments" || category === "all") {
          categoryScore = allCount > 0 ? parseFloat((allSum / allCount).toFixed(2)) : null;
        } else {
          // Match by exact assessment type name (quiz, exam, assignment, activity)
          const entry = typeAvgMap.get(category);
          categoryScore =
            entry && entry.count > 0 ? parseFloat((entry.sum / entry.count).toFixed(2)) : null;
        }

        breakdown.push({
          category: dist.category,
          weight,
          score: categoryScore,
          contribution:
            categoryScore !== null ? parseFloat(((categoryScore * weight) / 100).toFixed(2)) : null,
        });

        if (categoryScore !== null) {
          weightedTotal += (categoryScore * weight) / 100;
          totalWeightUsed += weight;
        }
      }

      // 4. Normalize if some categories had no data
      const finalScore =
        totalWeightUsed > 0
          ? parseFloat((weightedTotal * (totalDefinedWeight / totalWeightUsed)).toFixed(2))
          : null;

      // 5. Look up gradeLabel from gradingScale
      const finalGradeLabel = finalScore !== null ? getGradeLabel(gradeRubric, finalScore) : null;

      finalGrade = {
        score: finalScore,
        gradeLabel: finalGradeLabel,
        breakdown,
        attendancePercentage: attendancePercentage ?? 0,
        isPartial: totalWeightUsed < totalDefinedWeight,
      };
    }
    // ─────────────────────────────────────────────────────────────────────────

    return {
      message: "Student grades retrieved successfully",
      status: "success",
      data: result,
      average,
      finalGrade,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getSectionStudentGradesAnalytics(sectionCode: string, user: any): Promise<any> {
  if (!sectionCode) {
    throw new Error("Section code is required");
  }

  if (!user || !user.id) {
    throw new Error("User not authenticated");
  }

  try {
    const instructor = await instructorRepository.getInstructor(user.id, {
      options: { lean: true },
    });

    if (!instructor) {
      throw new Error("Only instructors can view section analytics");
    }

    const rawAnalyticsData = await sectionRepository.getSectionStudentGradesAnalytics(sectionCode);

    const processStudentData = (studentData: any) => {
      let assessmentResultsArrayKey = "studentAssessmentResults";
      if (!Array.isArray(studentData[assessmentResultsArrayKey])) {
        assessmentResultsArrayKey =
          Object.keys(studentData).find((k) => Array.isArray(studentData[k])) || "";
      }

      if (!assessmentResultsArrayKey || !Array.isArray(studentData[assessmentResultsArrayKey])) {
        console.warn(
          `Could not find assessment results array for student: ${studentData._id || "Unknown ID"}`
        );
        return studentData;
      }

      const processedResults = studentData[assessmentResultsArrayKey].map((result: any) => {
        const studentScore = result.totalScore;
        const attemptTotalPoints = result.totalPoints;

        let pointsString = "N/A";
        let percentageString = "N/A";

        if (typeof studentScore === "number" && typeof attemptTotalPoints === "number") {
          if (attemptTotalPoints > 0) {
            pointsString = `${studentScore}/${attemptTotalPoints}`;
            const percentage = (studentScore / attemptTotalPoints) * 100;
            percentageString = `${percentage.toFixed(1)}%`;
          } else if (attemptTotalPoints === 0) {
            pointsString = `${studentScore}/${attemptTotalPoints}`;
            percentageString = studentScore === 0 ? "0.0%" : "100.0%";
          }
        }

        return {
          ...result,
          points: pointsString,
          percentage: percentageString,
        };
      });

      return {
        ...studentData,
        [assessmentResultsArrayKey]: processedResults,
      };
    };

    if (Array.isArray(rawAnalyticsData)) {
      return rawAnalyticsData.map(processStudentData);
    } else if (rawAnalyticsData && typeof rawAnalyticsData === "object") {
      return processStudentData(rawAnalyticsData);
    } else {
      console.warn(
        "Analytics data from repository is not in an expected format (array or object)."
      );
      return rawAnalyticsData;
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function exportSection(params: any, organizationId: string): Promise<string> {
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

    dbParams.query["archive.status"] = { $ne: true };

    if (params.populateArray) {
      dbParams.populateArray = params.populateArray.map((item: any) => {
        if (typeof item === "object" && item.path === "assessments") {
          return {
            ...item,
            countPending: true,
            skip: (item.skip || 0) * (item.limit || 10),
          };
        }
        return item;
      });
    }

    const optionsObj = {
      sort: params.sort || "-createdAt",
      skip: params.skip * params.limit || 0,
      select:
        params.select ||
        "_id code name studentId totalStudent program firstName lastName email avatar status role createdAt",
      limit: params.limit || 10,
    };

    dbParams.options = optionsObj;
    dbParams.lean = params.lean ?? true;
    const sections = await sectionRepository.searchSection(dbParams);

    // Flatten all section objects
    const flatSections = sections.map((section: any) => flattenObject(section));

    // Collect all unique keys for headers
    const allKeys = Array.from(
      flatSections.reduce((keys, obj) => {
        Object.keys(obj).forEach((key) => keys.add(key));
        return keys;
      }, new Set<string>())
    ) as string[];

    // Exclude all _id fields
    const filteredKeys = allKeys.filter((key) => !key.endsWith("_id") && key !== "_id");

    // Prettify headers
    const prettyHeaders = filteredKeys.map(prettifyHeader);

    // Build CSV data, add any field-specific sanitization here
    const csvData = flatSections.map((obj) => {
      const row: { [key: string]: string } = {};
      filteredKeys.forEach((key) => {
        // Example: format date fields
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

    // Generate CSV and replace header with pretty header
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

async function removeStudentFromSection(
  sectionCode: string,
  studentId: string,
  user: any
): Promise<ISection> {
  if (!sectionCode) {
    throw new Error("Section code is required");
  }

  if (!studentId) {
    throw new Error("Student ID is required");
  }

  try {
    const section = await sectionRepository.getSection(sectionCode, {
      options: {
        select: "_id code name students instructor organizationId",
        lean: true,
      },
    });

    if (!section) {
      throw new Error("Section not found");
    }
    if (user.organizationId && section.organizationId) {
      if (user.organizationId.toString() !== section.organizationId.toString()) {
        throw new Error("You don't have access to this section");
      }
    }
    if (user.role.toLowerCase() === "instructor") {
      const isAssignedInstructor = section.instructor && section.instructor.toString() === user.id;
      if (!isAssignedInstructor) {
        throw new Error("Instructor is not assigned to this section");
      }
    }

    if (!section.students || !Array.isArray(section.students)) {
      throw new Error("No students found in this section");
    }

    const studentExists = section.students.some((student) => student.toString() === studentId);

    if (!studentExists) {
      throw new Error("Student not found in this section");
    }

    const updatedSection = await sectionRepository.updateSection(
      { _id: section._id },
      { $pull: { students: studentId } }
    );

    if (!updatedSection) {
      throw new Error("Failed to remove student from section");
    }

    return updatedSection;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function generateCode(name: string, code?: string, organizationId?: string): Promise<string> {
  if (code) {
    const existingSection = await sectionRepository.getSection(code, {
      query: organizationId ? { organizationId } : {},
      options: {
        lean: true,
      },
    });
    if (existingSection) {
      throw new Error(`Section with code ${code} already exists`);
    }
    return code;
  }

  const words = name.split(" ");
  let initials;

  if (words.length === 1) {
    const word = words[0];
    initials = (word.charAt(0) + word.charAt(word.length - 1)).toUpperCase();
  } else {
    initials = words.map((word) => word.charAt(0).toUpperCase()).join("");
  }
  const baseInitials = initials.slice(0, 2);
  const randomNum = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  const generatedCode = baseInitials + randomNum;

  const existingSectionWithCode = await sectionRepository.getSection(generatedCode, {
    query: organizationId ? { organizationId } : {},
  });
  if (existingSectionWithCode) {
    return generateCode(name, undefined, organizationId);
  }

  return generatedCode;
}

async function updateAttendanceStatus(
  sectionCode: string,
  userId: string,
  status: string,
  date: Date,
  remarks?: string,
  user?: any
): Promise<{ previousStatus: string | null; updatedStatus: string }> {
  try {
    const sections = await sectionRepository.searchSection({
      query: { code: sectionCode },
      lean: true,
      select: "_id code attendance instructor organizationId schedule",
    });

    const section = sections[0];
    if (!section) {
      throw new Error("Section not found");
    }
    if (user.organizationId && section.organizationId) {
      if (user.organizationId.toString() !== section.organizationId.toString()) {
        throw new Error("You don't have access to this section");
      }
    }
    if (user.role.toLowerCase() === "instructor") {
      const isAssignedInstructor = section.instructor && section.instructor.toString() === user.id;
      if (!isAssignedInstructor) {
        throw new Error("Instructor is not assigned to this section");
      }
    }
    if (!section.attendance) {
      section.attendance = [];
    }
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    const attendanceIndex = section.attendance.findIndex(
      (record: any) =>
        record.userId.toString() === userId.toString() &&
        new Date(record.date) >= startOfDay &&
        new Date(record.date) <= endOfDay
    );
    let previousStatus = null;
    let updateResult;

    if (attendanceIndex === -1) {
      const userType = "student";
      if (section.schedule) {
        const dayOfWeek = date.getDay();
        const dayMap: Record<number, string> = {
          0: "sun",
          1: "mon",
          2: "tue",
          3: "wed",
          4: "thu",
          5: "fri",
          6: "sat",
        };
        const dayName = dayMap[dayOfWeek];
        if (section.schedule.breakdown && Array.isArray(section.schedule.breakdown)) {
          const isScheduledDay = section.schedule.breakdown.some(
            (schedule) => schedule.day.toLowerCase() === dayName
          );
          if (!isScheduledDay) {
            console.log(
              `Creating attendance record for ${dayName} even though it's not a scheduled class day`
            );
          }
        }
      }

      const attendanceRecord = {
        userId: new mongoose.Types.ObjectId(userId),
        userType: userType,
        date: date,
        status: status,
        remarks: remarks || "",
      };

      updateResult = await sectionRepository.updateSection(
        { _id: section._id },
        { $push: { attendance: attendanceRecord } }
      );
    } else {
      previousStatus = section.attendance[attendanceIndex].status;
      const attendanceRecord = section.attendance[attendanceIndex] as any;
      if (!attendanceRecord._id) {
        throw new Error("Attendance record is missing ID");
      }

      updateResult = await sectionRepository.updateAttendanceStatus(
        section._id,
        attendanceRecord._id.toString(),
        status,
        remarks
      );
    }

    if (!updateResult) {
      throw new Error("Failed to update attendance status");
    }

    return {
      previousStatus,
      updatedStatus: status,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getSectionModules(
  sectionCode: string,
  skip: number = 0,
  limit: number = 10,
  sort: string = "-createdAt",
  user?: any
): Promise<{ modules: { data: any[]; pagination: any } }> {
  if (!sectionCode) {
    throw new Error("Section code is required");
  }

  try {
    if (user) {
      const sectionParams = {
        query: {
          code: sectionCode,
          "archive.status": { $ne: true },
        },
        options: {
          lean: true,
          select: "_id code students instructor organizationId",
        },
      };

      const sections = await sectionRepository.getSections(sectionParams);

      if (sections.length === 0) {
        throw new Error("Section not found");
      }

      const section = sections[0];
      const isInstructor = user.role === "instructor";
      const isStudent = user.role === "student";
      const isAdmin = user.role === "admin" || user.role === "superadmin";

      if (!isInstructor && !isStudent && !isAdmin) {
        throw new Error("User is not authorized to view this section's modules");
      }

      if (isStudent) {
        const studentExists =
          section.students &&
          Array.isArray(section.students) &&
          section.students.some((studentId) => studentId.toString() === user.id);

        if (!studentExists) {
          throw new Error("Student does not belong to this section");
        }
      }

      if (isInstructor) {
        const isAssignedInstructor =
          section.instructor && section.instructor.toString() === user.id;

        if (!isAssignedInstructor) {
          throw new Error("Instructor is not assigned to this section");
        }
      }
      if (user.organizationId && section.organizationId) {
        if (user.organizationId.toString() !== section.organizationId.toString()) {
          throw new Error("You don't have access to this section");
        }
      }
    }

    const result = await sectionRepository.getSectionModules(sectionCode, skip, limit, sort);

    return {
      modules: result,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getSectionAnnouncements(
  sectionCode: string,
  params: any = {},
  _user?: any,
  newAnnouncementsCount?: boolean,
  userType?: string
): Promise<{
  currentAnnouncement?: any[];
  futureAnnouncement?: any[];
  pastAnnouncement?: any[];
  count?: number;
  todayAnnouncementsCount?: number;
}> {
  if (!sectionCode) {
    throw new Error("Section code is required");
  }

  try {
    const section = await sectionRepository.getSection(sectionCode, {
      options: {
        populateArray: [{ path: "announcements", select: "_id title textBody publishDate" }],
        lean: true,
      },
    });

    if (!section) {
      throw new Error("Section not found");
    }

    const announcements = Array.isArray(section.announcements) ? section.announcements : [];
    const totalItems = announcements.length;

    let todayAnnouncementsCount: number | undefined;
    if (newAnnouncementsCount) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      todayAnnouncementsCount = announcements.filter((announcement: any) => {
        const publishDate = new Date(announcement.publishDate);
        publishDate.setHours(0, 0, 0, 0);
        return publishDate.getTime() === today.getTime();
      }).length;
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const currentAnnouncement: any[] = [];
    const futureAnnouncement: any[] = [];
    const pastAnnouncement: any[] = [];

    announcements.forEach((announcement: any) => {
      const publishDate = new Date(announcement.publishDate);
      publishDate.setHours(0, 0, 0, 0);

      if (publishDate.getTime() === now.getTime()) {
        currentAnnouncement.push(announcement);
      } else if (publishDate.getTime() > now.getTime()) {
        futureAnnouncement.push(announcement);
      } else {
        pastAnnouncement.push(announcement);
      }
    });

    const typeFromParam = params.userType?.toLowerCase();
    const isStudent = typeFromParam === "student" || userType === "student";

    return {
      ...(params.document && {
        currentAnnouncement,
        ...(isStudent ? {} : { futureAnnouncement }),
        pastAnnouncement,
      }),
      ...(params.count && { count: totalItems }),
      ...(newAnnouncementsCount && { todayAnnouncementsCount }),
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getSectionStudents(
  sectionCode: string,
  skip: number = 0,
  limit: number = 10,
  sort: string = "lastName",
  user?: any,
  count: boolean = false,
  pagination: boolean = false,
  document: boolean = false
): Promise<{ student?: any[]; pagination?: any; count?: number }> {
  if (!sectionCode) throw new Error("Section code is required");

  try {
    const sortOptions: Record<string, number> = {};
    if (sort) {
      const sortField = sort.startsWith("-") ? sort.substring(1) : sort;
      const sortDirection = sort.startsWith("-") ? -1 : 1;
      sortOptions[sortField] = sortDirection;
    }

    const sections = await sectionRepository.searchSection({
      query: {
        code: sectionCode,
        ...(user?.organizationId && { organizationId: user.organizationId }),
        "archive.status": { $ne: true },
      },
      select: "_id code students",
      populateArray: [
        {
          path: "students",
          select: "_id firstName lastName email avatar program role",
          populate: { path: "program", select: "_id name code" },
          limit,
          skip,
          sort: sortOptions,
        },
      ],
      lean: true,
    });

    if (!sections?.length) throw new Error("Section not found");

    const section = sections[0];
    let totalStudents = section.totalStudent;
    if (typeof totalStudents !== "number") {
      const sectionForCount = await sectionRepository.getSection(sectionCode, {
        options: {
          select: "students",
          lean: true,
        },
      });
      totalStudents = Array.isArray(sectionForCount?.students)
        ? sectionForCount.students.length
        : 0;
    }
    const page = skip + 1;
    const response: { student?: any[]; pagination?: any; count?: number } = {};

    if (document) response.student = section.students || [];
    if (pagination) response.pagination = generatePagination(totalStudents, page, limit);
    if (count) response.count = totalStudents;

    return response;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

async function exportSectionStudents(
  sectionCode: string,
  _user: any,
  skip: number = 0,
  limit: number = 0,
  sort: string = "lastName"
): Promise<string> {
  if (!sectionCode) {
    throw new Error("Section code is required");
  }

  try {
    const section = await sectionRepository.getSection(sectionCode, {
      query: _user?.organizationId ? { organizationId: _user.organizationId } : {},
      options: {
        select: "_id code students",
        lean: true,
      },
    });

    if (!section) {
      throw new Error("Section not found");
    }

    if (!section.students || section.students.length === 0) {
      return "ID,StudentID,Name,Email,Program\n";
    }

    const studentQuery: Record<string, any> = {
      _id: { $in: section.students },
      "archive.status": { $ne: true },
    };

    if (_user?.organizationId) {
      studentQuery.organizationId = _user.organizationId;
    }

    const sortOptions: Record<string, number> = {};
    if (sort) {
      const sortField = sort.startsWith("-") ? sort.substring(1) : sort;
      const sortDirection = sort.startsWith("-") ? -1 : 1;
      sortOptions[sortField] = sortDirection;
    }

    const options: any = {
      select: "_id firstName lastName email program studentId role",
      sort: sortOptions,
      lean: true,
    };

    if (limit > 0) {
      options.skip = skip * limit;
      options.limit = limit;
    }

    const students = await studentRepository.searchStudent({
      query: studentQuery,
      options,
      populateArray: [{ path: "program", select: "_id name code" }],
    });

    if (!students || students.length === 0) {
      return "StudentID,Name,Email,Program\n";
    }

    const csvData = students.map((student: any) => ({
      StudentID: student.studentId || "",
      Name: `${student.firstName || ""} ${student.lastName || ""}`,
      Email: student.email || "",
      Program: student.program.name || "",
    }));

    const fields = ["StudentID", "Name", "Email", "Program"];
    return arrayToCSV(csvData, fields);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function exportSectionStudentGrades(sectionCode: string, _user: any): Promise<string> {
  try {
    const params: any = {
      query: _user?.organizationId ? { organizationId: _user.organizationId } : {},
    };
    const { headers, students } = await getSectionStudentGradesTable(sectionCode, params);
    if (!headers.length || !students.length) {
      return "No data available";
    }
    const csvHeaders = ["Student ID", "First Name", "Last Name", ...headers, "Final Grade"];
    const rows = students.map((student: any) => [
      student.studentId,
      student.firstName,
      student.lastName,
      ...student.assessments.map((a: any) => a.gradeLabel),
      student.finalGrade,
    ]);
    const csvData = rows.map((row) => Object.fromEntries(csvHeaders.map((h, i) => [h, row[i]])));
    return arrayToCSV(csvData, csvHeaders);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getSectionGradeSystem(sectionCode: string): Promise<any> {
  try {
    const section = await sectionRepository.getSection(sectionCode, {
      options: {
        populateArray: [
          {
            path: "grade",
            select:
              "gradingMethod totalCoursePoints minPassingGrade lateSubmissionPenalty gradeDistribution gradingScale",
          },
        ],
        lean: true,
      },
    });

    if (!section) {
      throw new Error("Section not found");
    }

    return section.grade as any;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getSectionByCode(sectionCode: string, query?: any): Promise<ISection | null> {
  if (!sectionCode) {
    throw new Error("Section code is required");
  }
  try {
    return await sectionRepository.getSectionByCode(sectionCode, query);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function addStudentsToSectionByCode(
  sectionCode: string,
  studentIds: mongoose.Types.ObjectId[],
  user?: any
): Promise<ISection | null> {
  if (!sectionCode) {
    throw new Error("Section code is required");
  }
  if (!studentIds || studentIds.length === 0) {
    throw new Error("Student IDs are required");
  }

  try {
    const section = await sectionRepository.getSectionByCode(sectionCode, {
      organizationId: user.organizationId,
    });

    if (!section) {
      const error = new Error("Section not found");
      (error as any).statusCode = 404;
      throw error;
    }

    const usersFound = await userService.searchUser({
      match: { _id: { $in: studentIds }, organizationId: user.organizationId },
      select: "_id",
      limit: studentIds.length,
      lean: true,
    });

    const foundUserIds = new Set(usersFound.map((u: any) => u._id.toString()));
    const notFoundStudentIds = studentIds.filter((id) => !foundUserIds.has(id.toString()));

    if (notFoundStudentIds.length > 0) {
      const error = new Error(
        `The following student IDs do not exist or do not belong to this organization: ${notFoundStudentIds.join(", ")}`
      );
      (error as any).statusCode = 400;
      throw error;
    }

    const existingStudentIdsStrings = new Set(section.students.map((id) => id.toString()));
    const alreadyInSectionStudentIds = studentIds.filter((id) =>
      existingStudentIdsStrings.has(id.toString())
    );

    if (alreadyInSectionStudentIds.length > 0) {
      const error = new Error(
        `The following students are already in this section: ${alreadyInSectionStudentIds.join(", ")}`
      );
      (error as any).statusCode = 409;
      throw error;
    }
    return await sectionRepository.addStudentsToSectionByCode(
      sectionCode,
      studentIds,
      user.organizationId
    );
  } catch (error) {
    if ((error as any).statusCode) {
      throw error;
    }
    if (error instanceof Error) {
      const serviceError = new Error(`Failed to add students to section: ${error.message}`);
      (serviceError as any).statusCode = 500;
      throw serviceError;
    }
    const unknownError = new Error(
      "An unexpected error occurred while adding students to the section."
    );
    (unknownError as any).statusCode = 500;
    throw unknownError;
  }
}

async function getSectionSchedule(
  userId: string,
  type: string = "week",
  startDate?: string,
  endDate?: string
): Promise<any> {
  try {
    const schedule = await sectionRepository.getSectionSchedule(userId, type, startDate, endDate);
    return schedule;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}
