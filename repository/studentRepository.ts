import { FilterQuery, UpdateQuery } from "mongoose";
import Student, { IStudent } from "../models/studentModel";
import mongoose from "mongoose";
import { Types } from "mongoose";
import { getCalendarDateInfo } from "../utils/formatDate";

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

const studentRepository = {
  getStudent,
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  searchStudent,
  searchAndUpdate,
  findOrCreate,
  getStudentsCount,
  studentDashboard,
  studentCalendar,
  bulkCreate,
  getStudentGradeBySection,
  archiveStudent,
};

export default studentRepository;

function getStudent(id: string, dbParams: DbParams = {}): Promise<IStudent | null> {
  let query = Student.findById(id);

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
    select: dbParams.options?.select || "_id",
    lean: dbParams.options?.lean || true,
  };

  query = query.select(options.select).lean(options.lean);
  if (dbParams.query?.organizationId) {
    query.where("organizationId").equals(dbParams.query.organizationId);
  }

  return query.exec();
}

function getStudents(dbParams: DbParams): Promise<IStudent[]> {
  let query = Student.find(dbParams.query || {});

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

  return query.exec();
}

function createStudent(data: Partial<IStudent>): Promise<IStudent> {
  return Student.create(data);
}

function getStudentsCount(query: any): Promise<number> {
  return Student.countDocuments(query).exec();
}

function updateStudent(data: Partial<IStudent>): Promise<IStudent | null> {
  return Student.findByIdAndUpdate(data._id, data, { new: true });
}

function deleteStudent(id: string): Promise<IStudent | null> {
  return Student.findByIdAndDelete(id);
}

function searchStudent(params: any = {}): Promise<IStudent[]> {
  const query = Student.find();
  query.setQuery(params.query);
  query.populate(params.populateArray);
  query.projection(params.projection);
  query.setOptions(params.options);
  query.lean(params.lean);
  if (!params.includeArchived) {
    query.where({ "archive.status": { $ne: true } });
  }

  if (params.match) {
    query.where(params.match);
  }
  return query.exec();
}

async function searchAndUpdate(
  query: FilterQuery<IStudent>,
  update?: UpdateQuery<IStudent>,
  options?: { multi?: boolean }
): Promise<IStudent | null | { modifiedCount: number }> {
  if (!update) {
    return Student.findOne(query);
  }

  if (options?.multi) {
    const result = await Student.updateMany(query, update);
    return { modifiedCount: result.modifiedCount };
  }

  return Student.findOneAndUpdate(query, update, { new: true });
}

async function findOrCreate(query: any): Promise<IStudent | null> {
  return await Student.findOne(query).lean();
}

