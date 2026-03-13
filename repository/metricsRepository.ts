import { FACET } from "../config/facetConfig";
import mongoose, { PipelineStage } from "mongoose";
import Section from "../models/sectionModel";
import Attendance from "../models/attendanceModel";
import PerformanceActionPlan from "../models/performanceActionPlanModel";
import Student from "../models/studentModel";
import StudentAssessmentGrade from "../models/studentAssessmentGradeModel";
import Module from "../models/moduleModel";
import Lesson from "../models/lessonModel";

export interface PerformanceDashboardParams {
  organizationId: string;
  userId: string;
  role: string;
  sectionCode?: string;
}

export interface CreatePerformanceActionPlanParams {
  organizationId: string;
  studentId: string;
  createdBy: string;
  createdByRole: "admin" | "instructor";
  sectionCode?: string;
  title?: string;
  summary?: string;
  riskLevel?: "Critical" | "Moderate" | "Low";
}

export interface StudentPerformanceDetailsParams {
  organizationId: string;
  studentId: string;
  requestingUserId: string;
  role: string;
}

type RiskLevel = "Critical" | "Moderate" | "Low";

interface PerformanceStudentRow {
  _id: string;
  name: string;
  email: string;
  section: string;
  gpa: string;
  attendance: number;
  standing: "Probation" | "Warning" | "Good Standing";
  riskLevel: RiskLevel;
  avatar: string;
  progress: {
    completedLessons: number;
    totalLessons: number;
    completedAssessments: number;
    totalAssessments: number;
    completedModules: number;
    totalModules: number;
    percent: number;
  };
}

export interface PerformanceDashboardResponse {
  summary: {
    criticalRisk: number;
    moderateRisk: number;
    goodStanding: number;
    classAverageGPA: number;
  };
  students: PerformanceStudentRow[];
}

interface PerformanceStudentDoc {
  _id: mongoose.Types.ObjectId;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string;
  gpa?: number;
  studentAssessmentResults?: any[];
}

interface PerformanceSectionDoc {
  _id: mongoose.Types.ObjectId;
  code: string;
  students?: PerformanceStudentDoc[];
  grade?: any;
  assessments?: any[];
  attendance?: any[];
  modules?: any[];
}

interface AttendanceSummary {
  _id: {
    section: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
  };
  totalSessions: number;
  attendedSessions: number;
}

const metricsRepository = {
  searchMetrics,
  getPerformanceDashboard,
  getStudentPerformanceDetails,
  createPerformanceActionPlan,
};

export default metricsRepository;

function createEmptyPerformanceDashboard(): PerformanceDashboardResponse {
  return {
    summary: {
      criticalRisk: 0,
      moderateRisk: 0,
      goodStanding: 0,
      classAverageGPA: 0,
    },
    students: [],
  };
}

function getRiskClassification(gpa: number): {
  riskLevel: RiskLevel;
  standing: "Probation" | "Warning" | "Good Standing";
} {
  if (gpa < 2.0) {
    return { riskLevel: "Critical", standing: "Probation" };
  }
  if (gpa < 2.5) {
    return { riskLevel: "Moderate", standing: "Warning" };
  }
  return { riskLevel: "Low", standing: "Good Standing" };
}

// Philippine grading scale: 1.00 = highest, 5.00 = failing
function getRiskClassificationPhilippine(phpGrade: number): {
  riskLevel: RiskLevel;
  standing: "Probation" | "Warning" | "Good Standing";
} {
  if (phpGrade >= 3.0) {
    return { riskLevel: "Critical", standing: "Probation" };
  }
  if (phpGrade >= 2.5) {
    return { riskLevel: "Moderate", standing: "Warning" };
  }
  return { riskLevel: "Low", standing: "Good Standing" };
}

