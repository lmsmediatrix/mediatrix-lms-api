import mongoose, { PipelineStage } from "mongoose";

export const FACET = (filter: any) => {
  return {
    Student: {
      assignmentData: [
        {
          $match: {
            students: new mongoose.Types.ObjectId(filter.studentId),
            "archive.status": { $ne: true },
            ...(filter.organizationId
              ? { organizationId: new mongoose.Types.ObjectId(filter.organizationId) }
              : {}),
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
                $match: {
                  "archive.status": { $ne: true },
                },
              },
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
          $project: {
            assignments: {
              $filter: {
                input: "$assessments",
                as: "assessment",
                cond: { $eq: ["$$assessment.type", "assignment"] },
              },
            },
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: { $size: "$assignments" },
            },
            critical: {
              $sum: {
                $size: {
                  $filter: {
                    input: "$assignments",
                    as: "assignment",
                    cond: {
                      $lte: [
                        {
                          $dateDiff: {
                            startDate: "$$NOW",
                            endDate: {
                              $cond: {
                                if: { $eq: [{ $type: "$$assignment.endDate" }, "date"] },
                                then: "$$assignment.endDate",
                                else: {
                                  $toDate: { $ifNull: ["$$assignment.endDate", new Date()] },
                                },
                              },
                            },
                            unit: "day",
                          },
                        },
                        1,
                      ],
                    },
                  },
                },
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            total: 1,
            critical: 1,
          },
        },
        {
          $group: {
            _id: null,
            docs: { $push: "$$ROOT" },
          },
        },
        {
          $project: {
            _id: 0,
            stats: {
              $cond: {
                if: { $eq: [{ $size: "$docs" }, 0] },
                then: { total: 0, critical: 0 },
                else: { $arrayElemAt: ["$docs", 0] },
              },
            },
          },
        },
        {
          $replaceRoot: { newRoot: "$stats" },
        },
      ] as PipelineStage.FacetPipelineStage[],

      continueWorking: [
        {
          $match: {
            students: new mongoose.Types.ObjectId(filter.studentId),
            "archive.status": { $ne: true },
            ...(filter.organizationId
              ? { organizationId: new mongoose.Types.ObjectId(filter.organizationId) }
              : {}),
          },
        },
        {
          $match: {
            modules: { $exists: true, $ne: [] },
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
                $match: {
                  "archive.status": { $ne: true },
                },
              },
            ],
          },
        },
        {
          $lookup: {
            from: "modules",
            localField: "modules",
            foreignField: "_id",
            as: "moduleDetails",
            pipeline: [
              {
                $match: {
                  "archive.status": { $ne: true },
                },
              },
            ],
          },
        },
        {
          $match: {
            moduleDetails: { $exists: true, $ne: [] },
          },
        },
        {
          $unwind: {
            path: "$moduleDetails",
            preserveNullAndEmptyArrays: false,
          },
        },
        {
          $match: {
            "moduleDetails.lessons": { $exists: true, $ne: [] },
          },
        },
        {
          $lookup: {
            from: "lessons",
            localField: "moduleDetails.lessons",
            foreignField: "_id",
            as: "lessonDetails",
            pipeline: [
              {
                $match: {
                  "archive.status": { $ne: true },
                },
              },
            ],
          },
        },
        {
          $match: {
            lessonDetails: { $exists: true, $ne: [] },
          },
        },
        {
          $unwind: {
            path: "$lessonDetails",
            preserveNullAndEmptyArrays: false,
          },
        },
        {
          $match: {
            $expr: { $ne: ["$lessonDetails", null] },
          },
        },
        {
          $match: {
            "lessonDetails.status": "published",
          },
        },
        {
          $addFields: {
            userProgress: {
              $first: {
                $filter: {
                  input: { $ifNull: ["$lessonDetails.progress", []] },
                  as: "p",
                  cond: {
                    $eq: ["$$p.userId", new mongoose.Types.ObjectId(filter.studentId)],
                  },
                },
              },
            },
          },
        },
        {
          $match: {
            $or: [
              { userProgress: { $eq: null } },
              { "userProgress.status": { $ne: "completed" } },
            ],
          },
        },
        {
          $project: {
            lessonId: "$lessonDetails._id",
            title: "$lessonDetails.title",
            date: {
              $concat: [
                {
                  $dateToString: {
                    format: "%b %d",
                    date: "$lessonDetails.startDate",
                    timezone: "Asia/Manila",
                  },
                },
                " to ",
                {
                  $dateToString: {
                    format: "%b %d, %Y",
                    date: "$lessonDetails.endDate",
                    timezone: "Asia/Manila",
                  },
                },
              ],
            },
            section: "$code",
            sectionCode: "$code",
            module: "$moduleDetails.title",
            moduleId: "$moduleDetails._id",
          },
        },
        { $sort: { "lessonDetails.startDate": 1 } },
        { $limit: 3 },
      ] as PipelineStage.FacetPipelineStage[],

      upComingClassSchedule: [
        // Active lessons (today falls within start–end range)
        {
          $match: {
            students: new mongoose.Types.ObjectId(filter.studentId),
            "archive.status": { $ne: true },
            ...(filter.organizationId
              ? { organizationId: new mongoose.Types.ObjectId(filter.organizationId) }
              : {}),
          },
        },
        {
          $lookup: {
            from: "modules",
            localField: "modules",
            foreignField: "_id",
            as: "moduleDetails",
            pipeline: [{ $match: { "archive.status": { $ne: true } } }],
          },
        },
        { $unwind: { path: "$moduleDetails", preserveNullAndEmptyArrays: false } },
        {
          $lookup: {
            from: "lessons",
            localField: "moduleDetails.lessons",
            foreignField: "_id",
            as: "lessonDetails",
            pipeline: [{ $match: { "archive.status": { $ne: true } } }],
          },
        },
        { $unwind: { path: "$lessonDetails", preserveNullAndEmptyArrays: false } },
        {
          $match: {
            $expr: {
              $and: [
                { $ifNull: ["$lessonDetails.startDate", false] },
                { $ifNull: ["$lessonDetails.endDate", false] },
                {
                  $lte: [
                    {
                      $cond: {
                        if: { $eq: [{ $type: "$lessonDetails.startDate" }, "date"] },
                        then: "$lessonDetails.startDate",
                        else: {
                          $toDate: { $ifNull: ["$lessonDetails.startDate", new Date(0)] },
                        },
                      },
                    },
                    "$$NOW",
                  ],
                },
                {
                  $gte: [
                    {
                      $cond: {
                        if: { $eq: [{ $type: "$lessonDetails.endDate" }, "date"] },
                        then: "$lessonDetails.endDate",
                        else: {
                          $toDate: { $ifNull: ["$lessonDetails.endDate", new Date(0)] },
                        },
                      },
                    },
                    "$$NOW",
                  ],
                },
              ],
            },
          },
        },
        {
          $project: {
            _id: 0,
            type: { $literal: "Lesson" },
            title: "$lessonDetails.title",
            points: { $literal: 0 },
            dueDate: {
              $dateToString: { format: "%Y-%m-%d", date: "$lessonDetails.endDate" },
            },
            status: {
              $cond: {
                if: {
                  $eq: [
                    {
                      $dateToString: {
                        format: "%Y-%m-%d",
                        date: "$lessonDetails.endDate",
                        timezone: "Asia/Manila",
                      },
                    },
                    {
                      $dateToString: {
                        format: "%Y-%m-%d",
                        date: "$$NOW",
                        timezone: "Asia/Manila",
                      },
                    },
                  ],
                },
                then: "Today",
                else: {
                  $cond: {
                    if: {
                      $eq: [
                        {
                          $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$lessonDetails.endDate",
                            timezone: "Asia/Manila",
                          },
                        },
                        {
                          $dateToString: {
                            format: "%Y-%m-%d",
                            date: {
                              $dateAdd: { startDate: "$$NOW", unit: "day", amount: 1 },
                            },
                            timezone: "Asia/Manila",
                          },
                        },
                      ],
                    },
                    then: "Tomorrow",
                    else: "Upcoming",
                  },
                },
              },
            },
            sortDate: "$lessonDetails.endDate",
            sectionCode: "$code",
          },
        },
        { $sort: { sortDate: 1 } },
        { $project: { sortDate: 0 } },
        { $limit: 10 },
      ] as PipelineStage.FacetPipelineStage[],

      announcements: [
        {
          $match: {
            students: new mongoose.Types.ObjectId(filter.studentId),
            "archive.status": { $ne: true },
            ...(filter.organizationId
              ? { organizationId: new mongoose.Types.ObjectId(filter.organizationId) }
              : {}),
          },
        },
        { $unwind: "$announcements" },
        {
          $lookup: {
            from: "announcements",
            localField: "announcements",
            foreignField: "_id",
            as: "announcementDetails",
            pipeline: [
              {
                $match: {
                  "archive.status": { $ne: true },
                },
              },
            ],
          },
        },
        { $unwind: "$announcementDetails" },
        {
          $addFields: {
            normalizedPublishDate: {
              $cond: {
                if: { $eq: [{ $type: "$announcementDetails.publishDate" }, "date"] },
                then: "$announcementDetails.publishDate",
                else: { $toDate: { $ifNull: ["$announcementDetails.publishDate", new Date()] } },
              },
            },
            dateFormatted: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: {
                  $cond: {
                    if: { $eq: [{ $type: "$announcementDetails.publishDate" }, "date"] },
                    then: "$announcementDetails.publishDate",
                    else: {
                      $toDate: { $ifNull: ["$announcementDetails.publishDate", new Date()] },
                    },
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
            daysAgo: {
              $cond: [
                { $eq: ["$dateFormatted", "$todayFormatted"] },
                "Today",
                {
                  $cond: [
                    { $eq: ["$dateFormatted", "$tomorrowFormatted"] },
                    "Tomorrow",
                    {
                      $cond: [
                        { $lt: ["$normalizedPublishDate", "$$NOW"] },
                        {
                          $concat: [
                            {
                              $toString: {
                                $ceil: {
                                  $abs: {
                                    $divide: [
                                      {
                                        $dateDiff: {
                                          startDate: "$normalizedPublishDate",
                                          endDate: "$$NOW",
                                          unit: "day",
                                        },
                                      },
                                      1,
                                    ],
                                  },
                                },
                              },
                            },
                            " day(s) ago",
                          ],
                        },
                        "Upcoming",
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "announcementDetails.author",
            foreignField: "_id",
            as: "authorDetails",
            pipeline: [
              {
                $match: {
                  "archive.status": { $ne: true },
                },
              },
            ],
          },
        },
        { $unwind: { path: "$authorDetails", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$announcementDetails._id",
            authorName: {
              $first: { $concat: ["$authorDetails.firstName", " ", "$authorDetails.lastName"] },
            },
            authorImage: { $first: "$authorDetails.avatar" },
            content: { $first: "$announcementDetails.textBody" },
            title: { $first: "$announcementDetails.title" },
            postedAt: { $first: "$normalizedPublishDate" },
            publishDate: { $first: "$normalizedPublishDate" },
            priorityScore: { $first: "$priorityScore" },
            daysAgo: { $first: "$daysAgo" },
            sectionCode: { $first: "$code" },
          },
        },
        {
          $sort: {
            priorityScore: -1,
            publishDate: -1,
            _id: 1,
          },
        },
        {
          $project: {
            _id: 1,
            authorName: 1,
            authorImage: 1,
            content: 1,
            title: 1,
            postedAt: 1,
            publishDate: 1,
            daysAgo: 1,
            sectionCode: 1,
          },
        },
        { $limit: 5 },
      ] as PipelineStage.FacetPipelineStage[],

      courses: [
        {
          $match: {
            students: new mongoose.Types.ObjectId(filter.studentId),
            "archive.status": { $ne: true },
            ...(filter.organizationId
              ? { organizationId: new mongoose.Types.ObjectId(filter.organizationId) }
              : {}),
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
                $match: {
                  "archive.status": { $ne: true },
                },
              },
            ],
          },
        },
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
      ] as PipelineStage.FacetPipelineStage[],

      // ── Overall Progress (lessons + assessments across all sections) ──
      overallProgress: [
        {
          $match: {
            students: new mongoose.Types.ObjectId(filter.studentId),
            "archive.status": { $ne: true },
            ...(filter.organizationId
              ? { organizationId: new mongoose.Types.ObjectId(filter.organizationId) }
              : {}),
          },
        },
        {
          $lookup: {
            from: "modules",
            localField: "modules",
            foreignField: "_id",
            as: "moduleDetails",
            pipeline: [{ $match: { "archive.status": { $ne: true } } }],
          },
        },
        { $unwind: { path: "$moduleDetails", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "lessons",
            localField: "moduleDetails.lessons",
            foreignField: "_id",
            as: "lessonDetails",
            pipeline: [{ $match: { "archive.status": { $ne: true } } }],
          },
        },
        {
          $unwind: { path: "$lessonDetails", preserveNullAndEmptyArrays: true },
        },
        {
          $group: {
            _id: null,
            totalLessons: {
              $sum: { $cond: [{ $ifNull: ["$lessonDetails._id", false] }, 1, 0] },
            },
            completedLessons: {
              $sum: {
                $cond: [
                  {
                    $gt: [
                      {
                        $size: {
                          $ifNull: [
                            {
                              $filter: {
                                input: { $ifNull: ["$lessonDetails.progress", []] },
                                as: "p",
                                cond: {
                                  $and: [
                                    {
                                      $eq: [
                                        "$$p.userId",
                                        new mongoose.Types.ObjectId(filter.studentId),
                                      ],
                                    },
                                    { $eq: ["$$p.status", "completed"] },
                                  ],
                                },
                              },
                            },
                            [],
                          ],
                        },
                      },
                      0,
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            sectionIds: { $addToSet: "$_id" },
          },
        },
        {
          $lookup: {
            from: "assessments",
            let: { sIds: "$sectionIds" },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ["$section", "$$sIds"] },
                  "archive.status": { $ne: true },
                },
              },
              { $project: { _id: 1 } },
            ],
            as: "allAssessments",
          },
        },
        {
          $lookup: {
            from: "users",
            pipeline: [
              {
                $match: {
                  _id: new mongoose.Types.ObjectId(filter.studentId),
                },
              },
              { $project: { studentAssessmentResults: 1 } },
            ],
            as: "studentInfo",
          },
        },
        {
          $addFields: {
            totalAssessments: { $size: { $ifNull: ["$allAssessments", []] } },
            completedAssessments: {
              $size: {
                $ifNull: [
                  {
                    $filter: {
                      input: {
                        $ifNull: [
                          { $arrayElemAt: ["$studentInfo.studentAssessmentResults", 0] },
                          [],
                        ],
                      },
                      as: "r",
                      cond: { $eq: ["$$r.isFinished", true] },
                    },
                  },
                  [],
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            totalLessons: 1,
            completedLessons: 1,
            totalAssessments: 1,
            completedAssessments: 1,
            totalItems: { $add: ["$totalLessons", "$totalAssessments"] },
            completedItems: { $add: ["$completedLessons", "$completedAssessments"] },
            percent: {
              $cond: [
                { $gt: [{ $add: ["$totalLessons", "$totalAssessments"] }, 0] },
                {
                  $round: [
                    {
                      $multiply: [
                        {
                          $divide: [
                            { $add: ["$completedLessons", "$completedAssessments"] },
                            { $add: ["$totalLessons", "$totalAssessments"] },
                          ],
                        },
                        100,
                      ],
                    },
                    0,
                  ],
                },
                0,
              ],
            },
          },
        },
      ] as PipelineStage.FacetPipelineStage[],

      // ── Recent Grades (latest graded assessments) ──
      recentGrades: [
        {
          $match: {
            students: new mongoose.Types.ObjectId(filter.studentId),
            "archive.status": { $ne: true },
          },
        },
        { $limit: 1 },
        {
          $lookup: {
            from: "users",
            let: { sid: new mongoose.Types.ObjectId(filter.studentId) },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$sid"] } } },
              { $unwind: { path: "$studentAssessmentResults", preserveNullAndEmptyArrays: false } },
              { $match: { "studentAssessmentResults.isFinished": true } },
              { $sort: { "studentAssessmentResults.endTime": -1 } },
              { $limit: 5 },
              {
                $lookup: {
                  from: "assessments",
                  localField: "studentAssessmentResults.assessmentId",
                  foreignField: "_id",
                  as: "assessmentInfo",
                  pipeline: [{ $project: { title: 1, type: 1, totalPoints: 1, section: 1 } }],
                },
              },
              { $unwind: { path: "$assessmentInfo", preserveNullAndEmptyArrays: true } },
              {
                $lookup: {
                  from: "sections",
                  localField: "assessmentInfo.section",
                  foreignField: "_id",
                  as: "sectionInfo",
                  pipeline: [{ $project: { code: 1 } }],
                },
              },
              {
                $project: {
                  _id: "$studentAssessmentResults._id",
                  title: { $ifNull: ["$assessmentInfo.title", "Assessment"] },
                  type: { $ifNull: ["$assessmentInfo.type", "quiz"] },
                  score: "$studentAssessmentResults.totalScore",
                  totalPoints: "$studentAssessmentResults.totalPoints",
                  percentage: {
                    $cond: [
                      { $gt: ["$studentAssessmentResults.totalPoints", 0] },
                      {
                        $round: [
                          {
                            $multiply: [
                              {
                                $divide: [
                                  "$studentAssessmentResults.totalScore",
                                  "$studentAssessmentResults.totalPoints",
                                ],
                              },
                              100,
                            ],
                          },
                          1,
                        ],
                      },
                      0,
                    ],
                  },
                  isPassed: "$studentAssessmentResults.isPassed",
                  sectionCode: { $arrayElemAt: ["$sectionInfo.code", 0] },
                  completedAt: "$studentAssessmentResults.endTime",
                },
              },
            ],
            as: "grades",
          },
        },
        { $unwind: { path: "$grades", preserveNullAndEmptyArrays: false } },
        { $replaceRoot: { newRoot: "$grades" } },
      ] as PipelineStage.FacetPipelineStage[],

      // ── Expanded Stat Cards ──
      expandedStats: [
        {
          $match: {
            students: new mongoose.Types.ObjectId(filter.studentId),
            "archive.status": { $ne: true },
            ...(filter.organizationId
              ? { organizationId: new mongoose.Types.ObjectId(filter.organizationId) }
              : {}),
          },
        },
        {
          $lookup: {
            from: "modules",
            localField: "modules",
            foreignField: "_id",
            as: "moduleDetails",
            pipeline: [{ $match: { "archive.status": { $ne: true } } }],
          },
        },
        {
          $lookup: {
            from: "assessments",
            localField: "assessments",
            foreignField: "_id",
            as: "assessmentDetails",
            pipeline: [{ $match: { "archive.status": { $ne: true } } }],
          },
        },
        {
          $project: {
            _id: 1,
            lessonIds: {
              $reduce: {
                input: "$moduleDetails",
                initialValue: [],
                in: { $concatArrays: ["$$value", { $ifNull: ["$$this.lessons", []] }] },
              },
            },
            assessmentCount: { $size: { $ifNull: ["$assessmentDetails", []] } },
          },
        },
        {
          $lookup: {
            from: "lessons",
            localField: "lessonIds",
            foreignField: "_id",
            as: "lessons",
            pipeline: [{ $match: { "archive.status": { $ne: true } } }],
          },
        },
        {
          $project: {
            _id: 1,
            totalLessons: { $size: "$lessons" },
            completedLessons: {
              $size: {
                $filter: {
                  input: "$lessons",
                  as: "l",
                  cond: {
                    $gt: [
                      {
                        $size: {
                          $filter: {
                            input: { $ifNull: ["$$l.progress", []] },
                            as: "p",
                            cond: {
                              $and: [
                                {
                                  $eq: [
                                    "$$p.userId",
                                    new mongoose.Types.ObjectId(filter.studentId),
                                  ],
                                },
                                { $eq: ["$$p.status", "completed"] },
                              ],
                            },
                          },
                        },
                      },
                      0,
                    ],
                  },
                },
              },
            },
            assessmentCount: 1,
          },
        },
        {
          $group: {
            _id: null,
            sectionsEnrolled: { $sum: 1 },
            totalLessons: { $sum: "$totalLessons" },
            lessonsCompleted: { $sum: "$completedLessons" },
            totalAssessments: { $sum: "$assessmentCount" },
          },
        },
        {
          $lookup: {
            from: "users",
            pipeline: [
              {
                $match: {
                  _id: new mongoose.Types.ObjectId(filter.studentId),
                },
              },
              { $project: { studentAssessmentResults: 1 } },
            ],
            as: "studentInfo",
          },
        },
        {
          $addFields: {
            completedAssessmentResults: {
              $filter: {
                input: {
                  $ifNull: [{ $arrayElemAt: ["$studentInfo.studentAssessmentResults", 0] }, []],
                },
                as: "r",
                cond: { $eq: ["$$r.isFinished", true] },
              },
            },
          },
        },
        {
          $addFields: {
            avgGrade: {
              $cond: [
                { $gt: [{ $size: "$completedAssessmentResults" }, 0] },
                {
                  $round: [
                    {
                      $avg: {
                        $map: {
                          input: "$completedAssessmentResults",
                          as: "r",
                          in: {
                            $cond: [
                              { $gt: ["$$r.totalPoints", 0] },
                              {
                                $multiply: [
                                  { $divide: ["$$r.totalScore", "$$r.totalPoints"] },
                                  100,
                                ],
                              },
                              0,
                            ],
                          },
                        },
                      },
                    },
                    1,
                  ],
                },
                0,
              ],
            },
          },
        },
        {
          $project: {
            _id: 0,
            sectionsEnrolled: 1,
            lessonsCompleted: 1,
            totalLessons: 1,
            totalAssessments: 1,
            avgGrade: 1,
          },
        },
      ] as PipelineStage.FacetPipelineStage[],

      // ── Upcoming Deadlines (assessments due within 7 days) ──
      upcomingDeadlines: [
        {
          $match: {
            students: new mongoose.Types.ObjectId(filter.studentId),
            "archive.status": { $ne: true },
            ...(filter.organizationId
              ? { organizationId: new mongoose.Types.ObjectId(filter.organizationId) }
              : {}),
          },
        },
        {
          $lookup: {
            from: "assessments",
            localField: "assessments",
            foreignField: "_id",
            as: "assessmentDetails",
            pipeline: [
              {
                $match: {
                  "archive.status": { $ne: true },
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
                              year: { $year: { date: "$$NOW", timezone: "Asia/Manila" } },
                              month: { $month: { date: "$$NOW", timezone: "Asia/Manila" } },
                              day: { $dayOfMonth: { date: "$$NOW", timezone: "Asia/Manila" } },
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
                          7,
                        ],
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
        { $unwind: { path: "$assessmentDetails", preserveNullAndEmptyArrays: false } },
        {
          $project: {
            _id: "$assessmentDetails._id",
            title: "$assessmentDetails.title",
            type: "$assessmentDetails.type",
            totalPoints: "$assessmentDetails.totalPoints",
            endDate: {
              $dateToString: {
                format: "%b %d, %Y",
                date: {
                  $cond: {
                    if: { $eq: [{ $type: "$assessmentDetails.endDate" }, "date"] },
                    then: "$assessmentDetails.endDate",
                    else: { $toDate: { $ifNull: ["$assessmentDetails.endDate", new Date()] } },
                  },
                },
                timezone: "Asia/Manila",
              },
            },
            daysLeft: {
              $dateDiff: {
                startDate: "$$NOW",
                endDate: {
                  $cond: {
                    if: { $eq: [{ $type: "$assessmentDetails.endDate" }, "date"] },
                    then: "$assessmentDetails.endDate",
                    else: { $toDate: { $ifNull: ["$assessmentDetails.endDate", new Date()] } },
                  },
                },
                unit: "day",
              },
            },
            sectionCode: "$code",
            sectionName: "$name",
            sortDate: {
              $cond: {
                if: { $eq: [{ $type: "$assessmentDetails.endDate" }, "date"] },
                then: "$assessmentDetails.endDate",
                else: { $toDate: { $ifNull: ["$assessmentDetails.endDate", new Date()] } },
              },
            },
          },
        },
        { $sort: { sortDate: 1 } },
        { $project: { sortDate: 0 } },
        { $limit: 10 },
      ] as PipelineStage.FacetPipelineStage[],

      // ── Attendance Summary ──
      attendanceSummary: [
        {
          $match: {
            students: new mongoose.Types.ObjectId(filter.studentId),
            "archive.status": { $ne: true },
            ...(filter.organizationId
              ? { organizationId: new mongoose.Types.ObjectId(filter.organizationId) }
              : {}),
          },
        },
        { $unwind: { path: "$attendance", preserveNullAndEmptyArrays: false } },
        {
          $match: {
            "attendance.userId": new mongoose.Types.ObjectId(filter.studentId),
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            present: {
              $sum: { $cond: [{ $eq: ["$attendance.status", "present"] }, 1, 0] },
            },
            late: {
              $sum: { $cond: [{ $eq: ["$attendance.status", "late"] }, 1, 0] },
            },
            absent: {
              $sum: { $cond: [{ $eq: ["$attendance.status", "absent"] }, 1, 0] },
            },
            excused: {
              $sum: { $cond: [{ $eq: ["$attendance.status", "excused"] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            _id: 0,
            total: 1,
            present: 1,
            late: 1,
            absent: 1,
            excused: 1,
            attendanceRate: {
              $cond: [
                { $gt: ["$total", 0] },
                {
                  $round: [
                    { $multiply: [{ $divide: [{ $add: ["$present", "$late"] }, "$total"] }, 100] },
                    1,
                  ],
                },
                100,
              ],
            },
          },
        },
      ] as PipelineStage.FacetPipelineStage[],

      // ── Study Streak (consecutive days with lesson progress or assessment completion) ──
      studyStreak: [
        {
          $match: {
            _id: new mongoose.Types.ObjectId(filter.studentId),
          },
        },
        {
          $project: {
            assessmentDates: {
              $map: {
                input: {
                  $filter: {
                    input: { $ifNull: ["$studentAssessmentResults", []] },
                    as: "r",
                    cond: { $eq: ["$$r.isFinished", true] },
                  },
                },
                as: "r",
                in: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: { $toDate: { $ifNull: ["$$r.endTime", new Date(0)] } },
                    timezone: "Asia/Manila",
                  },
                },
              },
            },
          },
        },
        {
          $lookup: {
            from: "lessons",
            let: { sid: new mongoose.Types.ObjectId(filter.studentId) },
            pipeline: [
              {
                $match: {
                  "archive.status": { $ne: true },
                  "progress.status": "completed",
                },
              },
              { $unwind: "$progress" },
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$progress.userId", "$$sid"] },
                      { $eq: ["$progress.status", "completed"] },
                    ],
                  },
                },
              },
              {
                $project: {
                  day: {
                    $dateToString: {
                      format: "%Y-%m-%d",
                      date: "$updatedAt",
                      timezone: "Asia/Manila",
                    },
                  },
                },
              },
            ],
            as: "lessonDates",
          },
        },
        {
          $project: {
            allDates: {
              $setUnion: [
                "$assessmentDates",
                { $map: { input: "$lessonDates", as: "d", in: "$$d.day" } },
              ],
            },
          },
        },
        {
          $project: {
            totalActiveDays: { $size: { $ifNull: ["$allDates", []] } },
            today: {
              $dateToString: { format: "%Y-%m-%d", date: "$$NOW", timezone: "Asia/Manila" },
            },
            allDates: { $sortArray: { input: { $ifNull: ["$allDates", []] }, sortBy: -1 } },
          },
        },
        {
          $project: {
            totalActiveDays: 1,
            allDates: 1,
            today: 1,
            isActiveToday: {
              $in: ["$today", "$allDates"],
            },
          },
        },
      ] as PipelineStage.FacetPipelineStage[],

      // ── Performance Data (scores per assessment for chart) ──
      performanceData: [
        {
          $match: {
            students: new mongoose.Types.ObjectId(filter.studentId),
            "archive.status": { $ne: true },
          },
        },
        { $limit: 1 },
        {
          $lookup: {
            from: "users",
            let: { sid: new mongoose.Types.ObjectId(filter.studentId) },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$sid"] } } },
              { $unwind: { path: "$studentAssessmentResults", preserveNullAndEmptyArrays: false } },
              { $match: { "studentAssessmentResults.isFinished": true } },
              { $sort: { "studentAssessmentResults.endTime": 1 } },
              {
                $lookup: {
                  from: "assessments",
                  localField: "studentAssessmentResults.assessmentId",
                  foreignField: "_id",
                  as: "assessmentInfo",
                  pipeline: [{ $project: { title: 1, type: 1 } }],
                },
              },
              { $unwind: { path: "$assessmentInfo", preserveNullAndEmptyArrays: true } },
              {
                $project: {
                  _id: "$studentAssessmentResults._id",
                  title: { $ifNull: ["$assessmentInfo.title", "Assessment"] },
                  type: { $ifNull: ["$assessmentInfo.type", "quiz"] },
                  score: "$studentAssessmentResults.totalScore",
                  totalPoints: "$studentAssessmentResults.totalPoints",
                  percentage: {
                    $cond: [
                      { $gt: ["$studentAssessmentResults.totalPoints", 0] },
                      {
                        $round: [
                          {
                            $multiply: [
                              {
                                $divide: [
                                  "$studentAssessmentResults.totalScore",
                                  "$studentAssessmentResults.totalPoints",
                                ],
                              },
                              100,
                            ],
                          },
                          1,
                        ],
                      },
                      0,
                    ],
                  },
                  completedAt: "$studentAssessmentResults.endTime",
                },
              },
              { $limit: 20 },
            ],
            as: "perfData",
          },
        },
        { $unwind: { path: "$perfData", preserveNullAndEmptyArrays: false } },
        { $replaceRoot: { newRoot: "$perfData" } },
      ] as PipelineStage.FacetPipelineStage[],

      // ── Activity Feed (recent activity logs) ──
      activityFeed: [
        {
          $match: {
            students: new mongoose.Types.ObjectId(filter.studentId),
            "archive.status": { $ne: true },
            ...(filter.organizationId
              ? { organizationId: new mongoose.Types.ObjectId(filter.organizationId) }
              : {}),
          },
        },
        { $limit: 1 },
        {
          $lookup: {
            from: "activityLogging",
            let: { sid: new mongoose.Types.ObjectId(filter.studentId) },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$userId", "$$sid"] },
                  "archive.status": { $ne: true },
                },
              },
              { $sort: { createdAt: -1 } },
              { $limit: 8 },
              {
                $project: {
                  _id: 1,
                  action: 1,
                  description: 1,
                  entityType: 1,
                  createdAt: 1,
                  page: 1,
                },
              },
            ],
            as: "activities",
          },
        },
        { $unwind: { path: "$activities", preserveNullAndEmptyArrays: false } },
        { $replaceRoot: { newRoot: "$activities" } },
        {
          $project: {
            _id: 1,
            action: 1,
            description: 1,
            entityType: 1,
            timeAgo: {
              $let: {
                vars: {
                  diffMinutes: {
                    $dateDiff: { startDate: "$createdAt", endDate: "$$NOW", unit: "minute" },
                  },
                },
                in: {
                  $cond: [
                    { $lt: ["$$diffMinutes", 60] },
                    { $concat: [{ $toString: "$$diffMinutes" }, "m ago"] },
                    {
                      $cond: [
                        { $lt: ["$$diffMinutes", 1440] },
                        {
                          $concat: [
                            { $toString: { $floor: { $divide: ["$$diffMinutes", 60] } } },
                            "h ago",
                          ],
                        },
                        {
                          $concat: [
                            { $toString: { $floor: { $divide: ["$$diffMinutes", 1440] } } },
                            "d ago",
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      ] as PipelineStage.FacetPipelineStage[],
    },

    Instructor: {
      instructorSummary: [
        {
          $match: {
            instructor: new mongoose.Types.ObjectId(filter.instructorId),
            "archive.status": { $ne: true },
            ...(filter.organizationId
              ? { organizationId: new mongoose.Types.ObjectId(filter.organizationId) }
              : {}),
          },
        },
        {
          $project: {
            _id: 1,
            code: 1,
            students: { $ifNull: ["$students", []] },
            studentCount: { $size: { $ifNull: ["$students", []] } },
          },
        },
        {
          $group: {
            _id: null,
            totalSections: { $sum: 1 },
            totalStudents: { $sum: "$studentCount" },
            allStudentIds: { $push: "$students" },
          },
        },
        {
          $addFields: {
            flattenedStudentIds: {
              $reduce: {
                input: "$allStudentIds",
                initialValue: [],
                in: { $concatArrays: ["$$value", "$$this"] },
              },
            },
          },
        },
        {
          $lookup: {
            from: "users",
            let: { studentIds: "$flattenedStudentIds" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $in: ["$_id", "$$studentIds"] },
                      { $eq: ["$role", "student"] },
                      { $ne: ["$archive.status", true] },
                    ],
                  },
                },
              },
              {
                $project: {
                  _id: 1,
                  createdAt: 1,
                  isNewThisMonth: {
                    $gte: [
                      "$createdAt",
                      {
                        $dateFromParts: {
                          year: { $year: "$$NOW" },
                          month: { $month: "$$NOW" },
                          day: 1,
                        },
                      },
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  totalUniqueStudents: { $sum: 1 },
                  newStudentsThisMonth: { $sum: { $cond: ["$isNewThisMonth", 1, 0] } },
                },
              },
            ],
            as: "studentAnalytics",
          },
        },
        {
          $addFields: {
            uniqueStudentCount: {
              $ifNull: [
                { $arrayElemAt: ["$studentAnalytics.totalUniqueStudents", 0] },
                "$totalStudents",
              ],
            },
            newEnrollments: {
              $ifNull: [{ $arrayElemAt: ["$studentAnalytics.newStudentsThisMonth", 0] }, 0],
            },
            retentionRate: 100,
          },
        },
        {
          $project: {
            _id: 0,
            summary: [
              {
                value: { $toString: "$uniqueStudentCount" },
                label: "Total Enrolled Students",
              },
              {
                value: { $toString: "$newEnrollments" },
                label: "New Enrollment This Month",
              },
              {
                value: { $concat: [{ $toString: "$retentionRate" }, "%"] },
                label: "Retention Rate (Last 3 Months)",
              },
            ],
          },
        },
        { $unwind: "$summary" },
        {
          $replaceRoot: { newRoot: "$summary" },
        },
      ] as PipelineStage.FacetPipelineStage[],

            // --- Instructor Grading Queue (submitted/late waiting for grading) ---
      gradingQueue: [
        {
          $match: {
            instructor: new mongoose.Types.ObjectId(filter.instructorId),
            "archive.status": { $ne: true },
            ...(filter.organizationId
              ? { organizationId: new mongoose.Types.ObjectId(filter.organizationId) }
              : {}),
          },
        },
        {
          $lookup: {
            from: "studentassessmentgrades",
            let: { sectionId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$sectionId", "$$sectionId"] },
                      { $ne: ["$archive.status", true] },
                      { $in: ["$status", ["submitted", "late"]] },
                    ],
                  },
                },
              },
              { $project: { _id: 1 } },
            ],
            as: "pendingGrades",
          },
        },
        {
          $project: {
            pendingCount: { $size: "$pendingGrades" },
          },
        },
        {
          $group: {
            _id: null,
            pendingSubmissions: { $sum: "$pendingCount" },
          },
        },
        {
          $project: {
            _id: 0,
            pendingSubmissions: 1,
          },
        },
      ] as PipelineStage.FacetPipelineStage[],

      // --- Instructor Late/Missing Assignments ---
      lateMissingAssignments: [
        {
          $match: {
            instructor: new mongoose.Types.ObjectId(filter.instructorId),
            "archive.status": { $ne: true },
            ...(filter.organizationId
              ? { organizationId: new mongoose.Types.ObjectId(filter.organizationId) }
              : {}),
          },
        },
        {
          $lookup: {
            from: "studentassessmentgrades",
            let: { sectionId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$sectionId", "$$sectionId"] },
                      { $ne: ["$archive.status", true] },
                    ],
                  },
                },
              },
              {
                $lookup: {
                  from: "assessments",
                  localField: "assessmentId",
                  foreignField: "_id",
                  as: "assessmentInfo",
                  pipeline: [
                    {
                      $match: {
                        "archive.status": { $ne: true },
                        isDeleted: { $ne: true },
                      },
                    },
                    { $project: { endDate: 1 } },
                  ],
                },
              },
              {
                $addFields: {
                  endDateRaw: { $arrayElemAt: ["$assessmentInfo.endDate", 0] },
                },
              },
              {
                $addFields: {
                  endDateNorm: {
                    $cond: [
                      { $eq: [{ $type: "$endDateRaw" }, "date"] },
                      "$endDateRaw",
                      { $toDate: { $ifNull: ["$endDateRaw", new Date()] } },
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  late: {
                    $sum: {
                      $cond: [{ $eq: ["$status", "late"] }, 1, 0],
                    },
                  },
                  missing: {
                    $sum: {
                      $cond: [
                        {
                          $and: [
                            { $eq: ["$status", "pending"] },
                            { $lt: ["$endDateNorm", "$$NOW"] },
                          ],
                        },
                        1,
                        0,
                      ],
                    },
                  },
                },
              },
              { $project: { _id: 0, late: 1, missing: 1 } },
            ],
            as: "lateMissingStats",
          },
        },
        {
          $addFields: {
            late: {
              $ifNull: [{ $arrayElemAt: ["$lateMissingStats.late", 0] }, 0],
            },
            missing: {
              $ifNull: [{ $arrayElemAt: ["$lateMissingStats.missing", 0] }, 0],
            },
          },
        },
        {
          $group: {
            _id: null,
            late: { $sum: "$late" },
            missing: { $sum: "$missing" },
          },
        },
        {
          $project: {
            _id: 0,
            late: 1,
            missing: 1,
            total: { $add: ["$late", "$missing"] },
          },
        },
      ] as PipelineStage.FacetPipelineStage[],

      // --- Instructor Average Grade by Section ---
      averageGradeBySection: [
        {
          $match: {
            instructor: new mongoose.Types.ObjectId(filter.instructorId),
            "archive.status": { $ne: true },
            ...(filter.organizationId
              ? { organizationId: new mongoose.Types.ObjectId(filter.organizationId) }
              : {}),
          },
        },
        {
          $lookup: {
            from: "studentassessmentgrades",
            let: { sectionId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$sectionId", "$$sectionId"] },
                      { $ne: ["$archive.status", true] },
                      { $in: ["$status", ["graded", "returned"]] },
                    ],
                  },
                },
              },
              {
                $addFields: {
                  pct: {
                    $cond: [
                      { $ifNull: ["$percentage", false] },
                      "$percentage",
                      {
                        $cond: [
                          { $gt: ["$totalPoints", 0] },
                          {
                            $multiply: [
                              { $divide: ["$score", "$totalPoints"] },
                              100,
                            ],
                          },
                          0,
                        ],
                      },
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  avgPct: { $avg: "$pct" },
                  gradedCount: { $sum: 1 },
                },
              },
              {
                $project: {
                  _id: 0,
                  avgPct: { $round: ["$avgPct", 1] },
                  gradedCount: 1,
                },
              },
            ],
            as: "gradeStats",
          },
        },
        {
          $addFields: {
            avgPct: {
              $ifNull: [{ $arrayElemAt: ["$gradeStats.avgPct", 0] }, 0],
            },
            gradedCount: {
              $ifNull: [{ $arrayElemAt: ["$gradeStats.gradedCount", 0] }, 0],
            },
          },
        },
        {
          $project: {
            _id: 0,
            section: "$name",
            sectionCode: "$code",
            average: "$avgPct",
            gradedCount: 1,
          },
        },
        { $sort: { average: -1 } },
        { $limit: 5 },
      ] as PipelineStage.FacetPipelineStage[],

      // --- Instructor Engagement Trend (last 7 days) ---
      engagementTrend: [
        {
          $match: {
            instructor: new mongoose.Types.ObjectId(filter.instructorId),
            "archive.status": { $ne: true },
            ...(filter.organizationId
              ? { organizationId: new mongoose.Types.ObjectId(filter.organizationId) }
              : {}),
          },
        },
        { $group: { _id: null, sectionIds: { $push: "$_id" } } },
        {
          $lookup: {
            from: "studentassessmentgrades",
            let: { sectionIds: "$sectionIds" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $in: ["$sectionId", "$$sectionIds"] },
                      { $ne: ["$archive.status", true] },
                      { $in: ["$status", ["submitted", "graded", "returned", "late"]] },
                    ],
                  },
                },
              },
              {
                $addFields: {
                  submittedAtNorm: {
                    $cond: [
                      { $eq: [{ $type: "$submittedAt" }, "date"] },
                      "$submittedAt",
                      { $toDate: { $ifNull: ["$submittedAt", new Date(0)] } },
                    ],
                  },
                },
              },
              {
                $match: {
                  $expr: {
                    $gte: [
                      "$submittedAtNorm",
                      { $dateSubtract: { startDate: "$$NOW", unit: "day", amount: 6 } },
                    ],
                  },
                },
              },
              {
                $project: {
                  day: {
                    $dateToString: {
                      format: "%Y-%m-%d",
                      date: "$submittedAtNorm",
                      timezone: "Asia/Manila",
                    },
                  },
                  studentId: 1,
                },
              },
              { $group: { _id: { day: "$day", studentId: "$studentId" } } },
              { $group: { _id: "$_id.day", activeStudents: { $sum: 1 } } },
              { $sort: { _id: 1 } },
              { $project: { _id: 0, day: "$_id", activeStudents: 1 } },
            ],
            as: "days",
          },
        },
        { $project: { _id: 0, days: 1 } },
      ] as PipelineStage.FacetPipelineStage[],
upComingClassSchedule: [
        // Active lessons (today falls within start–end range)
        {
          $match: {
            instructor: new mongoose.Types.ObjectId(filter.instructorId),
            "archive.status": { $ne: true },
            ...(filter.organizationId
              ? { organizationId: new mongoose.Types.ObjectId(filter.organizationId) }
              : {}),
          },
        },
        {
          $lookup: {
            from: "modules",
            localField: "modules",
            foreignField: "_id",
            as: "moduleDetails",
            pipeline: [{ $match: { "archive.status": { $ne: true } } }],
          },
        },
        { $unwind: { path: "$moduleDetails", preserveNullAndEmptyArrays: false } },
        {
          $lookup: {
            from: "lessons",
            localField: "moduleDetails.lessons",
            foreignField: "_id",
            as: "lessonDetails",
            pipeline: [{ $match: { "archive.status": { $ne: true } } }],
          },
        },
        { $unwind: { path: "$lessonDetails", preserveNullAndEmptyArrays: false } },
        {
          $match: {
            $expr: {
              $and: [
                { $ifNull: ["$lessonDetails.startDate", false] },
                { $ifNull: ["$lessonDetails.endDate", false] },
                {
                  $lte: [
                    {
                      $cond: {
                        if: { $eq: [{ $type: "$lessonDetails.startDate" }, "date"] },
                        then: "$lessonDetails.startDate",
                        else: {
                          $toDate: { $ifNull: ["$lessonDetails.startDate", new Date(0)] },
                        },
                      },
                    },
                    "$$NOW",
                  ],
                },
                {
                  $gte: [
                    {
                      $cond: {
                        if: { $eq: [{ $type: "$lessonDetails.endDate" }, "date"] },
                        then: "$lessonDetails.endDate",
                        else: {
                          $toDate: { $ifNull: ["$lessonDetails.endDate", new Date(0)] },
                        },
                      },
                    },
                    "$$NOW",
                  ],
                },
              ],
            },
          },
        },
        {
          $project: {
            _id: 0,
            type: { $literal: "Lesson" },
            title: "$lessonDetails.title",
            points: { $literal: 0 },
            dueDate: {
              $dateToString: { format: "%Y-%m-%d", date: "$lessonDetails.endDate" },
            },
            status: {
              $cond: {
                if: {
                  $eq: [
                    {
                      $dateToString: {
                        format: "%Y-%m-%d",
                        date: "$lessonDetails.endDate",
                        timezone: "Asia/Manila",
                      },
                    },
                    {
                      $dateToString: {
                        format: "%Y-%m-%d",
                        date: "$$NOW",
                        timezone: "Asia/Manila",
                      },
                    },
                  ],
                },
                then: "Today",
                else: {
                  $cond: {
                    if: {
                      $eq: [
                        {
                          $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$lessonDetails.endDate",
                            timezone: "Asia/Manila",
                          },
                        },
                        {
                          $dateToString: {
                            format: "%Y-%m-%d",
                            date: {
                              $dateAdd: { startDate: "$$NOW", unit: "day", amount: 1 },
                            },
                            timezone: "Asia/Manila",
                          },
                        },
                      ],
                    },
                    then: "Tomorrow",
                    else: "Upcoming",
                  },
                },
              },
            },
            sortDate: "$lessonDetails.endDate",
            sectionCode: "$code",
          },
        },
        // Union with assessments due within 3 days
        {
          $unionWith: {
            coll: "assessments",
            pipeline: [
              {
                $match: {
                  "archive.status": { $ne: true },
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
                              year: { $year: { date: "$$NOW", timezone: "Asia/Manila" } },
                              month: { $month: { date: "$$NOW", timezone: "Asia/Manila" } },
                              day: { $dayOfMonth: { date: "$$NOW", timezone: "Asia/Manila" } },
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
                            {
                              $eq: [
                                "$instructor",
                                new mongoose.Types.ObjectId(filter.instructorId),
                              ],
                            },
                          ],
                        },
                      },
                    },
                    { $project: { code: 1 } },
                  ],
                  as: "sectionInfo",
                },
              },
              { $match: { $expr: { $gt: [{ $size: "$sectionInfo" }, 0] } } },
              {
                $project: {
                  _id: 0,
                  type: { $toUpper: "$type" },
                  title: "$title",
                  points: { $ifNull: ["$totalPoints", 0] },
                  dueDate: {
                    $dateToString: {
                      format: "%Y-%m-%d",
                      date: {
                        $cond: {
                          if: { $eq: [{ $type: "$endDate" }, "date"] },
                          then: "$endDate",
                          else: { $toDate: { $ifNull: ["$endDate", new Date()] } },
                        },
                      },
                    },
                  },
                  status: {
                    $let: {
                      vars: {
                        endDateNorm: {
                          $cond: {
                            if: { $eq: [{ $type: "$endDate" }, "date"] },
                            then: "$endDate",
                            else: { $toDate: { $ifNull: ["$endDate", new Date()] } },
                          },
                        },
                      },
                      in: {
                        $cond: {
                          if: {
                            $eq: [
                              {
                                $dateToString: {
                                  format: "%Y-%m-%d",
                                  date: "$$endDateNorm",
                                  timezone: "Asia/Manila",
                                },
                              },
                              {
                                $dateToString: {
                                  format: "%Y-%m-%d",
                                  date: "$$NOW",
                                  timezone: "Asia/Manila",
                                },
                              },
                            ],
                          },
                          then: "Today",
                          else: {
                            $cond: {
                              if: {
                                $eq: [
                                  {
                                    $dateToString: {
                                      format: "%Y-%m-%d",
                                      date: "$$endDateNorm",
                                      timezone: "Asia/Manila",
                                    },
                                  },
                                  {
                                    $dateToString: {
                                      format: "%Y-%m-%d",
                                      date: {
                                        $dateAdd: { startDate: "$$NOW", unit: "day", amount: 1 },
                                      },
                                      timezone: "Asia/Manila",
                                    },
                                  },
                                ],
                              },
                              then: "Tomorrow",
                              else: "Upcoming",
                            },
                          },
                        },
                      },
                    },
                  },
                  sortDate: {
                    $cond: {
                      if: { $eq: [{ $type: "$endDate" }, "date"] },
                      then: "$endDate",
                      else: { $toDate: { $ifNull: ["$endDate", new Date()] } },
                    },
                  },
                  sectionCode: { $arrayElemAt: ["$sectionInfo.code", 0] },
                },
              },
            ],
          },
        },
        { $sort: { sortDate: 1 } },
        { $project: { sortDate: 0 } },
        { $limit: 5 },
      ] as PipelineStage.FacetPipelineStage[],

      announcements: [
        {
          $match: {
            instructor: new mongoose.Types.ObjectId(filter.instructorId),
            "archive.status": { $ne: true },
            ...(filter.organizationId
              ? { organizationId: new mongoose.Types.ObjectId(filter.organizationId) }
              : {}),
          },
        },
        { $unwind: "$announcements" },
        {
          $lookup: {
            from: "announcements",
            localField: "announcements",
            foreignField: "_id",
            as: "announcementDetails",
            pipeline: [
              {
                $match: {
                  "archive.status": { $ne: true },
                },
              },
            ],
          },
        },
        { $unwind: "$announcementDetails" },
        {
          $addFields: {
            normalizedPublishDate: {
              $cond: {
                if: { $eq: [{ $type: "$announcementDetails.publishDate" }, "date"] },
                then: "$announcementDetails.publishDate",
                else: { $toDate: { $ifNull: ["$announcementDetails.publishDate", new Date()] } },
              },
            },
            dateFormatted: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: {
                  $cond: {
                    if: { $eq: [{ $type: "$announcementDetails.publishDate" }, "date"] },
                    then: "$announcementDetails.publishDate",
                    else: {
                      $toDate: { $ifNull: ["$announcementDetails.publishDate", new Date()] },
                    },
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
            daysAgo: {
              $cond: [
                { $eq: ["$dateFormatted", "$todayFormatted"] },
                "Today",
                {
                  $cond: [
                    { $eq: ["$dateFormatted", "$tomorrowFormatted"] },
                    "Tomorrow",
                    {
                      $cond: [
                        { $lt: ["$normalizedPublishDate", "$$NOW"] },
                        {
                          $concat: [
                            {
                              $toString: {
                                $ceil: {
                                  $abs: {
                                    $divide: [
                                      {
                                        $dateDiff: {
                                          startDate: "$normalizedPublishDate",
                                          endDate: "$$NOW",
                                          unit: "day",
                                        },
                                      },
                                      1,
                                    ],
                                  },
                                },
                              },
                            },
                            " day(s) ago",
                          ],
                        },
                        "Upcoming",
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "announcementDetails.author",
            foreignField: "_id",
            as: "authorDetails",
            pipeline: [
              {
                $match: {
                  "archive.status": { $ne: true },
                },
              },
            ],
          },
        },
        { $unwind: { path: "$authorDetails", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$announcementDetails._id",
            authorName: {
              $first: { $concat: ["$authorDetails.firstName", " ", "$authorDetails.lastName"] },
            },
            authorImage: { $first: "$authorDetails.avatar" },
            content: { $first: "$announcementDetails.textBody" },
            title: { $first: "$announcementDetails.title" },
            postedAt: { $first: "$normalizedPublishDate" },
            publishDate: { $first: "$normalizedPublishDate" },
            priorityScore: { $first: "$priorityScore" },
            daysAgo: { $first: "$daysAgo" },
            sectionCode: { $first: "$code" },
          },
        },
        {
          $sort: {
            priorityScore: -1,
            postedAt: -1,
            _id: 1,
          },
        },
        {
          $project: {
            _id: 1,
            authorName: 1,
            authorImage: 1,
            content: 1,
            title: 1,
            postedAt: 1,
            publishDate: 1,
            daysAgo: 1,
            sectionCode: 1,
          },
        },
        { $limit: 5 },
      ] as PipelineStage.FacetPipelineStage[],

      courses: [
        {
          $match: {
            instructor: new mongoose.Types.ObjectId(filter.instructorId),
            "archive.status": { $ne: true },
            ...(filter.organizationId
              ? { organizationId: new mongoose.Types.ObjectId(filter.organizationId) }
              : {}),
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
                $match: {
                  "archive.status": { $ne: true },
                },
              },
            ],
          },
        },
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
      ] as PipelineStage.FacetPipelineStage[],

      gradeData: [
        {
          $match: {
            instructor: new mongoose.Types.ObjectId(filter.instructorId),
            "archive.status": { $ne: true },
            grade: { $exists: true, $ne: null },
          },
        },
        {
          $lookup: {
            from: "grades",
            localField: "grade",
            foreignField: "_id",
            as: "gradeConfig",
          },
        },
        {
          $unwind: {
            path: "$gradeConfig",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "students",
            foreignField: "_id",
            as: "studentInfo",
            pipeline: [
              {
                $match: {
                  role: "student",
                  "archive.status": { $ne: true },
                },
              },
              {
                $project: {
                  _id: 1,
                  firstName: 1,
                  lastName: 1,
                  studentAssessmentResults: 1,
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
            as: "assessmentInfo",
            pipeline: [
              {
                $match: {
                  "archive.status": { $ne: true },
                  isDeleted: { $ne: true },
                },
              },
            ],
          },
        },
        {
          $unwind: {
            path: "$studentInfo",
            preserveNullAndEmptyArrays: false,
          },
        },
        {
          $addFields: {
            filteredAssessments: {
              $filter: {
                input: "$assessmentInfo",
                as: "assessment",
                cond: {
                  $eq: ["$$assessment.section", "$_id"],
                },
              },
            },
          },
        },
        {
          $addFields: {
            quizAssessments: {
              $filter: {
                input: "$filteredAssessments",
                as: "assessment",
                cond: { $eq: ["$$assessment.type", "quiz"] },
              },
            },
            assignmentAssessments: {
              $filter: {
                input: "$filteredAssessments",
                as: "assessment",
                cond: { $eq: ["$$assessment.type", "assignment"] },
              },
            },
            finalAssessments: {
              $filter: {
                input: "$filteredAssessments",
                as: "assessment",
                cond: { $eq: ["$$assessment.type", "final_exam"] },
              },
            },
          },
        },
        {
          $addFields: {
            processedQuizResults: {
              $map: {
                input: "$quizAssessments",
                as: "assessment",
                in: {
                  $let: {
                    vars: {
                      studentResult: {
                        $first: {
                          $filter: {
                            input: { $ifNull: ["$studentInfo.studentAssessmentResults", []] },
                            as: "result",
                            cond: {
                              $and: [
                                { $eq: ["$$result.assessmentId", "$$assessment._id"] },
                                { $eq: ["$$result.isFinished", true] },
                                { $ne: ["$$result.isDeleted", true] },
                              ],
                            },
                          },
                        },
                      },
                      assessmentTotalPoints: { $ifNull: ["$$assessment.totalPoints", 0] },
                    },
                    in: {
                      score: { $ifNull: ["$$studentResult.totalScore", 0] },
                      totalPoints: "$$assessmentTotalPoints",
                      percentage: {
                        $cond: [
                          { $gt: ["$$assessmentTotalPoints", 0] },
                          {
                            $multiply: [
                              {
                                $divide: [
                                  { $ifNull: ["$$studentResult.totalScore", 0] },
                                  "$$assessmentTotalPoints",
                                ],
                              },
                              100,
                            ],
                          },
                          0,
                        ],
                      },
                    },
                  },
                },
              },
            },
            processedAssignmentResults: {
              $map: {
                input: "$assignmentAssessments",
                as: "assessment",
                in: {
                  $let: {
                    vars: {
                      studentResult: {
                        $first: {
                          $filter: {
                            input: { $ifNull: ["$studentInfo.studentAssessmentResults", []] },
                            as: "result",
                            cond: {
                              $and: [
                                { $eq: ["$$result.assessmentId", "$$assessment._id"] },
                                { $eq: ["$$result.isFinished", true] },
                                { $ne: ["$$result.isDeleted", true] },
                              ],
                            },
                          },
                        },
                      },
                      assessmentTotalPoints: { $ifNull: ["$$assessment.totalPoints", 0] },
                    },
                    in: {
                      score: { $ifNull: ["$$studentResult.totalScore", 0] },
                      totalPoints: "$$assessmentTotalPoints",
                      percentage: {
                        $cond: [
                          { $gt: ["$$assessmentTotalPoints", 0] },
                          {
                            $multiply: [
                              {
                                $divide: [
                                  { $ifNull: ["$$studentResult.totalScore", 0] },
                                  "$$assessmentTotalPoints",
                                ],
                              },
                              100,
                            ],
                          },
                          0,
                        ],
                      },
                    },
                  },
                },
              },
            },
            processedFinalResults: {
              $map: {
                input: "$finalAssessments",
                as: "assessment",
                in: {
                  $let: {
                    vars: {
                      studentResult: {
                        $first: {
                          $filter: {
                            input: { $ifNull: ["$studentInfo.studentAssessmentResults", []] },
                            as: "result",
                            cond: {
                              $and: [
                                { $eq: ["$$result.assessmentId", "$$assessment._id"] },
                                { $eq: ["$$result.isFinished", true] },
                                { $ne: ["$$result.isDeleted", true] },
                              ],
                            },
                          },
                        },
                      },
                      assessmentTotalPoints: { $ifNull: ["$$assessment.totalPoints", 0] },
                    },
                    in: {
                      score: { $ifNull: ["$$studentResult.totalScore", 0] },
                      totalPoints: "$$assessmentTotalPoints",
                      percentage: {
                        $cond: [
                          { $gt: ["$$assessmentTotalPoints", 0] },
                          {
                            $multiply: [
                              {
                                $divide: [
                                  { $ifNull: ["$$studentResult.totalScore", 0] },
                                  "$$assessmentTotalPoints",
                                ],
                              },
                              100,
                            ],
                          },
                          0,
                        ],
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
            weights: {
              quiz: {
                $let: {
                  vars: {
                    quizWeight: {
                      $filter: {
                        input: { $ifNull: ["$gradeConfig.gradeDistribution", []] },
                        as: "distribution",
                        cond: {
                          $regexMatch: {
                            input: { $toLower: "$$distribution.category" },
                            regex: "quiz",
                          },
                        },
                      },
                    },
                  },
                  in: {
                    $cond: [
                      { $gt: [{ $size: "$$quizWeight" }, 0] },
                      { $arrayElemAt: ["$$quizWeight.weight", 0] },
                      25, // Default weight
                    ],
                  },
                },
              },
              assignment: {
                $let: {
                  vars: {
                    assignmentWeight: {
                      $filter: {
                        input: { $ifNull: ["$gradeConfig.gradeDistribution", []] },
                        as: "distribution",
                        cond: {
                          $regexMatch: {
                            input: { $toLower: "$$distribution.category" },
                            regex: "assignment",
                          },
                        },
                      },
                    },
                  },
                  in: {
                    $cond: [
                      { $gt: [{ $size: "$$assignmentWeight" }, 0] },
                      { $arrayElemAt: ["$$assignmentWeight.weight", 0] },
                      25, // Default weight
                    ],
                  },
                },
              },
              final: {
                $let: {
                  vars: {
                    finalWeight: {
                      $filter: {
                        input: { $ifNull: ["$gradeConfig.gradeDistribution", []] },
                        as: "distribution",
                        cond: {
                          $regexMatch: {
                            input: { $toLower: "$$distribution.category" },
                            regex: "final",
                          },
                        },
                      },
                    },
                  },
                  in: {
                    $cond: [
                      { $gt: [{ $size: "$$finalWeight" }, 0] },
                      { $arrayElemAt: ["$$finalWeight.weight", 0] },
                      50, // Default weight
                    ],
                  },
                },
              },
            },
          },
        },
        {
          $addFields: {
            quizAverage: {
              $cond: [
                { $gt: [{ $size: "$processedQuizResults" }, 0] },
                { $avg: "$processedQuizResults.percentage" },
                0,
              ],
            },
            assignmentAverage: {
              $cond: [
                { $gt: [{ $size: "$processedAssignmentResults" }, 0] },
                { $avg: "$processedAssignmentResults.percentage" },
                0,
              ],
            },
            finalAverage: {
              $cond: [
                { $gt: [{ $size: "$processedFinalResults" }, 0] },
                { $avg: "$processedFinalResults.percentage" },
                0,
              ],
            },
          },
        },
        {
          $addFields: {
            hasAllRequiredAssessments: {
              $and: [
                { $gt: [{ $size: "$processedQuizResults" }, 0] },
                { $gt: [{ $size: "$processedAssignmentResults" }, 0] },
                { $gt: [{ $size: "$processedFinalResults" }, 0] },
              ],
            },
            weightedAverage: {
              $cond: [
                {
                  $and: [
                    { $gt: [{ $size: "$processedQuizResults" }, 0] },
                    { $gt: [{ $size: "$processedAssignmentResults" }, 0] },
                    { $gt: [{ $size: "$processedFinalResults" }, 0] },
                  ],
                },
                {
                  $divide: [
                    {
                      $add: [
                        { $multiply: ["$quizAverage", "$weights.quiz"] },
                        { $multiply: ["$assignmentAverage", "$weights.assignment"] },
                        { $multiply: ["$finalAverage", "$weights.final"] },
                      ],
                    },
                    {
                      $add: ["$weights.quiz", "$weights.assignment", "$weights.final"],
                    },
                  ],
                },
                null,
              ],
            },
          },
        },
        {
          $match: {
            hasAllRequiredAssessments: true,
          },
        },
        {
          $addFields: {
            gradeValue: {
              $let: {
                vars: {
                  percentageScore: { $round: ["$weightedAverage", 0] },
                  gradingScales: "$gradeConfig.gradingScale",
                },
                in: {
                  $reduce: {
                    input: "$$gradingScales",
                    initialValue: "5.00", // Default to failing grade
                    in: {
                      $cond: [
                        {
                          $and: [
                            {
                              $gte: ["$$percentageScore", "$$this.percentageRange.startRange"],
                            },
                            { $lte: ["$$percentageScore", "$$this.percentageRange.endRange"] },
                          ],
                        },
                        "$$this.gradeLabel",
                        "$$value",
                      ],
                    },
                  },
                },
              },
            },
          },
        },
        {
          $group: {
            _id: "$gradeValue",
            count: { $sum: 1 },
            students: {
              $push: {
                id: "$studentInfo._id",
                average: "$weightedAverage",
              },
            },
          },
        },
        {
          $sort: { _id: 1 },
        },
        {
          $group: {
            _id: null,
            gradeDetails: { $push: { gradeLabel: "$_id", count: "$count", students: "$students" } },
            foundLabels: { $push: "$_id" },
            foundValues: { $push: "$count" },
          },
        },
        {
          $addFields: {
            allLabels: {
              $literal: [
                "1.00",
                "1.25",
                "1.50",
                "1.75",
                "2.00",
                "2.25",
                "2.50",
                "2.75",
                "3.00",
                "5.00",
              ],
            },
          },
        },
        {
          $project: {
            _id: { $literal: new mongoose.Types.ObjectId().toString() },
            gradeDetails: 1,
            labels: "$allLabels",
            values: {
              $map: {
                input: "$allLabels",
                as: "label",
                in: {
                  $let: {
                    vars: {
                      matchingGrade: {
                        $filter: {
                          input: "$gradeDetails",
                          as: "detail",
                          cond: { $eq: ["$$detail.gradeLabel", "$$label"] },
                        },
                      },
                    },
                    in: {
                      $cond: [
                        { $gt: [{ $size: "$$matchingGrade" }, 0] },
                        { $arrayElemAt: ["$$matchingGrade.count", 0] },
                        0,
                      ],
                    },
                  },
                },
              },
            },
          },
        },
        {
          $lookup: {
            from: "sections",
            let: { instructorId: { $literal: new mongoose.Types.ObjectId(filter.instructorId) } },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$instructor", "$$instructorId"] },
                      { $ne: ["$archive.status", true] },
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  totalStudents: { $sum: { $size: "$students" } },
                },
              },
            ],
            as: "sectionsData",
          },
        },
        {
          $addFields: {
            totalStudents: {
              $cond: [
                { $gt: [{ $size: "$sectionsData" }, 0] },
                { $ifNull: [{ $arrayElemAt: ["$sectionsData.totalStudents", 0] }, 0] },
                0,
              ],
            },
          },
        },
        {
          $project: {
            _id: 1,
            gradeDetails: 1,
            labels: 1,
            values: 1,
            totalStudents: 1,
          },
        },
      ],
      sectionsAttendance: [
        {
          $match: {
            instructor: new mongoose.Types.ObjectId(filter.instructorId),
            "archive.status": { $ne: true },
            ...(filter.organizationId
              ? { organizationId: new mongoose.Types.ObjectId(filter.organizationId) }
              : {}),
          },
        },
        {
          $addFields: {
            todayAttendance: {
              $filter: {
                input: { $ifNull: ["$attendance", []] },
                as: "attend",
                cond: {
                  $and: [
                    {
                      $gte: [
                        "$$attend.date",
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
                      $lt: [
                        "$$attend.date",
                        {
                          $dateAdd: {
                            startDate: {
                              $dateFromParts: {
                                year: { $year: "$$NOW" },
                                month: { $month: "$$NOW" },
                                day: { $dayOfMonth: "$$NOW" },
                              },
                            },
                            unit: "day",
                            amount: 1,
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            code: 1,
            students: { $ifNull: ["$students", []] },
            totalStudents: { $size: { $ifNull: ["$students", []] } },
            presentStudents: {
              $size: {
                $filter: {
                  input: "$todayAttendance",
                  as: "attendance",
                  cond: {
                    $or: [
                      { $eq: ["$$attendance.status", "present"] },
                      { $eq: ["$$attendance.status", "late"] },
                    ],
                  },
                },
              },
            },
          },
        },
        {
          $addFields: {
            absentStudents: {
              $subtract: ["$totalStudents", "$presentStudents"],
            },
          },
        },
        {
          $group: {
            _id: null,
            sections: {
              $push: {
                section: "$name",
                sectionCode: "$code",
                present: "$presentStudents",
                absent: "$absentStudents",
                total: "$totalStudents",
              },
            },
            totalOverallStudents: { $sum: "$totalStudents" },
          },
        },
        {
          $addFields: {
            numberOfStudents: "$totalOverallStudents",
          },
        },
        {
          $project: {
            _id: 0,
            sections: 1,
            numberOfStudents: 1,
          },
        },
      ],
    },

    Organization: {
      totalStudentEnrolled: [
        {
          $match: {
            _id: new mongoose.Types.ObjectId(filter?.organizationId),
            "archive.status": { $ne: true },
          },
        },
        {
          $lookup: {
            from: "users",
            let: { orgId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$organizationId", "$$orgId"] },
                      { $eq: ["$role", "student"] },
                      { $ne: ["$archive.status", true] },
                    ],
                  },
                },
              },
              {
                $count: "total",
              },
            ],
            as: "studentCount",
          },
        },
        {
          $project: {
            _id: 0,
            total: { $ifNull: [{ $arrayElemAt: ["$studentCount.total", 0] }, 0] },
          },
        },
      ],
      totalStudentEnrolledByMonth: [
        {
          $match: {
            _id: new mongoose.Types.ObjectId(filter?.organizationId),
            "archive.status": { $ne: true },
          },
        },
        {
          $lookup: {
            from: "users",
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $eq: [
                          "$organizationId",
                          new mongoose.Types.ObjectId(filter?.organizationId),
                        ],
                      },
                      { $eq: ["$role", "student"] },
                      { $ne: ["$archive.status", true] },
                      ...(filter?.dateFrom && filter?.dateTo
                        ? [
                            {
                              $and: [
                                { $gte: ["$createdAt", new Date(filter.dateFrom)] },
                                { $lte: ["$createdAt", new Date(filter.dateTo)] },
                              ],
                            },
                          ]
                        : []),
                    ],
                  },
                },
              },
              {
                $count: "total",
              },
            ],
            as: "studentCount",
          },
        },
        {
          $project: {
            _id: 0,
            total: { $ifNull: [{ $arrayElemAt: ["$studentCount.total", 0] }, 0] },
          },
        },
      ],

      studentByStatus: [
        {
          $match: {
            _id: new mongoose.Types.ObjectId(filter?.organizationId),
            "archive.status": { $ne: true },
          },
        },
        {
          $lookup: {
            from: "users",
            let: { orgId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$organizationId", "$$orgId"] },
                      { $eq: ["$role", "student"] },
                      { $ne: ["$archive.status", true] },
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  totalStudents: { $sum: 1 },
                  activeStudents: {
                    $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
                  },
                  inactiveStudents: {
                    $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] },
                  },
                  dropoutRate: {
                    $sum: { $cond: [{ $eq: ["$status", "withdrawn"] }, 1, 0] },
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  activeStudents: "$activeStudents",
                  inactiveStudents: "$inactiveStudents",
                  dropoutRate: "$dropoutRate",
                  retentionRate: {
                    $divide: [
                      {
                        $trunc: {
                          $multiply: [
                            {
                              $multiply: [
                                { $divide: ["$activeStudents", { $max: ["$totalStudents", 1] }] },
                                100,
                              ],
                            },
                            100,
                          ],
                        },
                      },
                      100,
                    ],
                  },
                },
              },
            ],
            as: "studentStatusData",
          },
        },
        {
          $project: {
            _id: 0,
            activeStudents: {
              $ifNull: [{ $arrayElemAt: ["$studentStatusData.activeStudents", 0] }, 0],
            },
            inactiveStudents: {
              $ifNull: [{ $arrayElemAt: ["$studentStatusData.inactiveStudents", 0] }, 0],
            },
            retentionRate: {
              $ifNull: [{ $arrayElemAt: ["$studentStatusData.retentionRate", 0] }, 0],
            },
            dropoutRate: {
              $ifNull: [{ $arrayElemAt: ["$studentStatusData.dropoutRate", 0] }, 0],
            },
          },
        },
      ],
      totalCourses: [
        {
          $match: {
            _id: new mongoose.Types.ObjectId(filter?.organizationId),
            "archive.status": { $ne: true },
          },
        },
        {
          $lookup: {
            from: "courses",
            let: { orgId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$organizationId", "$$orgId"] },
                      { $ne: ["$archive.status", true] },
                    ],
                  },
                },
              },
              {
                $count: "total",
              },
            ],
            as: "courseCount",
          },
        },
        {
          $project: {
            _id: 0,
            total: { $ifNull: [{ $arrayElemAt: ["$courseCount.total", 0] }, 0] },
          },
        },
      ],
      instructorsToAssign: [
        {
          $match: {
            _id: new mongoose.Types.ObjectId(filter?.organizationId),
            "archive.status": { $ne: true },
          },
        },
        {
          $lookup: {
            from: "users",
            let: { orgId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$organizationId", "$$orgId"] },
                      { $eq: ["$role", "student"] },
                      { $eq: ["$status", "active"] },
                      { $ne: ["$archive.status", true] },
                    ],
                  },
                },
              },
              {
                $count: "totalStudents",
              },
            ],
            as: "studentCount",
          },
        },
        {
          $project: {
            _id: 0,
            total: {
              $let: {
                vars: {
                  totalStudents: {
                    $ifNull: [{ $arrayElemAt: ["$studentCount.totalStudents", 0] }, 0],
                  },
                },
                in: {
                  $ceil: { $divide: ["$$totalStudents", 30] },
                },
              },
            },
          },
        },
      ],
      coursesToAssign: [
        {
          $match: {
            _id: new mongoose.Types.ObjectId(filter?.organizationId),
            "archive.status": { $ne: true },
          },
        },
        {
          $lookup: {
            from: "courses",
            let: { orgId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$organizationId", "$$orgId"] },
                      { $ne: ["$archive.status", true] },
                    ],
                  },
                },
              },
              {
                $lookup: {
                  from: "sections",
                  let: { courseId: "$_id" },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $and: [
                            { $eq: ["$course", "$$courseId"] },
                            { $eq: ["$organizationId", "$$orgId"] },
                            { $ne: ["$archive.status", true] },
                          ],
                        },
                      },
                    },
                  ],
                  as: "sections",
                },
              },
              {
                $project: {
                  _id: 1,
                  title: 1,
                  code: 1,
                  description: 1,
                },
              },
            ],
            as: "unassignedCourses",
          },
        },
        {
          $project: {
            _id: 0,
            courses: "$unassignedCourses",
            total: { $size: "$unassignedCourses" },
          },
        },
      ],
      studentPerSection: [
        {
          $match: {
            _id: new mongoose.Types.ObjectId(filter?.organizationId),
            "archive.status": { $ne: true },
          },
        },
        {
          $lookup: {
            from: "sections",
            let: { orgId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$organizationId", "$$orgId"] },
                      { $ne: ["$archive.status", true] },
                    ],
                  },
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
                      $match: {
                        "archive.status": { $ne: true },
                      },
                    },
                  ],
                },
              },
              {
                $project: {
                  _id: 1,
                  name: 1,
                  code: 1,
                  courseName: { $arrayElemAt: ["$courseInfo.title", 0] },
                  courseCode: { $arrayElemAt: ["$courseInfo.code", 0] },
                  totalStudents: { $size: { $ifNull: ["$students", []] } },
                },
              },
            ],
            as: "sectionStats",
          },
        },
        {
          $unwind: {
            path: "$sectionStats",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $replaceRoot: { newRoot: "$sectionStats" },
        },
      ],
      studentsPerCourse: [
        {
          $match: {
            _id: new mongoose.Types.ObjectId(filter?.organizationId),
            "archive.status": { $ne: true },
          },
        },
        {
          $lookup: {
            from: "courses",
            let: { orgId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$organizationId", "$$orgId"] },
                      { $ne: ["$archive.status", true] },
                    ],
                  },
                },
              },
              {
                $lookup: {
                  from: "sections",
                  let: { courseId: "$_id" },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $and: [
                            { $eq: ["$course", "$$courseId"] },
                            { $eq: ["$organizationId", "$$orgId"] },
                            { $ne: ["$archive.status", true] },
                          ],
                        },
                      },
                    },
                  ],
                  as: "sections",
                },
              },
              {
                $project: {
                  _id: 1,
                  courseName: "$title",
                  courseCode: "$code",
                  totalStudents: {
                    $reduce: {
                      input: "$sections",
                      initialValue: 0,
                      in: { $add: ["$$value", { $size: { $ifNull: ["$$this.students", []] } }] },
                    },
                  },
                },
              },
            ],
            as: "courseStats",
          },
        },
        {
          $unwind: {
            path: "$courseStats",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $replaceRoot: { newRoot: "$courseStats" },
        },
      ],
      totalInstructor: [
        {
          $match: {
            _id: new mongoose.Types.ObjectId(filter?.organizationId),
            "archive.status": { $ne: true },
          },
        },
        {
          $lookup: {
            from: "users",
            let: { orgId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$organizationId", "$$orgId"] },
                      { $eq: ["$role", "instructor"] },
                      { $ne: ["$archive.status", true] },
                    ],
                  },
                },
              },
              {
                $count: "total",
              },
            ],
            as: "instructorCount",
          },
        },
        {
          $project: {
            _id: 0,
            total: { $ifNull: [{ $arrayElemAt: ["$instructorCount.total", 0] }, 0] },
          },
        },
      ],
    },
    Course: {
      totalCourseCount: [
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(filter?.organizationId),
            "archive.status": { $ne: true },
          },
        },
        {
          $count: "total",
        },
      ],
      courseCountPerCategory: [
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(filter?.organizationId),
            "archive.status": { $ne: true },
          },
        },
        {
          $group: {
            _id: "$category",
            total: { $sum: 1 },
          },
        },
        {
          $sort: { total: -1 },
        },
        { $limit: 4 },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "_id",
            as: "categoryInfo",
          },
        },
        { $unwind: "$categoryInfo" },
        {
          $project: {
            _id: 0,
            category: "$categoryInfo.name",
            total: 1,
          },
        },
      ],
    },
    USER: {
      totalInstructorCount: [
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(filter?.organizationId),
            "archive.status": { $ne: true },
            role: "instructor",
          },
        },
        {
          $count: "total",
        },
      ],
      totalStudentCount: [
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(filter?.organizationId),
            "archive.status": { $ne: true },
            role: "student",
          },
        },
        {
          $count: "total",
        },
      ],
      instructorCountPerFaculty: [
        {
          $match: {
            role: "instructor",
            organizationId: new mongoose.Types.ObjectId(filter?.organizationId),
            "archive.status": { $ne: true },
          },
        },
        {
          $group: {
            _id: "$faculty",
            total: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
        { $limit: 4 },
        {
          $lookup: {
            from: "faculties",
            localField: "_id",
            foreignField: "_id",
            as: "facultyInfo",
          },
        },
        { $unwind: "$facultyInfo" },
        {
          $project: {
            _id: 0,
            faculty: "$facultyInfo.name",
            total: 1,
          },
        },
      ],
      studentCountPerProgram: [
        {
          $match: {
            role: "student",
            organizationId: new mongoose.Types.ObjectId(filter?.organizationId),
            "archive.status": { $ne: true },
          },
        },
        {
          $group: {
            _id: "$program",
            total: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
        { $limit: 4 },
        {
          $lookup: {
            from: "programs",
            localField: "_id",
            foreignField: "_id",
            as: "programInfo",
          },
        },
        { $unwind: "$programInfo" },
        {
          $project: {
            _id: 0,
            program: "$programInfo.name",
            total: 1,
          },
        },
      ],
    },
    Section: {
      totalSectionCount: [
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(filter?.organizationId),
            "archive.status": { $ne: true },
          },
        },
        {
          $count: "total",
        },
      ],
      studentsPerSectionCount: [
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(filter?.organizationId),
            "archive.status": { $ne: true },
            ...(filter.course ? { course: new mongoose.Types.ObjectId(filter.course) } : {}),
            ...(filter.instructor
              ? { instructor: new mongoose.Types.ObjectId(filter.instructor) }
              : {}),
          },
        },
        {
          $project: {
            section: "$name",
            total: { $size: { $ifNull: ["$students", []] } },
          },
        },
        { $sort: { total: -1 } },
      ],
      sectionPerStatusCount: [
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(filter?.organizationId),
            "archive.status": { $ne: true },
            ...(filter.course ? { course: new mongoose.Types.ObjectId(filter.course) } : {}),
            ...(filter.instructor
              ? { instructor: new mongoose.Types.ObjectId(filter.instructor) }
              : {}),
          },
        },
        {
          $group: {
            _id: "$status",
            total: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            status: "$_id",
            total: 1,
          },
        },
      ],
    },
  };
};