async function studentDashboard(id: string, dbParams: DbParams = {}): Promise<any> {
  const Section = mongoose.model("Section");
  const studentObjectId = new mongoose.Types.ObjectId(id);
  const organizationId = new mongoose.Types.ObjectId(dbParams.query?.organizationId);

  const assessmentStatus = {
    $switch: {
      branches: [
        {
          case: {
            $lte: [{ $dateDiff: { startDate: "$$NOW", endDate: "$$endDate", unit: "day" } }, 0],
          },
          then: "Today",
        },
        {
          case: {
            $lte: [{ $dateDiff: { startDate: "$$NOW", endDate: "$$endDate", unit: "day" } }, 1],
          },
          then: "Tomorrow",
        },
      ],
      default: "Upcoming",
    },
  };

  const normalizeEndDate = {
    $cond: {
      if: { $eq: [{ $type: "$$endDate" }, "date"] },
      then: "$$endDate",
      else: { $toDate: { $ifNull: ["$$endDate", new Date()] } },
    },
  };

  const results = await Section.aggregate([
    {
      $match: {
        organizationId,
        students: studentObjectId,
      },
    },
    {
      $lookup: {
        from: "courses",
        localField: "course",
        foreignField: "_id",
        as: "courseInfo",
        pipeline: [
          {
            $project: {
              _id: 1,
              title: 1,
              code: 1,
              thumbnail: 1,
              status: 1,
              updatedAt: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "assessments",
        localField: "assessments",
        foreignField: "_id",
        as: "assessments",
        pipeline: [
          {
            $project: {
              _id: 1,
              title: 1,
              type: 1,
              endDate: 1,
              maxScore: 1,
              totalPoints: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "announcements",
        localField: "announcements",
        foreignField: "_id",
        as: "announcements",
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: [{ $ifNull: ["$archive.status", false] }, false] },
                  { $eq: [{ $ifNull: ["$isPublished", true] }, true] },
                ],
              },
            },
          },
          {
            $lookup: {
              from: "users",
              localField: "author",
              foreignField: "_id",
              as: "authorInfo",
              pipeline: [{ $project: { firstName: 1, lastName: 1 } }],
            },
          },
          { $unwind: { path: "$authorInfo", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 1,
              title: 1,
              textBody: 1,
              publishDate: 1,
              authorName: {
                $concat: [
                  { $ifNull: ["$authorInfo.firstName", "Uzaro"] },
                  " ",
                  { $ifNull: ["$authorInfo.lastName", "admin"] },
                ],
              },
              authorImage: {
                $concat: [
                  "https://ui-avatars.com/api/?name=",
                  { $ifNull: ["$authorInfo.firstName", "Uzaro"] },
                  "+",
                  { $ifNull: ["$authorInfo.lastName", "admin"] },
                  "&background=random",
                ],
              },
              content: { $ifNull: ["$textBody", ""] },
              postedAt: { $ifNull: ["$publishDate", new Date()] },
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "studentassessmentresults",
        let: { studentId: studentObjectId, sectionId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$studentId", "$$studentId"] },
                  { $eq: ["$sectionId", "$$sectionId"] },
                ],
              },
            },
          },
        ],
        as: "results",
      },
    },
    {
      $facet: {
        assignmentData: [
          { $unwind: "$assessments" },
          { $match: { "assessments.type": "assignment" } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              critical: {
                $sum: {
                  $cond: [
                    {
                      $lte: [
                        {
                          $dateDiff: {
                            startDate: "$$NOW",
                            endDate: {
                              $let: {
                                vars: { endDate: "$assessments.endDate" },
                                in: normalizeEndDate,
                              },
                            },
                            unit: "day",
                          },
                        },
                        1,
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
          { $project: { _id: 0, total: 1, critical: 1 } },
        ],

        continueWorking: [
          {
            $project: {
              value: "$code",
              label: {
                $concat: [
                  "Progress (0%)",
                  {
                    $toString: {
                      $multiply: [
                        {
                          $cond: {
                            if: { $eq: [{ $size: { $ifNull: ["$results", []] } }, 0] },
                            then: 0,
                            else: {
                              $divide: [
                                {
                                  $size: {
                                    $filter: {
                                      input: "$results",
                                      as: "r",
                                      cond: { $eq: ["$$r.isPassed", true] },
                                    },
                                  },
                                },
                                { $size: "$results" },
                              ],
                            },
                          },
                        },
                        100,
                      ],
                    },
                  },
                ],
              },
            },
          },
          { $limit: 3 },
        ],

        comingUp: [
          {
            $unwind: {
              path: "$schedule.breakdown",
              preserveNullAndEmptyArrays: false,
            },
          },
          {
            $addFields: {
              _dayNumber: {
                $switch: {
                  branches: [
                    { case: { $eq: ["$schedule.breakdown.day", "sun"] }, then: 1 },
                    { case: { $eq: ["$schedule.breakdown.day", "mon"] }, then: 2 },
                    { case: { $eq: ["$schedule.breakdown.day", "tue"] }, then: 3 },
                    { case: { $eq: ["$schedule.breakdown.day", "wed"] }, then: 4 },
                    { case: { $eq: ["$schedule.breakdown.day", "thu"] }, then: 5 },
                    { case: { $eq: ["$schedule.breakdown.day", "fri"] }, then: 6 },
                    { case: { $eq: ["$schedule.breakdown.day", "sat"] }, then: 7 },
                  ],
                  default: 0,
                },
              },
            },
          },
          {
            $match: {
              $expr: {
                $eq: ["$_dayNumber", { $dayOfWeek: { date: "$$NOW", timezone: "Asia/Manila" } }],
              },
            },
          },
          {
            $project: {
              _id: 0,
              type: { $literal: "Live Q&A Session" },
              title: { $concat: ["Meeting for ", "$code"] },
              points: { $literal: 0 },
              dueDate: { $ifNull: ["$schedule.breakdown.time.start", "08:00 AM"] },
              status: { $literal: "Today" },
              sortDate: { $literal: new Date() },
            },
          },

          {
            $unionWith: {
              coll: "assessments",
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        {
                          $gte: [
                            {
                              $cond: {
                                if: { $eq: [{ $type: "$endDate" }, "date"] },
                                then: "$endDate",
                                else: { $toDate: { $ifNull: ["$endDate", new Date()] } },
                              },
                            },
                            {
                              $dateFromParts: {
                                year: { $year: "$$NOW" },
                                month: { $month: "$$NOW" },
                                day: { $dayOfMonth: "$$NOW" },
                              },
                            },
                          ],
                        },
                        {
                          $lte: [
                            {
                              $dateDiff: {
                                startDate: "$$NOW",
                                endDate: {
                                  $cond: {
                                    if: { $eq: [{ $type: "$endDate" }, "date"] },
                                    then: "$endDate",
                                    else: { $toDate: { $ifNull: ["$endDate", new Date()] } },
                                  },
                                },
                                unit: "day",
                              },
                            },
                            3,
                          ],
                        },
                      ],
                    },
                  },
                },
                {
                  $lookup: {
                    from: "sections",
                    let: { sectionId: "$section" },
                    pipeline: [
                      {
                        $match: {
                          $expr: {
                            $and: [
                              { $eq: ["$_id", "$$sectionId"] },
                              { $in: [studentObjectId, "$students"] },
                            ],
                          },
                        },
                      },
                    ],
                    as: "studentSections",
                  },
                },
                {
                  $match: {
                    $expr: { $gt: [{ $size: "$studentSections" }, 0] },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    type: { $toUpper: "$type" },
                    title: "$title",
                    points: { $ifNull: ["$totalPoints", 0] },
                    dueDate: {
                      $cond: {
                        if: { $eq: [{ $type: "$endDate" }, "date"] },
                        then: "$endDate",
                        else: { $toDate: { $ifNull: ["$endDate", new Date()] } },
                      },
                    },
                    status: {
                      $let: {
                        vars: {
                          endDate: {
                            $cond: {
                              if: { $eq: [{ $type: "$endDate" }, "date"] },
                              then: "$endDate",
                              else: { $toDate: { $ifNull: ["$endDate", new Date()] } },
                            },
                          },
                        },
                        in: assessmentStatus,
                      },
                    },
                    sortDate: {
                      $cond: {
                        if: { $eq: [{ $type: "$endDate" }, "date"] },
                        then: "$endDate",
                        else: { $toDate: { $ifNull: ["$endDate", new Date()] } },
                      },
                    },
                  },
                },
              ],
            },
          },
          { $sort: { sortDate: 1 } },
          { $project: { sortDate: 0 } },
          { $limit: 5 },
        ],

        announcements: [
          { $unwind: "$announcements" },
          { $replaceRoot: { newRoot: "$announcements" } },
          {
            $addFields: {
              normalizedPublishDate: {
                $cond: {
                  if: { $eq: [{ $type: "$publishDate" }, "date"] },
                  then: "$publishDate",
                  else: { $toDate: { $ifNull: ["$publishDate", new Date()] } },
                },
              },
              dateFormatted: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: {
                    $cond: {
                      if: { $eq: [{ $type: "$publishDate" }, "date"] },
                      then: "$publishDate",
                      else: { $toDate: { $ifNull: ["$publishDate", new Date()] } },
                    },
                  },
                },
              },
              todayFormatted: {
                $dateToString: { format: "%Y-%m-%d", date: "$$NOW" },
              },
              tomorrowFormatted: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: {
                    $dateAdd: {
                      startDate: "$$NOW",
                      unit: "day",
                      amount: 1,
                    },
                  },
                },
              },
            },
          },
          {
            $addFields: {
              priorityScore: {
                $cond: [
                  { $eq: ["$dateFormatted", "$todayFormatted"] },
                  3,
                  {
                    $cond: [
                      { $eq: ["$dateFormatted", "$tomorrowFormatted"] },
                      2,
                      {
                        $cond: [{ $lt: ["$normalizedPublishDate", "$$NOW"] }, 1, 0],
                      },
                    ],
                  },
                ],
              },
              isValidAnnouncement: {
                $or: [
                  { $eq: ["$dateFormatted", "$todayFormatted"] },
                  { $eq: ["$dateFormatted", "$tomorrowFormatted"] },
                  { $lt: ["$normalizedPublishDate", "$$NOW"] },
                ],
              },
            },
          },
          {
            $match: {
              isValidAnnouncement: true,
            },
          },
          {
            $group: {
              _id: "$_id",
              authorName: { $first: "$authorName" },
              authorImage: { $first: "$authorImage" },
              content: { $first: "$content" },
              postedAt: { $first: "$normalizedPublishDate" },
              publishDate: { $first: "$normalizedPublishDate" },
              priorityScore: { $first: "$priorityScore" },
              daysFromToday: { $first: "$daysFromToday" },
            },
          },
          {
            $sort: {
              priorityScore: -1,
              daysFromToday: 1,
              _id: 1,
            },
          },
          {
            $project: {
              _id: 1,
              authorName: 1,
              authorImage: 1,
              content: 1,
              postedAt: 1,
              publishDate: 1,
            },
          },
          { $limit: 5 },
        ],

        courses: [
          {
            $project: {
              _id: { $arrayElemAt: ["$courseInfo._id", 0] },
              title: { $arrayElemAt: ["$courseInfo.title", 0] },
              code: { $arrayElemAt: ["$courseInfo.code", 0] },
              thumbnail: { $arrayElemAt: ["$courseInfo.thumbnail", 0] },
              status: { $arrayElemAt: ["$courseInfo.status", 0] },
              updatedAt: { $arrayElemAt: ["$courseInfo.updatedAt", 0] },
            },
          },
          { $match: { _id: { $ne: null } } },
        ],
      },
    },
    {
      $project: {
        assignmentData: {
          $ifNull: [{ $arrayElemAt: ["$assignmentData", 0] }, { total: 0, critical: 0 }],
        },
        continueWorking: { $ifNull: ["$continueWorking", []] },
        comingUp: { $ifNull: ["$comingUp", []] },
        announcements: { $ifNull: ["$announcements", []] },
        courses: { $ifNull: ["$courses", []] },
      },
    },
  ]);
  return (
    results[0] || {
      assignmentData: { total: 0, critical: 0 },
      continueWorking: [],
      comingUp: [],
      announcements: [],
      courses: [],
    }
  );
}