// Computes finalGrade (Philippine scale 1.00–5.00) using the same logic as getSectionStudentGradesAnalytics.
// Returns null if the student has not attempted any assessments.
function computeStudentFinalGradeForSection(
  studentAssessmentResults: any[],
  sectionCode: string,
  sectionAssessments: any[],
  gradingScale: any[],
  attendanceData: { totalSessions: number; attendedSessions: number } | undefined
): number | null {
  if (!gradingScale || gradingScale.length === 0) return null;

  const getGradeLabelValue = (pct: number): number => {
    const rounded = Math.round(pct);
    const match = gradingScale.find(
      (s: any) => rounded >= s.percentageRange.startRange && rounded <= s.percentageRange.endRange
    );
    return match ? parseFloat(match.gradeLabel) : 5.0;
  };

  const assessmentIdSet = new Set(sectionAssessments.map((a: any) => a._id.toString()));
  const relevantResults = (studentAssessmentResults || []).filter(
    (r: any) =>
      r.sectionCode === sectionCode &&
      r.isFinished &&
      !r.isDeleted &&
      assessmentIdSet.has(r.assessmentId?.toString())
  );

  // Student has no submissions — cannot compute a grade
  if (relevantResults.length === 0) return null;

  // Group section assessments by type
  const assessmentsByType: Record<string, any[]> = {};
  sectionAssessments.forEach((a: any) => {
    const typeKey = a.type?.toLowerCase().includes("final") ? "final" : a.type?.toLowerCase();
    if (typeKey) {
      if (!assessmentsByType[typeKey]) assessmentsByType[typeKey] = [];
      assessmentsByType[typeKey].push(a);
    }
  });

  const averages: number[] = [];

  for (const typeAssessments of Object.values(assessmentsByType)) {
    if (!typeAssessments.length) continue;
    let sum = 0;
    for (const assessment of typeAssessments) {
      const result = relevantResults.find(
        (r: any) => r.assessmentId?.toString() === assessment._id.toString()
      );
      if (result && result.totalPoints > 0) {
        const pct = (result.totalScore / result.totalPoints) * 100;
        sum += getGradeLabelValue(pct);
      } else {
        sum += 5.0; // unsubmitted assessment = failing
      }
    }
    averages.push(sum / typeAssessments.length);
  }

  // Include attendance grade if available
  if (attendanceData && attendanceData.totalSessions > 0) {
    const attPct = (attendanceData.attendedSessions / attendanceData.totalSessions) * 100;
    averages.push(getGradeLabelValue(attPct));
  }

  if (averages.length === 0) return null;
  return parseFloat((averages.reduce((a, b) => a + b, 0) / averages.length).toFixed(2));
}

async function searchMetrics(model: string, data: string[], filter?: any): Promise<any[]> {
  const facetObject = FACET(filter);
  const normalizedModel = model.toLowerCase();

  const matchedModel = Object.entries(facetObject).find(
    ([key]) => key.toLowerCase() === normalizedModel
  )?.[0] as keyof ReturnType<typeof FACET> | undefined;

  if (!matchedModel) {
    console.error(`❌ Invalid model: ${model}. Available Models:`, Object.keys(facetObject));
    throw new Error(`Invalid model: ${model}`);
  }

  const facetModel = facetObject[matchedModel];

  const normalizedDataMap = new Map(
    Object.keys(facetModel).map((key) => [key.toLowerCase(), key as keyof typeof facetModel])
  );

  const facetConfig = Object.fromEntries(
    data
      .map((value) => {
        const strValue = value as unknown as string;
        const normalizedValue = strValue.toLowerCase();
        const originalValue = normalizedDataMap.get(normalizedValue);
        if (!originalValue) return null;

        const facetPipeline = facetModel[originalValue as keyof typeof facetModel];
        if (!Array.isArray(facetPipeline)) return null;

        return [originalValue, facetPipeline] as [string, PipelineStage.FacetPipelineStage[]];
      })
      .filter((entry): entry is [string, PipelineStage.FacetPipelineStage[]] => entry !== null)
  );

  if (Object.keys(facetConfig).length === 0) {
    return [];
  }

  if (matchedModel === "Student" || matchedModel === "Instructor") {
    const sectionModelName = Object.keys(mongoose.models).find(
      (key) => key.toLowerCase() === "section"
    );

    if (!sectionModelName) {
      console.error(`❌ Section model not found. Required for ${matchedModel} dashboard metrics.`);
      throw new Error(`Section model not found. Required for ${matchedModel} dashboard metrics.`);
    }

    const SectionModel = mongoose.model(sectionModelName);
    const result = await SectionModel.aggregate([{ $facet: facetConfig }]).exec();

    return result.length > 0 ? [result[0]] : [{}];
  }

  const mongooseModelName = Object.keys(mongoose.models).find(
    (key) => key.toLowerCase() === normalizedModel
  );

  if (!mongooseModelName) {
    console.error(`❌ Mongoose model "${model}" not found.`);
    throw new Error(`Mongoose model "${model}" does not exist.`);
  }

  const Model = mongoose.model(mongooseModelName);
  const result = await Model.aggregate([{ $facet: facetConfig }]).exec();
  return result;
}

