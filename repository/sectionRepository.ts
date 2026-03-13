import { FilterQuery, UpdateQuery } from "mongoose";
import Section, { ISection } from "../models/sectionModel";
import mongoose from "mongoose";
import { formatDatesForAttendance } from "../utils/formatDate";
import { Assessment } from "../helper/interfaces";
import { PopulationOption, applyPaginationToPopulatedFields } from "../utils/paginationUtils";
import { IGrade } from "../models/gradeModel";
import Attendance from "../models/attendanceModel";

interface DbParams {
  query?: any;
  options?: {
    populateArray?: { path: string; select?: string }[];
    select?: string;
    lean?: boolean;
    sort?: any;
    limit?: number;
    skip?: number;
  };
}

// Event interface removed as it's no longer needed with the new aggregation approach

const sectionRepository = {
  getSection,
  getSections,
  createSection,
  updateSection,
  deleteSection,
  searchSection,
  searchAndUpdate,
  findOrCreate,
  getSectionCount,
  getSectionAttendance,
  bulkAddStudents,
  archiveSection,
  getSectionAssessment,
  getSectionStudentGradesAnalytics,
  findSectionByAttendanceId,
  updateAttendanceStatus,
  getSectionModules,
  getSectionByCode,
  addStudentsToSectionByCode,
  getSectionSchedule,
};

export default sectionRepository;

function getSection(idOrCode: string, dbParams: DbParams = {}): Promise<ISection | null> {
  let query = mongoose.isValidObjectId(idOrCode)
    ? Section.findById(idOrCode)
    : Section.findOne({ code: idOrCode });

  if (!dbParams.query) {
    dbParams.query = {};
  }

  if (dbParams.query.includeArchived !== true) {
    query = query.where("archive.status").ne(true);

    (dbParams.options?.populateArray || []).forEach(
      (populate: string | { path: string; select?: string }) => {
        if (typeof populate === "string") {
          query.populate({
            path: populate,
            match: { "archive.status": { $ne: true } },
          });
        } else {
          query.populate({
            path: populate.path,
            select: populate.select,
            match: { "archive.status": { $ne: true } },
          });
        }
      }
    );
  } else {
    (dbParams.options?.populateArray || []).forEach((populateOption) => {
      query = query.populate(populateOption);
    });
  }

  const options = {
    select: dbParams.options?.select || "_id",
    lean: dbParams.options?.lean || true,
  };

  query = query.select(options.select).lean(options.lean);
  if (dbParams.query?.organizationId) {
    query.where("organizationId").equals(dbParams.query.organizationId);
  }

  return query.exec();
}

function getSections(dbParams: DbParams): Promise<ISection[]> {
  let query = Section.find(dbParams.query || {});

  if (!dbParams.query) {
    dbParams.query = {};
  }

  if (dbParams.query.includeArchived !== true) {
    query = query.where("archive.status").ne(true);

    (dbParams.options?.populateArray || []).forEach(
      (populate: string | { path: string; select?: string }) => {
        if (typeof populate === "string") {
          query.populate({
            path: populate,
            match: { "archive.status": { $ne: true } },
          });
        } else {
          query.populate({
            path: populate.path,
            select: populate.select,
            match: { "archive.status": { $ne: true } },
          });
        }
      }
    );
  } else {
    (dbParams.options?.populateArray || []).forEach(
      (populate: string | { path: string; select?: string }) => {
        if (typeof populate === "string") {
          query.populate(populate);
        } else {
          query.populate(populate.path, populate.select);
        }
      }
    );
  }

  const options = {
    sort: dbParams.options?.sort || {},
    limit: dbParams.options?.limit || 10,
    skip: dbParams.options?.skip || 0,
    select: dbParams.options?.select || "_id",
    lean: dbParams.options?.lean || true,
  };

  query = query
    .sort(options.sort)
    .skip(options.skip)
    .limit(options.limit)
    .select(options.select)
    .lean(options.lean);
  if (dbParams.query?.organizationId) {
    query.where("organizationId").equals(dbParams.query.organizationId);
  }

  return query.exec();
}
function getSectionCount(query: any): Promise<number> {
  return Section.countDocuments(query).exec();
}
function createSection(data: Partial<ISection>): Promise<ISection> {
  return Section.create(data);
}

async function updateSection(
  filter: FilterQuery<ISection>,
  update: UpdateQuery<ISection>
): Promise<ISection | null> {
  return await Section.findOneAndUpdate(filter, update, { new: true }).exec();
}
function deleteSection(id: string): Promise<ISection | null> {
  return Section.findByIdAndDelete(id);
}

function searchSection(params: any = {}): Promise<ISection[]> {
  const query = Section.find();
  query.setQuery(params.query || {});

  const processPopulateOption = (populateOption: any): any => {
    const {
      path,
      select = "",
      match = {},
      limit,
      skip,
      sort,
      populate,
      includeArchived,
    } = populateOption;

    const populateObj: any = {
      path,
      select,
      options: {},
      match: includeArchived
        ? match
        : {
            "archive.status": { $ne: true },
            ...match,
          },
    };

    if (limit) {
      populateObj.options.limit = limit;
      if (skip) {
        populateObj.options.skip = skip * limit;
      }
    }
    if (sort) populateObj.options.sort = sort;

    if (populate) {
      if (Array.isArray(populate)) {
        populateObj.populate = populate.map(processPopulateOption);
      } else if (typeof populate === "object") {
        populateObj.populate = processPopulateOption(populate);
      } else {
        populateObj.populate = populate;
      }
    }

    return populateObj;
  };

  if (params.populateArray && Array.isArray(params.populateArray)) {
    params.populateArray.forEach((populateOption: any) => {
      const populateObj = processPopulateOption(populateOption);
      query.populate(populateObj);
    });
  } else if (params.populateArray) {
    query.populate(processPopulateOption(params.populateArray));
  }

  query.projection(params.projection);
  query.setOptions(params.options);
  query.lean(params.lean);
  if (!params.includeArchived) {
    query.where({ "archive.status": { $ne: true } });
  }
  if (params.match) {
    query.where(params.match);
  }

  if (params.limit) {
    query.limit(params.limit);
  }

  if (params.skip) {
    query.skip(params.skip);
  }

  return query.exec().then(async (sections: any) => {
    const shouldProcessAssessments = params.populateArray?.some(
      (p: any) => p.path === "assessments"
    );

    const currentUserId = params.currentUserId || null;
    if (params.populateArray && sections.length > 0) {
      const paginationOptions = params.populateArray.filter(
        (p: PopulationOption) => p.count || p.pagination
      );
      if (paginationOptions.length > 0) {
        await applyPaginationToPopulatedFields(Section, sections, paginationOptions);
      }
    }

    if (shouldProcessAssessments && currentUserId) {
      for (const section of sections) {
        processUserAssessments(section, currentUserId);
      }
    }

    if (params.lean && sections && sections.length > 0) {
      const sectionIds = sections.map((section: any) => section._id);
      const studentCounts = await Section.aggregate([
        { $match: { _id: { $in: sectionIds } } },
        { $project: { _id: 1, totalStudent: { $size: "$students" } } },
      ]);
      const countMap = new Map(
        studentCounts.map((item: any) => [item._id.toString(), item.totalStudent])
      );
      for (const section of sections) {
        section.totalStudent = countMap.get(section._id.toString()) || 0;
      }
    }

    return sections;
  });
}

