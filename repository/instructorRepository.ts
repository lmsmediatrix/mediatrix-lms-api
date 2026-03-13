import mongoose, { FilterQuery, UpdateQuery } from "mongoose";
import Instructor, { IInstructor } from "../models/instructorModel";
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

const instructorRepository = {
  getInstructor,
  getInstructors,
  createInstructor,
  updateInstructor,
  deleteInstructor,
  searchInstructor,
  searchAndUpdate,
  findOrCreate,
  getInstructorsCount,
  instructorDashboard,
  bulkImport,
  archiveInstructor,
};

export default instructorRepository;

function getInstructor(id: string, dbParams: DbParams = {}): Promise<IInstructor | null> {
  let query = Instructor.findById(id);

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

function getInstructors(dbParams: DbParams): Promise<IInstructor[]> {
  let query = Instructor.find(dbParams.query || {});

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

function getInstructorsCount(query: any): Promise<number> {
  return Instructor.countDocuments(query).exec();
}

function createInstructor(data: Partial<IInstructor>): Promise<IInstructor> {
  return Instructor.create(data);
}

function updateInstructor(data: Partial<IInstructor>): Promise<IInstructor | null> {
  return Instructor.findByIdAndUpdate(data._id, data, { new: true });
}

function deleteInstructor(id: string): Promise<IInstructor | null> {
  return Instructor.findByIdAndDelete(id);
}

function searchInstructor(params: any = {}): Promise<IInstructor[]> {
  const query = Instructor.find(params.query || {});
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
  query: FilterQuery<IInstructor>,
  update?: UpdateQuery<IInstructor>,
  options?: { multi?: boolean }
): Promise<IInstructor | null | { modifiedCount: number }> {
  if (!update) {
    return Instructor.findOne(query);
  }

  if (options?.multi) {
    const result = await Instructor.updateMany(query, update);
    return { modifiedCount: result.modifiedCount };
  }

  return Instructor.findOneAndUpdate(query, update, { new: true });
}

async function findOrCreate(query: any): Promise<IInstructor | null> {
  return await Instructor.findOne(query).lean();
}

async function instructorDashboard(id: string, dbParams: DbParams = {}): Promise<any> {
  const Section = mongoose.model("Section");
  const instructorObjectId = new mongoose.Types.ObjectId(id);
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const results = await Section.aggregate([
    {
      $match: {
        organizationId,
        instructor: instructorObjectId,
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
      $unwind: {
        path: "$courseInfo",
        preserveNullAndEmptyArrays: true,
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
        from: "users",
        localField: "students",
        foreignField: "_id",
        as: "studentsInfo",
        pipeline: [
          {
            $project: {
              _id: 1,
              firstName: 1,
              lastName: 1,
              status: 1,
              createdAt: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "announcements",
        let: {
          sectionId: "$_id",
          orgId: "$organizationId",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $or: [
                      {
                        $and: [
                          { $eq: ["$scope", "section"] },
                          { $eq: ["$scopeId", "$$sectionId"] },
                        ],
                      },
                      {
                        $and: [
                          { $eq: ["$scope", "organization"] },
                          { $eq: ["$scopeId", "$$orgId"] },
                        ],
                      },
                    ],
                  },
                  { $eq: ["$archive.status", false] },
                  { $eq: ["$isPublished", true] },
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
          {
            $unwind: {
              path: "$authorInfo",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              _id: 1,
              title: 1,
              textBody: 1,
              publishDate: 1,
              authorName: {
                $concat: [
                  { $ifNull: ["$authorInfo.firstName", ""] },
                  " ",
                  { $ifNull: ["$authorInfo.lastName", ""] },
                ],
              },
              authorImage: {
                $concat: [
                  "https://ui-avatars.com/api/?name=",
                  { $ifNull: ["$authorInfo.firstName", "Unknown"] },
                  "+",
                  { $ifNull: ["$authorInfo.lastName", "Author"] },
                  "&background=random",
                ],
              },
              content: { $ifNull: ["$textBody", ""] },
              postedAt: { $ifNull: ["$publishDate", new Date()] },
            },
          },
        ],
        as: "announcements",
      },
    },
    {
      $facet: {
        instructorSummary: [
          {
            $group: {
              _id: null,
              totalStudents: { $sum: { $size: { $ifNull: ["$studentsInfo", []] } } },
              allStudents: { $push: { $ifNull: ["$studentsInfo", []] } },
            },
          },
          {
            $addFields: {
              flattenedStudents: {
                $reduce: {
                  input: "$allStudents",
                  initialValue: [],
                  in: { $concatArrays: ["$$value", "$$this"] },
                },
              },
            },
          },
          {
            $project: {
              _id: 0,
              items: [
                {
                  _id: { $toString: new mongoose.Types.ObjectId() },
                  value: { $toString: { $ifNull: ["$totalStudents", 0] } },
                  label: "Total Enrolled Students",
                },
                {
                  _id: { $toString: new mongoose.Types.ObjectId() },
                  value: {
                    $toString: {
                      $size: {
                        $filter: {
                          input: { $ifNull: ["$flattenedStudents", []] },
                          as: "student",
                          cond: {
                            $and: [
                              { $ne: ["$$student", null] },
                              {
                                $gte: [
                                  { $ifNull: ["$$student.createdAt", new Date(0)] },
                                  firstDayOfMonth,
                                ],
                              },
                            ],
                          },
                        },
                      },
                    },
                  },
                  label: "New Enrollment This Month",
                },
                {
                  _id: { $toString: new mongoose.Types.ObjectId() },
                  value: {
                    $concat: [
                      {
                        $toString: {
                          $multiply: [
                            {
                              $cond: {
                                if: {
                                  $eq: [{ $size: { $ifNull: ["$flattenedStudents", []] } }, 0],
                                },
                                then: 0,
                                else: {
                                  $divide: [
                                    {
                                      $size: {
                                        $filter: {
                                          input: { $ifNull: ["$flattenedStudents", []] },
                                          as: "student",
                                          cond: {
                                            $and: [
                                              { $ne: ["$$student", null] },
                                              {
                                                $eq: [
                                                  { $ifNull: ["$$student.status", ""] },
                                                  "active",
                                                ],
                                              },
                                            ],
                                          },
                                        },
                                      },
                                    },
                                    {
                                      $max: [{ $size: { $ifNull: ["$flattenedStudents", []] } }, 1],
                                    },
                                  ],
                                },
                              },
                            },
                            100,
                          ],
                        },
                      },
                      "%",
                    ],
                  },
                  label: "Retention Rate (Last 3 Months)",
                },
              ],
            },
          },
          { $unwind: { path: "$items", preserveNullAndEmptyArrays: false } },
          { $replaceRoot: { newRoot: "$items" } },
        ],

        comingUp: [
          {
            $addFields: {
              _todayBreakdown: {
                $first: {
                  $filter: {
                    input: { $ifNull: ["$schedule.breakdown", []] },
                    as: "item",
                    cond: {
                      $eq: [
                        {
                          $switch: {
                            branches: [
                              { case: { $eq: ["$$item.day", "mon"] }, then: 2 },
                              { case: { $eq: ["$$item.day", "tue"] }, then: 3 },
                              { case: { $eq: ["$$item.day", "wed"] }, then: 4 },
                              { case: { $eq: ["$$item.day", "thu"] }, then: 5 },
                              { case: { $eq: ["$$item.day", "fri"] }, then: 6 },
                              { case: { $eq: ["$$item.day", "sat"] }, then: 7 },
                              { case: { $eq: ["$$item.day", "sun"] }, then: 1 },
                            ],
                            default: 0,
                          },
                        },
                        { $dayOfWeek: { date: "$$NOW", timezone: "Asia/Manila" } },
                      ],
                    },
                  },
                },
              },
            },
          },
          {
            $addFields: {
              hasMeetings: { $gt: [{ $type: "$_todayBreakdown" }, "missing"] },
            },
          },
          {
            $project: {
              upcomingEvents: {
                $concatArrays: [
                  {
                    $cond: {
                      if: "$hasMeetings",
                      then: [
                        {
                          _id: { $toString: new mongoose.Types.ObjectId() },
                          type: "Live Q&A Session",
                          title: { $concat: ["Meeting for ", { $ifNull: ["$code", "Class"] }] },
                          points: 35,
                          dueDate: { $ifNull: ["$_todayBreakdown.time.start", "08:00 AM"] },
                          status: "Today",
                        },
                      ],
                      else: [],
                    },
                  },
                  {
                    $filter: {
                      input: {
                        $map: {
                          input: { $ifNull: ["$assessments", []] },
                          as: "assessment",
                          in: {
                            $cond: {
                              if: {
                                $and: [
                                  { $ne: ["$$assessment", null] },
                                  { $in: ["$$assessment.type", ["assignment", "quiz"]] },
                                  {
                                    $gt: [
                                      {
                                        $cond: {
                                          if: { $eq: [{ $type: "$$assessment.endDate" }, "date"] },
                                          then: "$$assessment.endDate",
                                          else: {
                                            $toDate: {
                                              $ifNull: ["$$assessment.endDate", new Date()],
                                            },
                                          },
                                        },
                                      },
                                      "$$NOW",
                                    ],
                                  },
                                ],
                              },
                              then: {
                                _id: {
                                  $toString: {
                                    $ifNull: ["$$assessment._id", new mongoose.Types.ObjectId()],
                                  },
                                },
                                type: {
                                  $cond: {
                                    if: { $eq: ["$$assessment.type", "assignment"] },
                                    then: "Assignment Grading",
                                    else: "Final Quiz",
                                  },
                                },
                                title: { $ifNull: ["$$assessment.title", "Untitled Assessment"] },
                                points: {
                                  $cond: {
                                    if: { $eq: ["$$assessment.type", "assignment"] },
                                    then: { $ifNull: ["$$assessment.totalPoints", 35] },
                                    else: { $ifNull: ["$$assessment.totalPoints", 30] },
                                  },
                                },
                                dueDate: {
                                  $cond: {
                                    if: { $eq: [{ $type: "$$assessment.endDate" }, "date"] },
                                    then: "$$assessment.endDate",
                                    else: {
                                      $toDate: { $ifNull: ["$$assessment.endDate", new Date()] },
                                    },
                                  },
                                },
                                status: {
                                  $let: {
                                    vars: {
                                      endDate: {
                                        $cond: {
                                          if: { $eq: [{ $type: "$$assessment.endDate" }, "date"] },
                                          then: "$$assessment.endDate",
                                          else: {
                                            $toDate: {
                                              $ifNull: ["$$assessment.endDate", new Date()],
                                            },
                                          },
                                        },
                                      },
                                    },
                                    in: assessmentStatus,
                                  },
                                },
                              },
                              else: null,
                            },
                          },
                        },
                      },
                      as: "event",
                      cond: { $ne: ["$$event", null] },
                    },
                  },
                ],
              },
            },
          },
          { $unwind: { path: "$upcomingEvents", preserveNullAndEmptyArrays: false } },
          { $replaceRoot: { newRoot: "$upcomingEvents" } },
          { $sort: { dueDate: 1 } },
          { $limit: 5 },
        ],

        announcements: [
          {
            $project: {
              _id: 0,
              validAnnouncements: {
                $filter: {
                  input: {
                    $map: {
                      input: { $ifNull: ["$announcements", []] },
                      as: "announce",
                      in: {
                        $cond: {
                          if: { $ne: ["$$announce", null] },
                          then: {
                            _id: {
                              $toString: {
                                $ifNull: ["$$announce._id", new mongoose.Types.ObjectId()],
                              },
                            },
                            authorName: { $ifNull: ["$$announce.authorName", "Unknown Author"] },
                            authorImage: {
                              $ifNull: [
                                "$$announce.authorImage",
                                "https://ui-avatars.com/api/?name=Unknown+Author&background=random",
                              ],
                            },
                            content: { $ifNull: ["$$announce.content", ""] },
                            postedAt: { $ifNull: ["$$announce.postedAt", new Date()] },
                          },
                          else: null,
                        },
                      },
                    },
                  },
                  as: "ann",
                  cond: { $ne: ["$$ann", null] },
                },
              },
            },
          },
          { $unwind: { path: "$validAnnouncements", preserveNullAndEmptyArrays: false } },
          { $replaceRoot: { newRoot: "$validAnnouncements" } },
          { $sort: { postedAt: -1 } },
          { $limit: 5 },
        ],

        courses: [
          {
            $match: {
              "courseInfo._id": { $exists: true, $ne: null },
            },
          },
          {
            $project: {
              _id: { $toString: { $ifNull: ["$courseInfo._id", ""] } },
              title: { $ifNull: ["$courseInfo.title", "Untitled Course"] },
              code: { $ifNull: ["$courseInfo.code", ""] },
              thumbnail: { $ifNull: ["$courseInfo.thumbnail", ""] },
              status: { $ifNull: ["$courseInfo.status", "unknown"] },
              updatedAt: { $ifNull: ["$courseInfo.updatedAt", new Date()] },
            },
          },
        ],

        gradeData: [
          {
            $limit: 1,
          },
          {
            $project: {
              _id: { $toString: new mongoose.Types.ObjectId() },
              labels: ["10", "20", "30", "40", "50", "60", "70", "80", "90", "100"],
              values: [320, 310, 290, 420, 230, 330, 340, 180, 420, 170],
            },
          },
        ],
      },
    },
    {
      $project: {
        instructorSummary: { $ifNull: ["$instructorSummary", []] },
        comingUp: { $ifNull: ["$comingUp", []] },
        announcements: { $ifNull: ["$announcements", []] },
        courses: { $ifNull: ["$courses", []] },
        gradeData: {
          $ifNull: [
            { $arrayElemAt: ["$gradeData", 0] },
            {
              labels: ["10", "20", "30", "40", "50", "60", "70", "80", "90", "100"],
              values: [320, 310, 290, 420, 230, 330, 340, 180, 420, 170],
            },
          ],
        },
      },
    },
  ]);

  return (
    results[0] || {
      instructorSummary: [
        {
          _id: new mongoose.Types.ObjectId().toString(),
          value: "0",
          label: "Total Enrolled Students",
        },
        {
          _id: new mongoose.Types.ObjectId().toString(),
          value: "0",
          label: "New Enrollment This Month",
        },
        {
          _id: new mongoose.Types.ObjectId().toString(),
          value: "0%",
          label: "Retention Rate (Last 3 Months)",
        },
      ],
      comingUp: [],
      announcements: [],
      courses: [],
      gradeData: {
        _id: new mongoose.Types.ObjectId().toString(),
        labels: ["10", "20", "30", "40", "50", "60", "70", "80", "90", "100"],
        values: [320, 310, 290, 420, 230, 330, 340, 180, 420, 170],
      },
    }
  );
}

function bulkImport(data: Partial<IInstructor>[]): Promise<IInstructor[]> {
  return Instructor.insertMany(data, { ordered: false });
}

function archiveInstructor(id: string): Promise<IInstructor | null> {
  return Instructor.findByIdAndUpdate(
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