async function getPerformanceDashboard(
  params: PerformanceDashboardParams
): Promise<PerformanceDashboardResponse> {
  const emptyResponse = createEmptyPerformanceDashboard();

  if (!params.organizationId || !mongoose.isValidObjectId(params.organizationId)) {
    return emptyResponse;
  }

  const normalizedRole = params.role.toLowerCase();
  const query: Record<string, unknown> = {
    organizationId: new mongoose.Types.ObjectId(params.organizationId),
    "archive.status": { $ne: true },
  };

  if (params.sectionCode && params.sectionCode.trim()) {
    query.code = params.sectionCode.trim();
  }

  if (normalizedRole === "instructor") {
    if (!params.userId || !mongoose.isValidObjectId(params.userId)) {
      return emptyResponse;
    }
    query.instructor = new mongoose.Types.ObjectId(params.userId);
  }

  const sections = (await Section.find(query)
    .select("_id code students grade assessments attendance modules")
    .populate({
      path: "students",
      match: {
        role: "student",
        "archive.status": { $ne: true },
      },
      select: "_id firstName lastName email avatar gpa studentAssessmentResults",
    })
    .populate({ path: "grade", select: "gradingScale" })
    .populate({
      path: "assessments",
      match: { "archive.status": false, isDeleted: { $ne: true } },
      select: "_id type totalPoints",
    })
    .populate({
      path: "modules",
      match: { "archive.status": { $ne: true }, isPublished: true },
      select: "_id lessons",
    })
    .lean()) as PerformanceSectionDoc[];

  if (!sections.length) {
    return emptyResponse;
  }

  const sectionIds = sections.map((section) => section._id);

  const attendanceCollectionRecords = await Attendance.find({
    section: { $in: sectionIds },
    userType: "student",
    "archive.status": { $ne: true },
  })
    .select("section userId date status")
    .lean();

  const attStatusPriority: Record<string, number> = { present: 4, late: 3, excused: 2, absent: 1 };
  const attAttendedStatuses = new Set(["present", "late", "excused"]);

  const normalizeAttDateKey = (value: any): string | null => {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  // key: `${sectionId}-${userId}` → Map<dateKey, status> (deduped highest priority per day)
  const mergedAttDateMap = new Map<string, Map<string, string>>();

  const addAttendanceRecord = (sectionId: string, userId: string, date: any, status: string) => {
    const key = `${sectionId}-${userId}`;
    if (!mergedAttDateMap.has(key)) mergedAttDateMap.set(key, new Map());
    const dateKey = normalizeAttDateKey(date);
    if (!dateKey) return;
    const normalStatus = status.toLowerCase();
    const existing = mergedAttDateMap.get(key)!.get(dateKey);
    if (!existing || (attStatusPriority[normalStatus] || 0) > (attStatusPriority[existing] || 0)) {
      mergedAttDateMap.get(key)!.set(dateKey, normalStatus);
    }
  };

  // Add from Attendance collection
  attendanceCollectionRecords.forEach((record: any) => {
    if (record.section && record.userId) {
      addAttendanceRecord(
        record.section.toString(),
        record.userId.toString(),
        record.date,
        record.status || "absent"
      );
    }
  });

  // Add from embedded section.attendance (merged to avoid double-counting same-day records)
  sections.forEach((section: any) => {
    const embedded: any[] = section.attendance || [];
    embedded.forEach((record: any) => {
      if (record.userId && String(record.userType || "student").toLowerCase() === "student") {
        addAttendanceRecord(
          section._id.toString(),
          record.userId.toString(),
          record.date,
          record.status || "absent"
        );
      }
    });
  });

  const attendanceMap = new Map<string, { totalSessions: number; attendedSessions: number }>();
  mergedAttDateMap.forEach((dateMap, key) => {
    let attended = 0;
    dateMap.forEach((status) => {
      if (attAttendedStatuses.has(status)) attended++;
    });
    attendanceMap.set(key, { totalSessions: dateMap.size, attendedSessions: attended });
  });

  // Collect all lesson IDs across all sections to batch-query progress
  const allLessonIds: mongoose.Types.ObjectId[] = [];
  const sectionLessonMap = new Map<string, mongoose.Types.ObjectId[]>(); // sectionId -> lessonIds
  const sectionModuleMap = new Map<string, mongoose.Types.ObjectId[][]>(); // sectionId -> module lessonIds
  sections.forEach((section) => {
    const modules: any[] = Array.isArray(section.modules) ? section.modules : [];
    const lessonIds: mongoose.Types.ObjectId[] = [];
    const moduleLessonIds: mongoose.Types.ObjectId[][] = [];
    modules.forEach((mod: any) => {
      const modLessonIds: mongoose.Types.ObjectId[] = [];
      if (Array.isArray(mod.lessons)) {
        mod.lessons.forEach((lid: any) => {
          const oid = lid._id || lid;
          lessonIds.push(oid);
          allLessonIds.push(oid);
          modLessonIds.push(oid);
        });
      }
      moduleLessonIds.push(modLessonIds);
    });
    sectionLessonMap.set(section._id.toString(), lessonIds);
    sectionModuleMap.set(section._id.toString(), moduleLessonIds);
  });

  // Batch query lesson progress for all lessons
  const lessonProgressDocs =
    allLessonIds.length > 0
      ? await Lesson.find(
          { _id: { $in: allLessonIds }, "archive.status": { $ne: true } },
          { _id: 1, progress: 1 }
        ).lean()
      : [];

  // Map: lessonId -> Set of userIds who completed it
  const lessonCompletedMap = new Map<string, Set<string>>();
  lessonProgressDocs.forEach((lesson: any) => {
    const completedUsers = new Set<string>();
    (lesson.progress || []).forEach((p: any) => {
      if (p.status === "completed" && p.userId) {
        completedUsers.add(p.userId.toString());
      }
    });
    lessonCompletedMap.set(lesson._id.toString(), completedUsers);
  });

  const students: PerformanceStudentRow[] = [];

  sections.forEach((section) => {
    const sectionAssessments: any[] = Array.isArray((section as any).assessments)
      ? (section as any).assessments
      : [];
    const gradingScale: any[] = (section as any).grade?.gradingScale || [];
    const sectionStudents = Array.isArray(section.students) ? section.students : [];
      const sectionLessonIds = sectionLessonMap.get(section._id.toString()) || [];
      const sectionModuleLessons = sectionModuleMap.get(section._id.toString()) || [];

    sectionStudents.forEach((student) => {
      const attendanceKey = `${section._id.toString()}-${student._id.toString()}`;
      const attendanceData = attendanceMap.get(attendanceKey);
      const attendance =
        attendanceData && attendanceData.totalSessions > 0
          ? Math.round((attendanceData.attendedSessions / attendanceData.totalSessions) * 100)
          : 0;

      // Compute finalGrade (Philippine scale) from actual assessment results
      const computedFinalGrade = computeStudentFinalGradeForSection(
        student.studentAssessmentResults || [],
        section.code,
        sectionAssessments,
        gradingScale,
        attendanceData
      );

      let displayGpa: string;
      let riskLevel: RiskLevel;
      let standing: "Probation" | "Warning" | "Good Standing";

      if (computedFinalGrade !== null) {
        // Use computed grade (Philippine scale: 1.00 = excellent, 5.00 = failing)
        displayGpa = computedFinalGrade.toFixed(2);
        ({ riskLevel, standing } = getRiskClassificationPhilippine(computedFinalGrade));
      } else {
        // No submissions yet — fall back to stored gpa (0–4 US scale)
        const storedGpa =
          typeof student.gpa === "number" && Number.isFinite(student.gpa)
            ? Math.max(0, Math.min(4, student.gpa))
            : 0;
        displayGpa = storedGpa.toFixed(2);
        ({ riskLevel, standing } = getRiskClassification(storedGpa));
      }

      const firstName = (student.firstName || "").trim();
      const lastName = (student.lastName || "").trim();
      const name = `${firstName} ${lastName}`.trim() || "Unknown Student";

      // Compute progress: lessons completed + assessments completed
      const totalLessons = sectionLessonIds.length;
      let completedLessons = 0;
      const studentIdStr = student._id.toString();
      sectionLessonIds.forEach((lid) => {
        const completedUsers = lessonCompletedMap.get(lid.toString());
        if (completedUsers && completedUsers.has(studentIdStr)) completedLessons++;
      });
      const modulesWithLessons = sectionModuleLessons.filter((lessons) => lessons.length > 0);
      const totalModules = modulesWithLessons.length;
      let completedModules = 0;
      modulesWithLessons.forEach((lessonIds) => {
        const isComplete = lessonIds.every((lid) => {
          const completedUsers = lessonCompletedMap.get(lid.toString());
          return completedUsers && completedUsers.has(studentIdStr);
        });
        if (isComplete) completedModules++;
      });

      const totalAssessments = sectionAssessments.length;
      const assessmentIdSet = new Set(sectionAssessments.map((a: any) => a._id.toString()));
      const completedAssessments = (student.studentAssessmentResults || []).filter(
        (r: any) =>
          r.sectionCode === section.code &&
          r.isFinished &&
          !r.isDeleted &&
          assessmentIdSet.has(r.assessmentId?.toString())
      ).length;

      const totalItems = totalLessons + totalAssessments;
      const completedItems = completedLessons + completedAssessments;
      const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      students.push({
        _id: student._id.toString(),
        name,
        email: student.email || "",
        section: section.code,
        gpa: displayGpa,
        attendance,
        standing,
        riskLevel,
        avatar: student.avatar || "",
        progress: {
          completedLessons,
          totalLessons,
          completedAssessments,
          totalAssessments,
          completedModules,
          totalModules,
          percent: progressPercent,
        },
      });
    });
  });

  students.sort((a, b) => a.name.localeCompare(b.name));

  const criticalRisk = students.filter((student) => student.riskLevel === "Critical").length;
  const moderateRisk = students.filter((student) => student.riskLevel === "Moderate").length;
  const goodStanding = students.filter((student) => student.standing === "Good Standing").length;

  const gpaValues = students
    .map((student) => Number(student.gpa))
    .filter((gpa) => Number.isFinite(gpa) && gpa > 0);

  const classAverageGPA =
    gpaValues.length > 0
      ? Number((gpaValues.reduce((sum, gpa) => sum + gpa, 0) / gpaValues.length).toFixed(2))
      : 0;

  return {
    summary: {
      criticalRisk,
      moderateRisk,
      goodStanding,
      classAverageGPA,
    },
    students,
  };
}

async function createPerformanceActionPlan(
  params: CreatePerformanceActionPlanParams
): Promise<any> {
  if (!params.organizationId || !mongoose.isValidObjectId(params.organizationId)) {
    throw new Error("Invalid organization ID");
  }

  if (!params.studentId || !mongoose.isValidObjectId(params.studentId)) {
    throw new Error("Invalid student ID");
  }

  if (!params.createdBy || !mongoose.isValidObjectId(params.createdBy)) {
    throw new Error("Invalid creator ID");
  }

  return PerformanceActionPlan.create({
    organizationId: new mongoose.Types.ObjectId(params.organizationId),
    studentId: new mongoose.Types.ObjectId(params.studentId),
    createdBy: new mongoose.Types.ObjectId(params.createdBy),
    createdByRole: params.createdByRole,
    sectionCode: params.sectionCode?.trim() || undefined,
    title: params.title?.trim() || "Action Plan",
    summary: params.summary?.trim() || "",
    riskLevel: params.riskLevel,
    status: "open",
  });
}

async function getStudentPerformanceDetails(params: StudentPerformanceDetailsParams): Promise<any> {
  const { organizationId, studentId, requestingUserId, role } = params;

  if (!mongoose.isValidObjectId(organizationId) || !mongoose.isValidObjectId(studentId)) {
    return null;
  }

  const orgId = new mongoose.Types.ObjectId(organizationId);
  const studentObjId = new mongoose.Types.ObjectId(studentId);
  const normalizedRole = role.toLowerCase();

  // Fetch the student (User discriminator) with program populated
  const studentDoc = (await Student.findOne({
    _id: studentObjId,
    organizationId: orgId,
    role: "student",
    "archive.status": { $ne: true },
  })
    .select("_id firstName lastName email avatar gpa studentId program yearLevel")
    .populate({ path: "program", select: "name code" })
    .lean()) as any;

  if (!studentDoc) return null;

  // Fetch sections this student is enrolled in
  const sectionQuery: Record<string, unknown> = {
    organizationId: orgId,
    students: studentObjId,
    "archive.status": { $ne: true },
  };

  if (normalizedRole === "instructor" && mongoose.isValidObjectId(requestingUserId)) {
    sectionQuery.instructor = new mongoose.Types.ObjectId(requestingUserId);
  }

  interface SectionWithCourse {
    _id: mongoose.Types.ObjectId;
    code: string;
    attendance: { userId: mongoose.Types.ObjectId; status: string; date: Date }[];
    course: { title: string; code: string } | null;
  }

  const sections = (await Section.find(sectionQuery)
    .select("_id code attendance course modules assessments")
    .populate({ path: "course", select: "title code" })
    .populate({
      path: "modules",
      match: { "archive.status": { $ne: true }, isPublished: true },
      select: "_id lessons",
    })
    .populate({
      path: "assessments",
      match: { "archive.status": false, isDeleted: { $ne: true } },
      select: "_id type",
    })
    .lean()) as (SectionWithCourse & { modules?: any[]; assessments?: any[] })[];

  // Batch-query lesson progress for detail page
  const detailAllLessonIds: mongoose.Types.ObjectId[] = [];
  const detailSectionLessonMap = new Map<string, mongoose.Types.ObjectId[]>();
  sections.forEach((section) => {
    const modules: any[] = Array.isArray((section as any).modules) ? (section as any).modules : [];
    const lessonIds: mongoose.Types.ObjectId[] = [];
    modules.forEach((mod: any) => {
      if (Array.isArray(mod.lessons)) {
        mod.lessons.forEach((lid: any) => {
          const oid = lid._id || lid;
          lessonIds.push(oid);
          detailAllLessonIds.push(oid);
        });
      }
    });
    detailSectionLessonMap.set(section._id.toString(), lessonIds);
  });

  const detailLessonDocs =
    detailAllLessonIds.length > 0
      ? await Lesson.find(
          { _id: { $in: detailAllLessonIds }, "archive.status": { $ne: true } },
          { _id: 1, progress: 1 }
        ).lean()
      : [];

  const detailLessonCompletedMap = new Map<string, Set<string>>();
  detailLessonDocs.forEach((lesson: any) => {
    const completedUsers = new Set<string>();
    (lesson.progress || []).forEach((p: any) => {
      if (p.status === "completed" && p.userId) {
        completedUsers.add(p.userId.toString());
      }
    });
    detailLessonCompletedMap.set(lesson._id.toString(), completedUsers);
  });

  // Student's assessment results (fetch once)
  const studentFullDoc = (await Student.findById(studentObjId)
    .select("studentAssessmentResults")
    .lean()) as any;
  const studentAssessmentResults: any[] = studentFullDoc?.studentAssessmentResults || [];

  // Compute attendance across all sections
  let totalSessions = 0;
  let attendedSessions = 0;
  const presentStatuses = new Set(["present", "late", "excused"]);

  sections.forEach((section) => {
    const records = (section.attendance || []).filter(
      (r: any) => r.userId?.toString() === studentId
    );
    totalSessions += records.length;
    attendedSessions += records.filter((r: any) =>
      presentStatuses.has((r.status || "").toLowerCase())
    ).length;
  });

  const attendancePercentage =
    totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 100) : 0;

  // Count pending / unsubmitted assessments
  const missingAssessments = await StudentAssessmentGrade.countDocuments({
    organizationId: orgId,
    studentId: studentObjId,
    status: "pending",
    "archive.status": { $ne: true },
  });

  // Build course breakdown
  const courseBreakdown = sections.map((section) => {
    const sectionRecords = (section.attendance || []).filter(
      (r: any) => r.userId?.toString() === studentId
    );
    const sectionTotal = sectionRecords.length;
    const sectionAttended = sectionRecords.filter((r: any) =>
      presentStatuses.has((r.status || "").toLowerCase())
    ).length;
    const sectionAttendancePct =
      sectionTotal > 0 ? Math.round((sectionAttended / sectionTotal) * 100) : 0;

    const gpa = typeof studentDoc.gpa === "number" ? studentDoc.gpa : 0;
    const { riskLevel } = getRiskClassification(gpa);
    const status =
      riskLevel === "Critical" ? "Failing" : riskLevel === "Moderate" ? "Passing" : "Passing";

    // Compute progress per section
    const sLessonIds = detailSectionLessonMap.get(section._id.toString()) || [];
    const sTotalLessons = sLessonIds.length;
    let sCompletedLessons = 0;
    sLessonIds.forEach((lid) => {
      const completedUsers = detailLessonCompletedMap.get(lid.toString());
      if (completedUsers && completedUsers.has(studentId)) sCompletedLessons++;
    });

    const sAssessments: any[] = Array.isArray((section as any).assessments)
      ? (section as any).assessments
      : [];
    const sTotalAssessments = sAssessments.length;
    const sAssessmentIdSet = new Set(sAssessments.map((a: any) => a._id.toString()));
    const sCompletedAssessments = studentAssessmentResults.filter(
      (r: any) =>
        r.sectionCode === section.code &&
        r.isFinished &&
        !r.isDeleted &&
        sAssessmentIdSet.has(r.assessmentId?.toString())
    ).length;

    const sTotalItems = sTotalLessons + sTotalAssessments;
    const sCompletedItems = sCompletedLessons + sCompletedAssessments;
    const sProgressPercent =
      sTotalItems > 0 ? Math.round((sCompletedItems / sTotalItems) * 100) : 0;

    return {
      course: section.course?.title || "Unknown Course",
      section: section.code,
      attendance: sectionAttendancePct,
      grade: gpa,
      status,
      progress: {
        completedLessons: sCompletedLessons,
        totalLessons: sTotalLessons,
        completedAssessments: sCompletedAssessments,
        totalAssessments: sTotalAssessments,
        percent: sProgressPercent,
      },
    };
  });

  // Derive risk factors
  const riskFactors: string[] = [];
  const gpa = typeof studentDoc.gpa === "number" ? studentDoc.gpa : 0;
  if (gpa < 2.0) riskFactors.push(`Low GPA (${gpa.toFixed(2)}) — at risk of academic probation`);
  else if (gpa < 2.5) riskFactors.push(`GPA (${gpa.toFixed(2)}) is below satisfactory threshold`);
  if (attendancePercentage < 75)
    riskFactors.push(`Attendance at ${attendancePercentage}% — below the 75% minimum requirement`);
  if (missingAssessments > 0)
    riskFactors.push(`${missingAssessments} pending assessment(s) not yet submitted`);

  const { riskLevel, standing } = getRiskClassification(gpa);

  // Fetch existing action plans for this student
  const actionPlans = await PerformanceActionPlan.find({
    organizationId: orgId,
    studentId: studentObjId,
  })
    .select("_id title summary riskLevel status createdAt createdByRole")
    .sort({ createdAt: -1 })
    .lean();

  const firstName = (studentDoc.firstName || "").trim();
  const lastName = (studentDoc.lastName || "").trim();

  return {
    _id: studentDoc._id.toString(),
    name: `${firstName} ${lastName}`.trim() || "Unknown Student",
    email: studentDoc.email || "",
    idNumber: studentDoc.studentId || "",
    program: (studentDoc.program as any)?.name || "",
    section: sections.map((s) => s.code).join(", "),
    avatar: studentDoc.avatar || "",
    yearLevel: studentDoc.yearLevel || null,
    gpa: Number(gpa.toFixed(2)),
    riskLevel,
    standing,
    attendance: attendancePercentage,
    missingAssignments: missingAssessments,
    riskFactors,
    gpaTrend: [{ term: "Current", gpa: Number(gpa.toFixed(2)) }],
    courseBreakdown,
    actionPlans,
  };
}