async function studentCalendar(id: string, dbParams: DbParams = {}): Promise<any> {
  if (!id) {
    throw new Error("Student ID is required");
  }

  const Section = mongoose.model("Section");

  const studentObjectId = new Types.ObjectId(id);
  const organizationId = new Types.ObjectId(dbParams.query.organizationId);
  const viewType = dbParams.query.view || "week";

  const {
    currentDateStr,
    tomorrowStr,
    currentHour,
    currentMinute,
    startDate,
    endDate,
    dateFormat,
  } = getCalendarDateInfo(viewType);

  const results = await Section.aggregate([
    {
      $match: {
        organizationId,
        students: studentObjectId,
      },
    },
    {
      $lookup: {
        from: "courses",
        localField: "course",
        foreignField: "_id",
        as: "courseInfo",
      },
    },
    {
      $unwind: {
        path: "$courseInfo",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "instructor",
        foreignField: "_id",
        as: "instructorInfo",
      },
    },
    {
      $unwind: {
        path: "$instructorInfo",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "users",
        let: { studentId: studentObjectId },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$_id", "$$studentId"] },
            },
          },
          {
            $project: {
              _id: 1,
              firstName: 1,
              lastName: 1,
            },
          },
        ],
        as: "studentInfo",
      },
    },
    {
      $unwind: {
        path: "$studentInfo",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "assessments",
        let: {
          sectionId: "$_id",
          startDate: startDate,
          endDate: endDate,
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$sectionId", "$$sectionId"] },
                  {
                    $and: [
                      { $gte: ["$endDate", "$$startDate"] },
                      { $lte: ["$endDate", "$$endDate"] },
                    ],
                  },
                ],
              },
            },
          },
        ],
        as: "upcomingAssessments",
      },
    },
    {
      $addFields: {
        scheduleDays: "$schedule.days",
        calendarEvents: {
          $let: {
            vars: {
              dayMapping: {
                mon: 2,
                tue: 3,
                wed: 4,
                thu: 5,
                fri: 6,
                sat: 7,
                sun: 1,
              },
              dateRange: {
                $map: {
                  input: {
                    $range: [0, { $add: [1, { $dateDiff: { startDate, endDate, unit: "day" } }] }],
                  },
                  as: "dayOffset",
                  in: {
                    date: {
                      $dateAdd: {
                        startDate,
                        unit: "day",
                        amount: "$$dayOffset",
                      },
                    },
                    dayOfWeek: {
                      $dayOfWeek: {
                        $dateAdd: {
                          startDate,
                          unit: "day",
                          amount: "$$dayOffset",
                        },
                      },
                    },
                    dayName: {
                      $switch: {
                        branches: [
                          {
                            case: {
                              $eq: [
                                {
                                  $dayOfWeek: {
                                    $dateAdd: { startDate, unit: "day", amount: "$$dayOffset" },
                                  },
                                },
                                1,
                              ],
                            },
                            then: "Sunday",
                          },
                          {
                            case: {
                              $eq: [
                                {
                                  $dayOfWeek: {
                                    $dateAdd: { startDate, unit: "day", amount: "$$dayOffset" },
                                  },
                                },
                                2,
                              ],
                            },
                            then: "Monday",
                          },
                          {
                            case: {
                              $eq: [
                                {
                                  $dayOfWeek: {
                                    $dateAdd: { startDate, unit: "day", amount: "$$dayOffset" },
                                  },
                                },
                                3,
                              ],
                            },
                            then: "Tuesday",
                          },
                          {
                            case: {
                              $eq: [
                                {
                                  $dayOfWeek: {
                                    $dateAdd: { startDate, unit: "day", amount: "$$dayOffset" },
                                  },
                                },
                                4,
                              ],
                            },
                            then: "Wednesday",
                          },
                          {
                            case: {
                              $eq: [
                                {
                                  $dayOfWeek: {
                                    $dateAdd: { startDate, unit: "day", amount: "$$dayOffset" },
                                  },
                                },
                                5,
                              ],
                            },
                            then: "Thursday",
                          },
                          {
                            case: {
                              $eq: [
                                {
                                  $dayOfWeek: {
                                    $dateAdd: { startDate, unit: "day", amount: "$$dayOffset" },
                                  },
                                },
                                6,
                              ],
                            },
                            then: "Friday",
                          },
                          {
                            case: {
                              $eq: [
                                {
                                  $dayOfWeek: {
                                    $dateAdd: { startDate, unit: "day", amount: "$$dayOffset" },
                                  },
                                },
                                7,
                              ],
                            },
                            then: "Saturday",
                          },
                        ],
                        default: "Unknown",
                      },
                    },
                  },
                },
              },
            },
            in: {
              $let: {
                vars: {
                  mappedDays: {
                    $map: {
                      input: { $ifNull: ["$schedule.days", []] },
                      as: "day",
                      in: { $getField: { field: "$$day", input: "$$dayMapping" } },
                    },
                  },
                },
                in: {
                  mappedDays: "$$mappedDays",
                  filteredEvents: {
                    $filter: {
                      input: "$$dateRange",
                      as: "dateInfo",
                      cond: {
                        $in: ["$$dateInfo.dayOfWeek", "$$mappedDays"],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      $addFields: {
        formattedEvents: {
          $map: {
            input: "$calendarEvents.filteredEvents",
            as: "event",
            in: {
              date: { $dateToString: { format: dateFormat, date: "$$event.date" } },
              id: { $toString: "$_id" },
              title: { $concat: ["Meeting for ", "$code"] },
              startTime: { $ifNull: ["$schedule.time.start", "08:00 AM"] },
              endTime: { $ifNull: ["$schedule.time.end", "10:00 AM"] },
              participants: [
                {
                  id: { $toString: "$instructorInfo._id" },
                  name: {
                    $concat: [
                      { $ifNull: ["$instructorInfo.firstName", ""] },
                      " ",
                      { $ifNull: ["$instructorInfo.lastName", ""] },
                    ],
                  },
                  avatar: {
                    $concat: [
                      "https://ui-avatars.com/api/?name=",
                      { $ifNull: ["$instructorInfo.firstName", "Instructor"] },
                      "+",
                      { $ifNull: ["$instructorInfo.lastName", ""] },
                      "&background=random",
                    ],
                  },
                },
                {
                  id: { $toString: studentObjectId },
                  name: {
                    $concat: [
                      { $ifNull: ["$studentInfo.firstName", ""] },
                      " ",
                      { $ifNull: ["$studentInfo.lastName", ""] },
                    ],
                  },
                  avatar: {
                    $concat: [
                      "https://ui-avatars.com/api/?name=",
                      { $ifNull: ["$studentInfo.firstName", "Student"] },
                      "+",
                      { $ifNull: ["$studentInfo.lastName", ""] },
                      "&background=random",
                    ],
                  },
                },
              ],
              location: { $ifNull: ["$location", "Online"] },
              sectionCode: "$code",
            },
          },
        },
        formattedAssessments: {
          $map: {
            input: "$upcomingAssessments",
            as: "assessment",
            in: {
              id: { $toString: "$$assessment._id" },
              title: {
                $concat: ["$$assessment.title", " (", { $toUpper: "$$assessment.type" }, ")"],
              },
              date: { $dateToString: { format: dateFormat, date: "$$assessment.endDate" } },
              startTime: "23:59",
              endTime: "23:59",
              location: { $concat: ["Section ", "$code"] },
              participants: [
                {
                  id: { $toString: "$instructorInfo._id" },
                  name: {
                    $concat: [
                      { $ifNull: ["$instructorInfo.firstName", ""] },
                      " ",
                      { $ifNull: ["$instructorInfo.lastName", ""] },
                    ],
                  },
                  avatar: {
                    $concat: [
                      "https://ui-avatars.com/api/?name=",
                      { $ifNull: ["$instructorInfo.firstName", "Instructor"] },
                      "+",
                      { $ifNull: ["$instructorInfo.lastName", ""] },
                      "&background=random",
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    },
    {
      $addFields: {
        widerDateRangeEvents: {
          $let: {
            vars: {
              dayMapping: {
                mon: 2,
                tue: 3,
                wed: 4,
                thu: 5,
                fri: 6,
                sat: 7,
                sun: 1,
              },
              widerEndDate: {
                $dateAdd: {
                  startDate: startDate,
                  unit: "day",
                  amount: 30,
                },
              },
              widerDateRange: {
                $map: {
                  input: {
                    $range: [0, 31],
                  },
                  as: "dayOffset",
                  in: {
                    date: {
                      $dateAdd: {
                        startDate: startDate,
                        unit: "day",
                        amount: "$$dayOffset",
                      },
                    },
                    dayOfWeek: {
                      $dayOfWeek: {
                        $dateAdd: {
                          startDate: startDate,
                          unit: "day",
                          amount: "$$dayOffset",
                        },
                      },
                    },
                    dayName: {
                      $switch: {
                        branches: [
                          {
                            case: {
                              $eq: [
                                {
                                  $dayOfWeek: {
                                    $dateAdd: {
                                      startDate: startDate,
                                      unit: "day",
                                      amount: "$$dayOffset",
                                    },
                                  },
                                },
                                1,
                              ],
                            },
                            then: "Sunday",
                          },
                          {
                            case: {
                              $eq: [
                                {
                                  $dayOfWeek: {
                                    $dateAdd: {
                                      startDate: startDate,
                                      unit: "day",
                                      amount: "$$dayOffset",
                                    },
                                  },
                                },
                                2,
                              ],
                            },
                            then: "Monday",
                          },
                          {
                            case: {
                              $eq: [
                                {
                                  $dayOfWeek: {
                                    $dateAdd: {
                                      startDate: startDate,
                                      unit: "day",
                                      amount: "$$dayOffset",
                                    },
                                  },
                                },
                                3,
                              ],
                            },
                            then: "Tuesday",
                          },
                          {
                            case: {
                              $eq: [
                                {
                                  $dayOfWeek: {
                                    $dateAdd: {
                                      startDate: startDate,
                                      unit: "day",
                                      amount: "$$dayOffset",
                                    },
                                  },
                                },
                                4,
                              ],
                            },
                            then: "Wednesday",
                          },
                          {
                            case: {
                              $eq: [
                                {
                                  $dayOfWeek: {
                                    $dateAdd: {
                                      startDate: startDate,
                                      unit: "day",
                                      amount: "$$dayOffset",
                                    },
                                  },
                                },
                                5,
                              ],
                            },
                            then: "Thursday",
                          },
                          {
                            case: {
                              $eq: [
                                {
                                  $dayOfWeek: {
                                    $dateAdd: {
                                      startDate: startDate,
                                      unit: "day",
                                      amount: "$$dayOffset",
                                    },
                                  },
                                },
                                6,
                              ],
                            },
                            then: "Friday",
                          },
                          {
                            case: {
                              $eq: [
                                {
                                  $dayOfWeek: {
                                    $dateAdd: {
                                      startDate: startDate,
                                      unit: "day",
                                      amount: "$$dayOffset",
                                    },
                                  },
                                },
                                7,
                              ],
                            },
                            then: "Saturday",
                          },
                        ],
                        default: "Unknown",
                      },
                    },
                  },
                },
              },
            },
            in: {
              $filter: {
                input: "$$widerDateRange",
                as: "dateInfo",
                cond: {
                  $in: [
                    "$$dateInfo.dayOfWeek",
                    {
                      $map: {
                        input: { $ifNull: ["$schedule.days", []] },
                        as: "day",
                        in: { $getField: { field: "$$day", input: "$$dayMapping" } },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    {
      $addFields: {
        formattedWiderEvents: {
          $map: {
            input: "$widerDateRangeEvents",
            as: "event",
            in: {
              date: { $dateToString: { format: dateFormat, date: "$$event.date" } },
              id: { $toString: "$_id" },
              title: { $concat: ["Meeting for ", "$code"] },
              startTime: { $ifNull: ["$schedule.time.start", "08:00 AM"] },
              endTime: { $ifNull: ["$schedule.time.end", "10:00 AM"] },
              participants: [
                {
                  id: { $toString: "$instructorInfo._id" },
                  name: {
                    $concat: [
                      { $ifNull: ["$instructorInfo.firstName", ""] },
                      " ",
                      { $ifNull: ["$instructorInfo.lastName", ""] },
                    ],
                  },
                  avatar: {
                    $concat: [
                      "https://ui-avatars.com/api/?name=",
                      { $ifNull: ["$instructorInfo.firstName", "Instructor"] },
                      "+",
                      { $ifNull: ["$instructorInfo.lastName", ""] },
                      "&background=random",
                    ],
                  },
                },
                {
                  id: { $toString: studentObjectId },
                  name: {
                    $concat: [
                      { $ifNull: ["$studentInfo.firstName", ""] },
                      " ",
                      { $ifNull: ["$studentInfo.lastName", ""] },
                    ],
                  },
                  avatar: {
                    $concat: [
                      "https://ui-avatars.com/api/?name=",
                      { $ifNull: ["$studentInfo.firstName", "Student"] },
                      "+",
                      { $ifNull: ["$studentInfo.lastName", ""] },
                      "&background=random",
                    ],
                  },
                },
              ],
              location: { $ifNull: ["$location", "Online"] },
              sectionCode: "$code",
            },
          },
        },
      },
    },
    {
      $group: {
        _id: null,
        allEvents: { $push: "$formattedEvents" },
        allAssessments: { $push: "$formattedAssessments" },
        allWiderEvents: { $push: "$formattedWiderEvents" },
      },
    },
    {
      $addFields: {
        flattenedEvents: {
          $reduce: {
            input: "$allEvents",
            initialValue: [],
            in: { $concatArrays: ["$$value", "$$this"] },
          },
        },
        flattenedAssessments: {
          $reduce: {
            input: "$allAssessments",
            initialValue: [],
            in: { $concatArrays: ["$$value", "$$this"] },
          },
        },
        flattenedWiderEvents: {
          $reduce: {
            input: "$allWiderEvents",
            initialValue: [],
            in: { $concatArrays: ["$$value", "$$this"] },
          },
        },
        currentDateStr: { $literal: currentDateStr },
        tomorrowStr: { $literal: tomorrowStr },
        currentHour: { $literal: currentHour },
        currentMinute: { $literal: currentMinute },
        viewType: { $literal: viewType },
      },
    },
    {
      $facet: {
        eventsData: [
          {
            $project: {
              flattenedEvents: 1,
              viewType: 1,
              currentDateStr: 1,
            },
          },
          {
            $addFields: {
              dateRange: {
                $cond: {
                  if: { $in: ["$viewType", ["week", "day"]] },
                  then: {
                    $map: {
                      input: {
                        $range: [
                          0,
                          { $cond: { if: { $eq: ["$viewType", "day"] }, then: 1, else: 5 } },
                        ],
                      },
                      as: "dayOffset",
                      in: {
                        $dateToString: {
                          format: "%Y-%m-%d",
                          date: {
                            $dateAdd: {
                              startDate: { $dateFromString: { dateString: "$currentDateStr" } },
                              unit: "day",
                              amount: "$$dayOffset",
                            },
                          },
                        },
                      },
                    },
                  },
                  else: [],
                },
              },
              dateRangeDebug: {
                $cond: {
                  if: { $in: ["$viewType", ["week", "day"]] },
                  then: {
                    $map: {
                      input: {
                        $range: [
                          0,
                          { $cond: { if: { $eq: ["$viewType", "day"] }, then: 1, else: 5 } },
                        ],
                      },
                      as: "dayOffset",
                      in: {
                        date: {
                          $dateToString: {
                            format: "%Y-%m-%d",
                            date: {
                              $dateAdd: {
                                startDate: { $dateFromString: { dateString: "$currentDateStr" } },
                                unit: "day",
                                amount: "$$dayOffset",
                              },
                            },
                          },
                        },
                        dayOfWeek: {
                          $dayOfWeek: {
                            $dateAdd: {
                              startDate: { $dateFromString: { dateString: "$currentDateStr" } },
                              unit: "day",
                              amount: "$$dayOffset",
                            },
                          },
                        },
                      },
                    },
                  },
                  else: [],
                },
              },
            },
          },
          {
            $addFields: {
              filteredEvents: {
                $cond: {
                  if: { $eq: ["$viewType", "day"] },
                  then: {
                    $filter: {
                      input: "$flattenedEvents",
                      as: "event",
                      cond: { $eq: ["$$event.date", "$currentDateStr"] },
                    },
                  },
                  else: {
                    $cond: {
                      if: { $eq: ["$viewType", "week"] },
                      then: {
                        $filter: {
                          input: "$flattenedEvents",
                          as: "event",
                          cond: { $in: ["$$event.date", "$dateRange"] },
                        },
                      },
                      else: {
                        $filter: {
                          input: "$flattenedEvents",
                          as: "event",
                          cond: { $gte: ["$$event.date", "$currentDateStr"] },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          {
            $project: {
              events: {
                $cond: {
                  if: { $eq: ["$viewType", "month"] },
                  then: {
                    $arrayToObject: {
                      $map: {
                        input: {
                          $setUnion: {
                            $map: {
                              input: "$filteredEvents",
                              as: "event",
                              in: "$$event.date",
                            },
                          },
                        },
                        as: "date",
                        in: {
                          k: "$$date",
                          v: [
                            {
                              count: {
                                $size: {
                                  $filter: {
                                    input: "$filteredEvents",
                                    as: "event",
                                    cond: { $eq: ["$$event.date", "$$date"] },
                                  },
                                },
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                  else: {
                    $cond: {
                      if: { $eq: ["$viewType", "week"] },
                      then: {
                        $arrayToObject: {
                          $map: {
                            input: "$dateRange",
                            as: "date",
                            in: {
                              k: "$$date",
                              v: {
                                $let: {
                                  vars: {
                                    dayOfWeek: {
                                      $dayOfWeek: {
                                        $dateFromString: { dateString: "$$date" },
                                      },
                                    },
                                    dateEvents: {
                                      $filter: {
                                        input: "$flattenedEvents",
                                        as: "event",
                                        cond: { $eq: ["$$event.date", "$$date"] },
                                      },
                                    },
                                  },
                                  in: {
                                    $cond: {
                                      if: { $gt: [{ $size: "$$dateEvents" }, 0] },
                                      then: "$$dateEvents",
                                      else: "no schedule",
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                      else: {
                        $arrayToObject: {
                          $map: {
                            input: {
                              $setUnion: {
                                $map: {
                                  input: "$filteredEvents",
                                  as: "event",
                                  in: "$$event.date",
                                },
                              },
                            },
                            as: "date",
                            in: {
                              k: "$$date",
                              v: {
                                $filter: {
                                  input: "$filteredEvents",
                                  as: "event",
                                  cond: { $eq: ["$$event.date", "$$date"] },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              dateRange: 1,
              viewType: 1,
              dateRangeDebug: 1,
              currentDateStr: 1,
            },
          },
        ],
        upcomingEventsData: [
          {
            $project: {
              flattenedWiderEvents: 1,
              currentDateStr: 1,
              tomorrowStr: 1,
              currentHour: 1,
              currentMinute: 1,
            },
          },
          {
            $addFields: {
              upcomingEvents: {
                $filter: {
                  input: "$flattenedWiderEvents",
                  as: "event",
                  cond: {
                    $or: [
                      {
                        $and: [
                          { $eq: ["$$event.date", "$currentDateStr"] },
                          {
                            $let: {
                              vars: {
                                eventHour: {
                                  $cond: {
                                    if: {
                                      $or: [
                                        {
                                          $regexMatch: { input: "$$event.startTime", regex: "AM" },
                                        },
                                        {
                                          $regexMatch: { input: "$$event.startTime", regex: "PM" },
                                        },
                                      ],
                                    },
                                    then: {
                                      $let: {
                                        vars: {
                                          hour: {
                                            $toInt: {
                                              $arrayElemAt: [
                                                {
                                                  $split: [
                                                    {
                                                      $arrayElemAt: [
                                                        { $split: ["$$event.startTime", " "] },
                                                        0,
                                                      ],
                                                    },
                                                    ":",
                                                  ],
                                                },
                                                0,
                                              ],
                                            },
                                          },
                                        },
                                        in: {
                                          $cond: {
                                            if: {
                                              $and: [
                                                {
                                                  $regexMatch: {
                                                    input: "$$event.startTime",
                                                    regex: "PM",
                                                  },
                                                },
                                                { $lt: ["$$hour", 12] },
                                              ],
                                            },
                                            then: { $add: ["$$hour", 12] },
                                            else: {
                                              $cond: {
                                                if: {
                                                  $and: [
                                                    {
                                                      $regexMatch: {
                                                        input: "$$event.startTime",
                                                        regex: "AM",
                                                      },
                                                    },
                                                    { $eq: ["$$hour", 12] },
                                                  ],
                                                },
                                                then: 0,
                                                else: "$$hour",
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                    else: {
                                      $toInt: {
                                        $arrayElemAt: [{ $split: ["$$event.startTime", ":"] }, 0],
                                      },
                                    },
                                  },
                                },
                                eventMinute: {
                                  $cond: {
                                    if: {
                                      $or: [
                                        {
                                          $regexMatch: { input: "$$event.startTime", regex: "AM" },
                                        },
                                        {
                                          $regexMatch: { input: "$$event.startTime", regex: "PM" },
                                        },
                                      ],
                                    },
                                    then: {
                                      $toInt: {
                                        $arrayElemAt: [
                                          {
                                            $split: [
                                              {
                                                $arrayElemAt: [
                                                  { $split: ["$$event.startTime", " "] },
                                                  0,
                                                ],
                                              },
                                              ":",
                                            ],
                                          },
                                          1,
                                        ],
                                      },
                                    },
                                    else: {
                                      $toInt: {
                                        $arrayElemAt: [{ $split: ["$$event.startTime", ":"] }, 1],
                                      },
                                    },
                                  },
                                },
                              },
                              in: {
                                $or: [
                                  { $gt: ["$$eventHour", "$currentHour"] },
                                  {
                                    $and: [
                                      { $eq: ["$$eventHour", "$currentHour"] },
                                      { $gt: ["$$eventMinute", "$currentMinute"] },
                                    ],
                                  },
                                ],
                              },
                            },
                          },
                        ],
                      },
                      { $eq: ["$$event.date", "$tomorrowStr"] },
                    ],
                  },
                },
              },
            },
          },
          {
            $addFields: {
              sortedUpcomingEvents: {
                $sortArray: {
                  input: "$upcomingEvents",
                  sortBy: {
                    date: 1,
                    startTime: 1,
                  },
                },
              },
            },
          },
          {
            $project: {
              upcomingEvents: { $slice: ["$sortedUpcomingEvents", 5] },
            },
          },
        ],
      },
    },
    {
      $project: {
        events: { $arrayElemAt: ["$eventsData.events", 0] },
        upcomingEvents: { $arrayElemAt: ["$upcomingEventsData.upcomingEvents", 0] },
      },
    },
  ]);
  return results[0] || { events: {}, upcomingEvents: [] };
}

async function bulkCreate(students: Partial<IStudent>[]): Promise<IStudent[]> {
  const response = await Student.insertMany(students, { ordered: false });
  return response;
}

async function getStudentGradeBySection(grade: any, dbParams: any): Promise<any> {
  const organizationId = new mongoose.Types.ObjectId(dbParams.query.organizationId);
  const sectionCode = grade[0]?.sectionId?.code;

  if (!sectionCode) {
    return { students: [], headers: [] };
  }

  const students = await Student.aggregate([
    {
      $match: {
        organizationId,
        role: "student",
        "archive.status": false,
        "studentAssessmentResults.sectionCode": sectionCode,
      },
    },
    {
      $unwind: {
        path: "$studentAssessmentResults",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $match: {
        $or: [
          { "studentAssessmentResults.sectionCode": sectionCode },
          { studentAssessmentResults: null },
        ],
      },
    },
    {
      $group: {
        _id: "$_id",
        firstName: { $first: "$firstName" },
        lastName: { $first: "$lastName" },
        studentId: { $first: "$studentId" },
        avatar: { $first: "$avatar" },
        studentAssessmentResults: {
          $push: {
            $cond: [
              { $eq: ["$studentAssessmentResults", null] },
              null,
              "$studentAssessmentResults",
            ],
          },
        },
      },
    },
    {
      $addFields: {
        studentAssessmentResults: {
          $filter: {
            input: "$studentAssessmentResults",
            as: "result",
            cond: { $ne: ["$$result", null] },
          },
        },
      },
    },
    { $sort: { firstName: 1, lastName: 1 } },
  ]);

  return students || [];
}

function archiveStudent(id: string): Promise<IStudent | null> {
  return Student.findByIdAndUpdate(
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