async function searchAndUpdate(
  query: FilterQuery<ISection>,
  update?: UpdateQuery<ISection>,
  options?: { multi?: boolean }
): Promise<ISection | null | { modifiedCount: number }> {
  if (!update) {
    return Section.findOne(query);
  }

  if (options?.multi) {
    const result = await Section.updateMany(query, update);
    return { modifiedCount: result.modifiedCount };
  }

  return Section.findOneAndUpdate(query, update, { new: true });
}

async function findOrCreate(query: any): Promise<ISection | null> {
  return await Section.findOne(query).lean();
}

async function getSectionAttendance(
  sectionCode: string,
  startDate: Date,
  organizationId?: mongoose.Types.ObjectId | string,
  studentId?: string,
  endDate?: Date
): Promise<{ data: any; totalEnrolled: number }> {
  const { formattedDates } = formatDatesForAttendance(startDate, endDate);
  const query: any = { code: sectionCode };
  if (organizationId) {
    query.organizationId = new mongoose.Types.ObjectId(organizationId.toString());
  }
  const studentFilter = studentId
    ? [
        {
          $match: {
            "studentDetails._id": new mongoose.Types.ObjectId(studentId),
          },
        },
      ]
    : [];

  const result = await Section.aggregate([
    { $match: query },

    {
      $lookup: {
        from: "users",
        localField: "students",
        foreignField: "_id",
        as: "studentDetails",
      },
    },

    {
      $facet: {
        dates: [
          {
            $project: {
              _id: 0,
              items: formattedDates.map((d) => ({
                day: d.dayNumber,
                weekday: d.weekday,
              })),
            },
          },
          { $unwind: "$items" },
          { $replaceRoot: { newRoot: "$items" } },
        ],

        students: [
          { $unwind: "$studentDetails" },
          ...studentFilter,
          {
            $project: {
              _id: "$studentDetails._id",
              name: {
                $concat: ["$studentDetails.firstName", " ", "$studentDetails.lastName"],
              },
              avatar: {
                $cond: [
                  { $ne: ["$studentDetails.avatar", null] },
                  "$studentDetails.avatar",
                  {
                    $cond: [
                      { $ne: ["$studentDetails.profileImage", null] },
                      "$studentDetails.profileImage",
                      {
                        $concat: [
                          "https://gravatar.com/avatar/",
                          { $toString: "$studentDetails._id" },
                        ],
                      },
                    ],
                  },
                ],
              },
              schedule: 1,
              studentId: "$studentDetails._id",
              attendance: "$attendance",
              formattedDates: { $literal: formattedDates },
            },
          },
          { $sort: { name: 1 } },
          {
            $project: {
              _id: 1,
              name: 1,
              avatar: 1,
              attendance: {
                $map: {
                  input: "$formattedDates",
                  as: "day",
                  in: {
                    label: {
                      $let: {
                        vars: {
                          isClassDay: {
                            $in: [
                              { $toString: "$$day.dayKey" },
                              {
                                $map: {
                                  input: { $ifNull: ["$schedule.breakdown", []] },
                                  as: "schedDay",
                                  in: {
                                    $switch: {
                                      branches: [
                                        {
                                          case: { $eq: [{ $toLower: "$$schedDay.day" }, "sun"] },
                                          then: "0",
                                        },
                                        {
                                          case: { $eq: [{ $toLower: "$$schedDay.day" }, "mon"] },
                                          then: "1",
                                        },
                                        {
                                          case: { $eq: [{ $toLower: "$$schedDay.day" }, "tue"] },
                                          then: "2",
                                        },
                                        {
                                          case: { $eq: [{ $toLower: "$$schedDay.day" }, "wed"] },
                                          then: "3",
                                        },
                                        {
                                          case: { $eq: [{ $toLower: "$$schedDay.day" }, "thu"] },
                                          then: "4",
                                        },
                                        {
                                          case: { $eq: [{ $toLower: "$$schedDay.day" }, "fri"] },
                                          then: "5",
                                        },
                                        {
                                          case: { $eq: [{ $toLower: "$$schedDay.day" }, "sat"] },
                                          then: "6",
                                        },
                                      ],
                                      default: "-1",
                                    },
                                  },
                                },
                              },
                            ],
                          },
                          attendanceRecord: {
                            $let: {
                              vars: {
                                studentRecords: {
                                  $filter: {
                                    input: "$attendance",
                                    as: "record",
                                    cond: {
                                      $and: [
                                        { $eq: ["$$record.userType", "student"] },
                                        {
                                          $eq: [
                                            { $toString: "$$record.userId" },
                                            { $toString: "$_id" },
                                          ],
                                        },
                                      ],
                                    },
                                  },
                                },
                              },
                              in: {
                                $reduce: {
                                  input: "$$studentRecords",
                                  initialValue: null,
                                  in: {
                                    $cond: {
                                      if: {
                                        $and: [
                                          { $gte: ["$$this.date", "$$day.dateStart"] },
                                          { $lte: ["$$this.date", "$$day.dateEnd"] },
                                        ],
                                      },
                                      then: "$$this",
                                      else: "$$value",
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                        in: {
                          $cond: [
                            { $not: "$$isClassDay" },
                            "noClass",
                            {
                              $cond: [
                                { $gt: ["$$day.date", new Date()] },
                                "class not started yet",
                                {
                                  $cond: [
                                    { $eq: ["$$attendanceRecord", null] },
                                    "absent",
                                    "$$attendanceRecord.status",
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                      },
                    },
                    attendanceId: {
                      $let: {
                        vars: {
                          isClassDay: {
                            $in: [
                              { $toString: "$$day.dayKey" },
                              {
                                $map: {
                                  input: { $ifNull: ["$schedule.breakdown", []] },
                                  as: "schedDay",
                                  in: {
                                    $switch: {
                                      branches: [
                                        {
                                          case: { $eq: [{ $toLower: "$$schedDay.day" }, "sun"] },
                                          then: "0",
                                        },
                                        {
                                          case: { $eq: [{ $toLower: "$$schedDay.day" }, "mon"] },
                                          then: "1",
                                        },
                                        {
                                          case: { $eq: [{ $toLower: "$$schedDay.day" }, "tue"] },
                                          then: "2",
                                        },
                                        {
                                          case: { $eq: [{ $toLower: "$$schedDay.day" }, "wed"] },
                                          then: "3",
                                        },
                                        {
                                          case: { $eq: [{ $toLower: "$$schedDay.day" }, "thu"] },
                                          then: "4",
                                        },
                                        {
                                          case: { $eq: [{ $toLower: "$$schedDay.day" }, "fri"] },
                                          then: "5",
                                        },
                                        {
                                          case: { $eq: [{ $toLower: "$$schedDay.day" }, "sat"] },
                                          then: "6",
                                        },
                                      ],
                                      default: "-1",
                                    },
                                  },
                                },
                              },
                            ],
                          },
                          attendanceId: {
                            $let: {
                              vars: {
                                studentRecords: {
                                  $filter: {
                                    input: "$attendance",
                                    as: "record",
                                    cond: {
                                      $and: [
                                        { $eq: ["$$record.userType", "student"] },
                                        {
                                          $eq: [
                                            { $toString: "$$record.userId" },
                                            { $toString: "$_id" },
                                          ],
                                        },
                                      ],
                                    },
                                  },
                                },
                              },
                              in: {
                                $reduce: {
                                  input: "$$studentRecords",
                                  initialValue: null,
                                  in: {
                                    $cond: {
                                      if: {
                                        $and: [
                                          { $gte: ["$$this.date", "$$day.dateStart"] },
                                          { $lte: ["$$this.date", "$$day.dateEnd"] },
                                        ],
                                      },
                                      then: "$$this._id",
                                      else: "$$value",
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                        in: {
                          $cond: [
                            { $not: "$$isClassDay" },
                            null,
                            {
                              $cond: [{ $gt: ["$$day.date", new Date()] }, null, "$$attendanceId"],
                            },
                          ],
                        },
                      },
                    },
                    day: "$$day.dayNumber",
                    weekday: "$$day.weekday",
                  },
                },
              },
            },
          },
        ],

        totalEnrolled: [
          {
            $project: {
              count: { $size: "$students" },
            },
          },
        ],
      },
    },
  ]).exec();

  if (!result || !result[0]) {
    throw new Error("Section not found");
  }

  const totalEnrolled: number = result[0].totalEnrolled[0]?.count || 0;

  return {
    data: {
      dates: result[0].dates || [],
      students: result[0].students || [],
    },
    totalEnrolled,
  };
}

async function getSectionAssessment(
  sectionCode: string,
  userId: string
): Promise<{ pendingAssessment: number; assessmentId: string[] }> {
  const query: any = { code: sectionCode };
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const result = await Section.aggregate([
    { $match: query },

    {
      $match: {
        students: userObjectId,
      },
    },

    {
      $lookup: {
        from: "users",
        localField: "students",
        foreignField: "_id",
        as: "studentDetails",
        pipeline: [
          { $match: { _id: userObjectId } },
          { $limit: 1 },
          { $project: { _id: 1, studentAssessmentResults: 1 } },
        ],
      },
    },

    {
      $addFields: {
        student: { $arrayElemAt: ["$studentDetails", 0] },
      },
    },

    {
      $lookup: {
        from: "assessments",
        localField: "assessments",
        foreignField: "_id",
        as: "assessmentDetails",
      },
    },

    {
      $addFields: {
        assessmentDetails: {
          $filter: {
            input: "$assessmentDetails",
            as: "assessment",
            cond: { $eq: ["$$assessment.isDeleted", false] },
          },
        },
        completedAssessmentIds: {
          $map: {
            input: {
              $filter: {
                input: { $ifNull: ["$student.studentAssessmentResults", []] },
                as: "result",
                cond: { $eq: ["$$result.isFinished", true] },
              },
            },
            as: "result",
            in: { $toString: "$$result.assessmentId" },
          },
        },
      },
    },

    {
      $facet: {
        totalAssessments: [{ $project: { count: { $size: "$assessmentDetails" } } }, { $limit: 1 }],
        pendingAssessments: [
          {
            $project: {
              assessmentDetails: {
                $filter: {
                  input: "$assessmentDetails",
                  as: "assessment",
                  cond: {
                    $not: [
                      {
                        $in: [{ $toString: "$$assessment._id" }, "$completedAssessmentIds"],
                      },
                    ],
                  },
                },
              },
            },
          },
          { $project: { count: { $size: "$assessmentDetails" }, ids: "$assessmentDetails._id" } },
          { $limit: 1 },
        ],
      },
    },

    {
      $project: {
        pendingAssessment: {
          $ifNull: [{ $arrayElemAt: ["$pendingAssessments.count", 0] }, 0],
        },
        assessmentId: {
          $ifNull: [{ $arrayElemAt: ["$pendingAssessments.ids", 0] }, []],
        },
        totalAssessments: {
          $ifNull: [{ $arrayElemAt: ["$totalAssessments.count", 0] }, 0],
        },
      },
    },
  ]);

  if (!result || result.length === 0) {
    return { pendingAssessment: 0, assessmentId: [] };
  }

  return {
    pendingAssessment: result[0].pendingAssessment,
    assessmentId: result[0].assessmentId,
  };
}

async function bulkAddStudents(
  sectionCode: string,
  userIds: string[]
): Promise<{
  section: ISection | null;
  results: { success: string[]; errors: { id: string; message: string; row?: number }[] };
}> {
  const section = await Section.findOne({ code: sectionCode });
  if (!section) {
    throw new Error("Section not found");
  }

  const results = {
    success: [] as string[],
    errors: [] as { id: string; message: string; row?: number }[],
  };

  userIds.forEach((userId, index) => {
    const objectId = new mongoose.Types.ObjectId(userId);
    if (section.students.some((id) => id.equals(objectId))) {
      results.errors.push({
        id: userId,
        message: "Student already exists in this section",
        row: index + 1,
      });
    } else {
      results.success.push(userId);
    }
  });

  if (results.success.length > 0) {
    const updatedSection = await Section.findOneAndUpdate(
      { code: sectionCode },
      {
        $addToSet: { students: { $each: results.success } },
      },
      { new: true }
    ).exec();

    if (updatedSection) {
      const currentTotal = updatedSection.totalStudent || 0;
      const newTotal = currentTotal + results.success.length;

      await Section.findByIdAndUpdate(
        updatedSection._id,
        { $set: { totalStudent: newTotal } },
        { new: true }
      ).exec();

      const refreshedSection = await Section.findById(updatedSection._id).exec();
      return { section: refreshedSection, results };
    }

    return { section, results };
  }

  return { section, results };
}

interface Section {
  assessments: Assessment[];
  students: any[];
  [key: string]: any;
}
function processUserAssessments(section: Section, currentUserId: string): void {
  if (!section.assessments?.length || !section.students?.length) {
    return;
  }
  const currentUserData = section.students.find(
    (student) => student._id?.toString() === currentUserId
  );
  const validAssessments: Assessment[] = [];
  let incompleteAssessmentCount = 0;
  const studentResults = currentUserData?.studentAssessmentResults || [];
  const hasAssessmentResults = studentResults.length > 0;
  const assessmentMap = hasAssessmentResults
    ? new Map<string, { isFinished: boolean; exists: boolean }>(
        studentResults
          .filter((result: any) => result.assessmentId)
          .map((result: any) => [
            result.assessmentId!.toString(),
            { isFinished: !!result.isFinished, exists: true },
          ])
      )
    : null;

  for (const assessment of section.assessments) {
    if ("pendingAssessment" in assessment) {
      continue;
    }
    const assessmentId = assessment._id?.toString();
    if (!assessmentId) continue;
    if (hasAssessmentResults && assessmentMap) {
      const status = assessmentMap.get(assessmentId);
      assessment.isCompleted = status?.isFinished ?? false;
    } else {
      assessment.isCompleted = false;
    }
    if (!assessment.isCompleted) {
      incompleteAssessmentCount++;
    }
    validAssessments.push(assessment);
  }
  section.assessments = validAssessments;
  (section as any).pendingAssessment = incompleteAssessmentCount;
}

function archiveSection(id: string): Promise<ISection | null> {
  return Section.findByIdAndUpdate(
    id,
    {
      $set: {
        "archive.status": true,
        "archive.date": new Date(),
      },
    },
    { new: true }
  );
}

/**
 * Get analytics for student grades in a section
 * @param sectionCode - The code of the section
 * @returns Analytics data for student grades
 */
async function getSectionStudentGradesAnalytics(sectionCode: string): Promise<any> {
  try {
    const section = await Section.findOne({ code: sectionCode, "archive.status": false })
      .populate<{ grade: IGrade | null }>({
        path: "grade",
        model: "Grade",
      })
      .populate({
        path: "students",
        match: { "archive.status": false },
        select: "_id firstName lastName studentAssessmentResults avatar",
      })
      .populate({
        path: "assessments",
        match: { "archive.status": false, isDeleted: { $ne: true } },
        select: "_id type totalPoints",
      })
      .lean();

    if (!section) {
      throw new Error("Section not found");
    }

    const assessmentMap = new Map(
      section.assessments?.map((asm: any) => [
        asm._id.toString(),
        { type: asm.type, totalPoints: asm.totalPoints },
      ]) || []
    );

    const totalStudentsEnrolled: number = section.students?.length || 0;

    if (
      totalStudentsEnrolled === 0 ||
      !section.grade ||
      !section.grade.gradingScale ||
      !section.grade.gradeDistribution
    ) {
      return {
        totalStudentsEnrolled,
        averageFinalGrade: 0,
        topGradesPercent: 0,
        gradeData: [],
        individualGrades: [],
      };
    }

    const gradeLabels = section.grade.gradingScale.map((scale: any) => scale.gradeLabel).sort();
    const gradeDistribution: {
      _id: mongoose.Types.ObjectId;
      labels: string[];
      values: number[];
      totalStudents: number;
      gradeDetails: Array<{
        gradeLabel: string;
        count: number;
        students: Array<{
          id: any;
          average: number;
        }>;
      }>;
    } = {
      _id: new mongoose.Types.ObjectId(),
      labels: gradeLabels,
      values: Array(gradeLabels.length).fill(0),
      totalStudents: totalStudentsEnrolled,
      gradeDetails: gradeLabels.map((label: string) => ({
        gradeLabel: label,
        count: 0,
        students: [],
      })),
    };

    let sumFinalNumericGrades = 0;
    let countStudentsWithValidGrades = 0;
    let topGradesCount = 0;

    const individualGrades: Array<{
      id: string;
      avatar: string;
      name: string;
      finalGrade: string | null;
      assignmentAverage: string | null;
      quizAverage: string | null;
      finalExam: string | null;
      attendance: string | null;
      attendanceDetails: {
        presentDays: number;
        totalDays: number;
      } | null;
    }> = [];

    // Use the section's _id (already found above) to fetch attendance + schedule.
    // Avoids re-querying by code with an archive condition that may not match all documents.
    const sectionForAttendance = await Section.findById((section as any)._id, {
      attendance: 1,
      schedule: 1,
    }).lean();
    const sectionAttendanceRecords: any[] = (sectionForAttendance as any)?.attendance || [];
    const sectionSchedule: any =
      (sectionForAttendance as any)?.schedule ?? (section as any).schedule;

    const enrolledStudentObjectIds: mongoose.Types.ObjectId[] = (section.students || [])
      .map((student: any) => {
        const studentId = student?._id?.toString();
        return studentId && mongoose.isValidObjectId(studentId)
          ? new mongoose.Types.ObjectId(studentId)
          : null;
      })
      .filter((id: mongoose.Types.ObjectId | null): id is mongoose.Types.ObjectId => id !== null);

    const attendanceFromCollection: any[] =
      enrolledStudentObjectIds.length > 0
        ? await Attendance.find({
            section: (section as any)._id,
            userType: "student",
            userId: { $in: enrolledStudentObjectIds },
            "archive.status": { $ne: true },
          })
            .select("userId date status")
            .lean()
        : [];

    const attendanceByStudentFromCollection = new Map<string, any[]>();
    for (const record of attendanceFromCollection) {
      const key = record.userId?.toString();
      if (!key) continue;
      if (!attendanceByStudentFromCollection.has(key)) {
        attendanceByStudentFromCollection.set(key, []);
      }
      attendanceByStudentFromCollection.get(key)!.push(record);
    }

    const normalizeDateKey = (value: Date | string | undefined | null): string | null => {
      if (!value) return null;
      const date = new Date(value);
      if (isNaN(date.getTime())) return null;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const attendanceStatusPriority: Record<string, number> = {
      present: 4,
      late: 3,
      excused: 2,
      absent: 1,
    };

    const mergeStudentAttendanceRecords = (records: any[]) => {
      const mergedByDate = new Map<string, any>();

      for (const record of records) {
        const dateKey = normalizeDateKey(record?.date);
        if (!dateKey) continue;
        const nextStatus = String(record?.status || "").toLowerCase();
        const existing = mergedByDate.get(dateKey);

        if (!existing) {
          mergedByDate.set(dateKey, record);
          continue;
        }

        const existingStatus = String(existing?.status || "").toLowerCase();
        const existingPriority = attendanceStatusPriority[existingStatus] || 0;
        const nextPriority = attendanceStatusPriority[nextStatus] || 0;

        if (nextPriority >= existingPriority) {
          mergedByDate.set(dateKey, record);
        }
      }

      return Array.from(mergedByDate.values());
    };

    for (const student of section.students || []) {
      const attemptedAssessmentTypes = {
        quiz: false,
        assignment: false,
        final: false,
      };

      const studentResults =
        typeof student === "object" && student !== null
          ? (student as any).studentAssessmentResults?.filter(
              (result: any) =>
                result.sectionCode === sectionCode &&
                result.isFinished &&
                !result.isDeleted &&
                assessmentMap.has(result.assessmentId?.toString())
            )
          : [];

      const scoresByType = {
        quiz: { totalScore: 0, totalMaxPoints: 0, count: 0 },
        assignment: { totalScore: 0, totalMaxPoints: 0, count: 0 },
        final: { totalScore: 0, totalMaxPoints: 0, count: 0 },
      };

      const assessmentsByType = {
        quiz: [] as any[],
        assignment: [] as any[],
        final: [] as any[],
      };

      if (section.assessments && section.assessments.length > 0) {
        section.assessments.forEach((assessment: any) => {
          const typeKey = assessment.type?.toLowerCase().includes("final")
            ? "final"
            : assessment.type?.toLowerCase();

          if (typeKey && typeKey in assessmentsByType) {
            assessmentsByType[typeKey as keyof typeof assessmentsByType].push(assessment);
          }
        });
      }

      studentResults.forEach((result: any) => {
        const assessmentInfo = assessmentMap.get(result.assessmentId?.toString());
        if (!assessmentInfo) return;

        const typeKey = assessmentInfo.type?.toLowerCase().includes("final")
          ? "final"
          : assessmentInfo.type?.toLowerCase();

        if (typeKey && scoresByType[typeKey as keyof typeof scoresByType]) {
          attemptedAssessmentTypes[typeKey as keyof typeof attemptedAssessmentTypes] = true;

          if (assessmentInfo.totalPoints > 0) {
            scoresByType[typeKey as keyof typeof scoresByType].totalScore += result.totalScore || 0;
            scoresByType[typeKey as keyof typeof scoresByType].totalMaxPoints +=
              assessmentInfo.totalPoints;
            scoresByType[typeKey as keyof typeof scoresByType].count++;
          }
        }
      });

      const completedAssessmentIds = new Set(
        studentResults.map((result: any) => result.assessmentId?.toString())
      );

      const hasTakenAssessments = {
        quiz: false,
        assignment: false,
        final: false,
      };

      studentResults.forEach((result: any) => {
        const assessmentInfo = assessmentMap.get(result.assessmentId?.toString());
        if (!assessmentInfo) return;

        const typeKey = assessmentInfo.type?.toLowerCase().includes("final")
          ? "final"
          : assessmentInfo.type?.toLowerCase();

        if (typeKey && typeKey in hasTakenAssessments) {
          hasTakenAssessments[typeKey as keyof typeof hasTakenAssessments] = true;
        }
      });

      Object.keys(assessmentsByType).forEach((typeKey) => {
        const typeAssessments = assessmentsByType[typeKey as keyof typeof assessmentsByType];

        typeAssessments.forEach((assessment: any) => {
          if (
            !completedAssessmentIds.has(assessment._id.toString()) &&
            assessment.totalPoints > 0
          ) {
            if (hasTakenAssessments[typeKey as keyof typeof hasTakenAssessments]) {
              scoresByType[typeKey as keyof typeof scoresByType].totalMaxPoints +=
                assessment.totalPoints;
              scoresByType[typeKey as keyof typeof scoresByType].count++;
            } else {
              attemptedAssessmentTypes[typeKey as keyof typeof attemptedAssessmentTypes] = false;
            }
          }
        });
      });

      const calculateAttendanceStats = () => {
        const studentIdString = student._id.toString();
        const sectionStudentRecords = sectionAttendanceRecords.filter(
          (record: any) =>
            record.userId?.toString() === studentIdString &&
            String(record.userType || "student").toLowerCase() === "student"
        );
        const collectionStudentRecords =
          attendanceByStudentFromCollection.get(studentIdString) || [];
        const allStudentRecords = mergeStudentAttendanceRecords([
          ...sectionStudentRecords,
          ...collectionStudentRecords,
        ]);
        const attendedStatuses = new Set(["present", "late", "excused"]);

        if (allStudentRecords.length === 0) {
          return {
            attendancePercentage: 0,
            hasAttendanceData: false,
            presentDays: 0,
            totalClassDaysCount: 0,
          };
        }

        const fallbackFromRecords = () => {
          const presentDays = allStudentRecords.filter((record: any) =>
            attendedStatuses.has(String(record?.status || "").toLowerCase())
          ).length;
          const totalClassDaysCount = allStudentRecords.length;
          const attendancePercentage =
            totalClassDaysCount > 0 ? (presentDays / totalClassDaysCount) * 100 : 0;

          return {
            attendancePercentage,
            hasAttendanceData: true,
            presentDays,
            totalClassDaysCount,
          };
        };

        if (
          !sectionSchedule ||
          !sectionSchedule.startDate ||
          !sectionSchedule.endDate ||
          !sectionSchedule.breakdown ||
          sectionSchedule.breakdown.length === 0
        ) {
          return fallbackFromRecords();
        }

        const scheduleDaysToNumbers = sectionSchedule.breakdown
          .map((day: { day: string }) => {
            const dayMap: Record<string, number> = {
              sun: 0,
              mon: 1,
              tue: 2,
              wed: 3,
              thu: 4,
              fri: 5,
              sat: 6,
            };
            return dayMap[day.day.toLowerCase()] ?? -1;
          })
          .filter((day: number) => day !== -1);

        if (scheduleDaysToNumbers.length === 0) {
          return fallbackFromRecords();
        }

        const startDate = new Date(sectionSchedule.startDate);
        const endDate = new Date(sectionSchedule.endDate);
        // Only count days that have already occurred (up to today), not future scheduled days
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const cutoffDate = today < endDate ? today : endDate;

        const elapsedClassDays = [];
        const currentDay = new Date(startDate);
        while (currentDay <= cutoffDate) {
          const dayOfWeek = currentDay.getDay();
          if (scheduleDaysToNumbers.includes(dayOfWeek)) {
            elapsedClassDays.push(new Date(currentDay));
          }
          currentDay.setDate(currentDay.getDate() + 1);
        }

        if (elapsedClassDays.length === 0) {
          return fallbackFromRecords();
        }

        const elapsedClassDateSet = new Set(
          elapsedClassDays.map((day: Date) => normalizeDateKey(day)).filter((key) => key !== null)
        );
        const elapsedStudentRecords = allStudentRecords.filter((record: any) => {
          const dateKey = normalizeDateKey(record?.date);
          return dateKey ? elapsedClassDateSet.has(dateKey) : false;
        });

        if (elapsedStudentRecords.length === 0) {
          return {
            attendancePercentage: 0,
            hasAttendanceData: false,
            presentDays: 0,
            totalClassDaysCount: elapsedClassDays.length,
          };
        }

        const presentDays = elapsedStudentRecords.filter((record: any) =>
          attendedStatuses.has(String(record?.status || "").toLowerCase())
        ).length;
        const totalClassDaysCount = elapsedClassDays.length;
        const attendancePercentage = (presentDays / totalClassDaysCount) * 100;

        return {
          attendancePercentage,
          hasAttendanceData: true,
          presentDays,
          totalClassDaysCount,
        };
      };

      const { attendancePercentage, hasAttendanceData, presentDays, totalClassDaysCount } =
        calculateAttendanceStats();

      const getGradeLabel = (percentage: number): string => {
        if (percentage === 0) return "5.00";
        const roundedPercentage = Math.round(percentage);
        const scaleMatch = section.grade?.gradingScale?.find(
          (scale: any) =>
            roundedPercentage >= scale.percentageRange.startRange &&
            roundedPercentage <= scale.percentageRange.endRange
        );
        return scaleMatch ? scaleMatch.gradeLabel : "5.00";
      };

      const getAttendanceGradeLabel = (): string | null => {
        if (!hasAttendanceData) return null;
        const roundedPercentage = Math.round(attendancePercentage);
        const scaleMatch = section.grade?.gradingScale?.find(
          (scale: any) =>
            roundedPercentage >= scale.percentageRange.startRange &&
            roundedPercentage <= scale.percentageRange.endRange
        );
        return scaleMatch ? scaleMatch.gradeLabel : "5.00";
      };

      const getClosestGradeLabel = (avg: number) => {
        if (!gradeLabels.length) return "5.00";
        let closest = gradeLabels[0];
        let minDiff = Math.abs(parseFloat(gradeLabels[0]) - avg);
        for (let i = 1; i < gradeLabels.length; i++) {
          const diff = Math.abs(parseFloat(gradeLabels[i]) - avg);
          if (diff < minDiff) {
            minDiff = diff;
            closest = gradeLabels[i];
          }
        }
        return closest;
      };

      const calcCategoryAverage = (typeKey: string) => {
        const typeAssessments = assessmentsByType[typeKey as keyof typeof assessmentsByType];
        if (!typeAssessments.length) return null;
        let sum = 0;
        let count = 0;
        for (const assessment of typeAssessments) {
          const result = studentResults.find(
            (r: any) => r.assessmentId?.toString() === assessment._id.toString()
          );
          if (result && result.totalScore !== undefined && result.totalPoints !== undefined) {
            const percent =
              result.totalPoints > 0
                ? (result.totalScore / result.totalPoints) * 100
                : result.totalScore > 0
                  ? 100
                  : 0;
            const label = getGradeLabel(percent);
            sum += parseFloat(label);
          } else {
            sum += 5.0;
          }
          count++;
        }
        return count > 0 ? parseFloat((sum / count).toFixed(2)) : null;
      };

      const quizAverage = calcCategoryAverage("quiz");
      const assignmentAverage = calcCategoryAverage("assignment");
      const finalExamAverage = calcCategoryAverage("final");

      const attendanceGradeLabel = hasAttendanceData ? getAttendanceGradeLabel() : null;
      const attendanceNum = attendanceGradeLabel ? parseFloat(attendanceGradeLabel) : null;

      const averages: number[] = [];
      if (assessmentsByType.quiz.length) averages.push(quizAverage !== null ? quizAverage : 5.0);
      if (assessmentsByType.assignment.length)
        averages.push(assignmentAverage !== null ? assignmentAverage : 5.0);
      if (assessmentsByType.final.length)
        averages.push(finalExamAverage !== null ? finalExamAverage : 5.0);
      if (attendanceNum !== null) averages.push(attendanceNum);

      let finalGrade: number | null = null;
      if (averages.length > 0) {
        finalGrade = parseFloat((averages.reduce((a, b) => a + b, 0) / averages.length).toFixed(2));
      }

      const noAssessments =
        !attemptedAssessmentTypes.quiz &&
        !attemptedAssessmentTypes.assignment &&
        !attemptedAssessmentTypes.final;
      const finalGradeDisplay =
        finalGrade !== null && !noAssessments ? finalGrade.toFixed(2) : null;

      if (finalGrade !== null && !noAssessments) {
        sumFinalNumericGrades += finalGrade;
        countStudentsWithValidGrades++;
        if (finalGrade <= 2.0) topGradesCount++;
        const closestLabel = getClosestGradeLabel(finalGrade);
        const labelIndex = gradeLabels.indexOf(closestLabel);
        if (labelIndex >= 0) {
          gradeDistribution.values[labelIndex]++;
          const gradeDetail = gradeDistribution.gradeDetails[labelIndex];
          if (gradeDetail) {
            gradeDetail.count++;
            gradeDetail.students.push({
              id: student._id,
              average: finalGrade,
            });
          }
        }
      }

      const didTakeAny = (typeKey: string) => {
        const typeAssessments = assessmentsByType[typeKey as keyof typeof assessmentsByType];
        if (!typeAssessments.length) return false;
        return typeAssessments.some((assessment: any) =>
          studentResults.some((r: any) => r.assessmentId?.toString() === assessment._id.toString())
        );
      };

      const quizDisplay = didTakeAny("quiz")
        ? quizAverage !== null
          ? quizAverage.toFixed(2)
          : null
        : null;
      const assignmentDisplay = didTakeAny("assignment")
        ? assignmentAverage !== null
          ? assignmentAverage.toFixed(2)
          : null
        : null;
      const finalExamDisplay = didTakeAny("final")
        ? finalExamAverage !== null
          ? finalExamAverage.toFixed(2)
          : null
        : null;

      individualGrades.push({
        id: student._id.toString(),
        avatar: (student as any).avatar || "",
        name: `${(student as any).firstName || ""} ${(student as any).lastName || ""}`.trim(),
        finalGrade: finalGradeDisplay,
        assignmentAverage: assignmentDisplay,
        quizAverage: quizDisplay,
        finalExam: finalExamDisplay,
        attendance: attendanceGradeLabel,
        attendanceDetails: hasAttendanceData
          ? {
              presentDays,
              totalDays: totalClassDaysCount,
            }
          : null,
      });
    }

    const averageFinalGrade =
      countStudentsWithValidGrades > 0
        ? parseFloat((sumFinalNumericGrades / countStudentsWithValidGrades).toFixed(2))
        : 0;

    const topGradesPercent =
      countStudentsWithValidGrades > 0
        ? parseFloat(((topGradesCount / countStudentsWithValidGrades) * 100).toFixed(2))
        : 0;

    gradeDistribution.totalStudents = countStudentsWithValidGrades;

    const uniqueFinalGrades = Array.from(
      new Set(individualGrades.map((g) => g.finalGrade).filter((g) => g !== null))
    ) as string[];
    const allGradeLabels = Array.from(new Set([...gradeLabels, ...uniqueFinalGrades]))
      .map(Number)
      .sort((a, b) => a - b)
      .map((n) => n.toFixed(2));

    const gradeDetails = allGradeLabels.map((label) => ({
      gradeLabel: label,
      count: 0,
      students: [] as { id: any; average: number }[],
    }));

    for (const g of individualGrades) {
      if (g.finalGrade !== null) {
        const idx = allGradeLabels.indexOf(g.finalGrade);
        if (idx !== -1) {
          gradeDetails[idx].count++;
          gradeDetails[idx].students.push({ id: g.id, average: Number(g.finalGrade) });
        }
      }
    }

    gradeDistribution.labels = allGradeLabels;
    gradeDistribution.values = gradeDetails.map((d) => d.count);
    gradeDistribution.gradeDetails = gradeDetails;

    return {
      totalStudentsEnrolled,
      averageFinalGrade,
      topGradesPercent,
      gradeData: [gradeDistribution],
      individualGrades,
    };
  } catch (error) {
    console.error("Error in getSectionStudentGradesAnalytics:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to get section grade analytics: ${error.message}`);
    }
    throw new Error("An unexpected error occurred while getting section grade analytics.");
  }
}

async function findSectionByAttendanceId(attendanceId: string): Promise<ISection | null> {
  if (!attendanceId || !mongoose.isValidObjectId(attendanceId)) {
    throw new Error("Invalid attendance ID");
  }

  return Section.findOne({
    "attendance._id": new mongoose.Types.ObjectId(attendanceId),
  }).exec();
}

async function updateAttendanceStatus(
  sectionId: string | mongoose.Types.ObjectId,
  attendanceId: string,
  status: string,
  remarks?: string
): Promise<ISection | null> {
  const updateQuery: any = { "attendance.$.status": status };

  if (remarks !== undefined) {
    updateQuery["attendance.$.remarks"] = remarks;
  }

  return Section.findOneAndUpdate(
    {
      _id: sectionId,
      "attendance._id": new mongoose.Types.ObjectId(attendanceId),
    },
    { $set: updateQuery },
    { new: true }
  ).exec();
}

async function getSectionModules(
  sectionCode: string,
  skip: number = 0,
  limit: number = 10,
  sort: string = "-createdAt"
): Promise<{ data: any[]; pagination: any }> {
  const section = await Section.findOne({ code: sectionCode, "archive.status": { $ne: true } })
    .select("_id modules")
    .lean();

  if (!section) {
    throw new Error("Section not found");
  }

  const totalModules = section.modules ? section.modules.length : 0;
  if (totalModules === 0) {
    return {
      data: [],
      pagination: {
        totalItems: 0,
        totalPages: 0,
        currentPage: 1,
        pageSize: limit,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  }

  const result = await Section.aggregate([
    { $match: { code: sectionCode, "archive.status": { $ne: true } } },
    {
      $lookup: {
        from: "modules",
        localField: "modules",
        foreignField: "_id",
        as: "moduleData",
        pipeline: [
          { $match: { "archive.status": { $ne: true }, isDeleted: { $ne: true } } },
          {
            $sort: sort.startsWith("-") ? { [sort.substring(1)]: -1 } : { [sort]: 1 },
          },
          { $skip: skip },
          { $limit: limit },
          { $project: { _id: 1, title: 1, lessons: 1, createdAt: 1 } },
        ],
      },
    },
    {
      $unwind: {
        path: "$moduleData",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "lessons",
        localField: "moduleData.lessons",
        foreignField: "_id",
        as: "moduleData.lessonData",
        pipeline: [
          { $match: { "archive.status": { $ne: true }, isDeleted: { $ne: true } } },
          { $project: { _id: 1, title: 1, endDate: 1, status: 1, progress: 1 } },
        ],
      },
    },
    {
      $group: {
        _id: "$_id",
        modules: {
          $push: {
            $cond: {
              if: { $ne: ["$moduleData._id", null] },
              then: {
                _id: "$moduleData._id",
                title: "$moduleData.title",
                lessons: "$moduleData.lessonData",
              },
              else: "$$REMOVE",
            },
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        modules: 1,
      },
    },
  ]).exec();

  const page = Math.floor(skip / limit) + 1;
  const totalPages = Math.ceil(totalModules / limit);
  const pagination = {
    totalItems: totalModules,
    totalPages,
    currentPage: page,
    pageSize: limit,
    hasNextPage: skip + limit < totalModules,
    hasPreviousPage: skip > 0,
  };

  const data = result.length > 0 && result[0].modules ? result[0].modules : [];

  return {
    data,
    pagination,
  };
}

async function getSectionByCode(sectionCode: string, queryParams?: any): Promise<ISection | null> {
  let query = Section.findOne({ code: sectionCode, ...(queryParams || {}) });

  if (queryParams?.includeArchived !== true) {
    query = query.where("archive.status").ne(true);
  }
  if (queryParams?.organizationId) {
    query = query.where("organizationId").equals(queryParams.organizationId);
  }

  return query.lean().exec();
}

async function addStudentsToSectionByCode(
  sectionCode: string,
  studentIds: mongoose.Types.ObjectId[],
  organizationId: mongoose.Types.ObjectId
): Promise<ISection | null> {
  const updatedSection = await Section.findOneAndUpdate(
    { code: sectionCode, organizationId },
    { $addToSet: { students: { $each: studentIds } } },
    { new: true }
  ).exec();

  if (updatedSection) {
    const studentCount = updatedSection.students.length;
    await Section.findByIdAndUpdate(
      updatedSection._id,
      { $set: { totalStudent: studentCount } },
      { new: true }
    ).exec();
  }

  return updatedSection;
}

async function getSectionSchedule(
  userId: string,
  type: string = "week",
  startDate?: string,
  endDate?: string
): Promise<any> {
  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const rangeStartDate = startDate ? new Date(startDate) : new Date();
    const rangeEndDate = endDate ? new Date(endDate) : new Date();

    const sections = await Section.find({
      $or: [{ instructor: userObjectId }, { students: userObjectId }],
      "archive.status": { $ne: true },
      "schedule.breakdown": { $exists: true, $ne: [] },
      "schedule.startDate": { $exists: true },
      "schedule.endDate": { $exists: true },
    })
      .select("code name schedule")
      .lean()
      .exec();

    const allScheduleEntries: any[] = [];
    sections.forEach((section) => {
      if (!section.schedule || !section.schedule.breakdown) {
        return;
      }
      const scheduleStartDate = new Date(section.schedule.startDate);
      const scheduleEndDate = new Date(section.schedule.endDate);
      const effectiveStartDate = new Date(
        Math.max(rangeStartDate.getTime(), scheduleStartDate.getTime())
      );
      const effectiveEndDate = new Date(
        Math.min(rangeEndDate.getTime(), scheduleEndDate.getTime())
      );
      if (effectiveStartDate > effectiveEndDate) {
        return;
      }
      const dayMap: { [key: string]: number } = {
        sun: 0,
        mon: 1,
        tue: 2,
        wed: 3,
        thu: 4,
        fri: 5,
        sat: 6,
      };

      const currentDate = new Date(effectiveStartDate);

      while (currentDate <= effectiveEndDate) {
        const dayOfWeek = currentDate.getDay();
        const dayName = Object.keys(dayMap).find((key) => dayMap[key] === dayOfWeek);

        if (dayName) {
          const daySchedule = section.schedule.breakdown.find(
            (item: any) => item.day.toLowerCase() === dayName.toLowerCase()
          );

          if (daySchedule) {
            allScheduleEntries.push({
              date: new Date(currentDate),
              day: dayName,
              time: daySchedule.time,
              sectionCode: section.code,
              sectionName: section.name,
            });
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    const groupedSchedule: { [key: string]: any[] } = {};

    allScheduleEntries.forEach((entry) => {
      const dateKey = new Date(entry.date).toISOString().split("T")[0];

      if (!groupedSchedule[dateKey]) {
        groupedSchedule[dateKey] = [];
      }

      groupedSchedule[dateKey].push(entry);
    });
    if (type === "month") {
      const result = Object.keys(groupedSchedule).map((dateKey) => ({
        date: dateKey,
        count: groupedSchedule[dateKey].length,
      }));
      result.sort((a, b) => a.date.localeCompare(b.date));

      return result;
    } else {
      Object.keys(groupedSchedule).forEach((dateKey) => {
        groupedSchedule[dateKey].sort((a, b) => a.time.start.localeCompare(b.time.start));
      });
      const result = Object.keys(groupedSchedule).map((dateKey) => ({
        date: dateKey,
        schedule: groupedSchedule[dateKey],
      }));
      result.sort((a, b) => a.date.localeCompare(b.date));

      return result;
    }
  } catch (error) {
    throw new Error(`Error fetching section schedule: ${error}`);
  }
}
