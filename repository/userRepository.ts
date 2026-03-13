import mongoose, { FilterQuery, UpdateQuery } from "mongoose";
import User, { IUser } from "../models/userModel";

interface DbParams {
  query?: any;
  options?: {
    populateArray?: any[];
    select?: string;
    lean?: boolean;
    sort?: any;
    limit?: number;
    skip?: number;
  };
}

const userRepository = {
  getUser,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  searchUser,
  searchAndUpdate,
  countUsers,
  getUserMetrics,
  bulkCreate,
  archiveUser,
};

export default userRepository;

function getUser(id: string, dbParams: DbParams = {}): Promise<IUser | null> {
  let query = User.findById(id);

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
  return query.exec();
}

function getUsers(dbParams: DbParams): Promise<IUser[]> {
  let query = User.find(dbParams.query || {});

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
    select: dbParams.options?.select || "_id",
    lean: dbParams.options?.lean || true,
    skip: dbParams.options?.skip || 0,
  };

  query = query
    .sort(options.sort)
    .limit(options.limit)
    .select(options.select)
    .lean(options.lean)
    .skip(options.skip);

  if (dbParams.query?.organizationId) {
    query.where("organizationId").equals(dbParams.query.organizationId);
  }

  return query.exec();
}

function countUsers(query: any): Promise<number> {
  return User.countDocuments(query).exec();
}

async function createUser(data: Partial<IUser>): Promise<IUser> {
  const user = await User.create(data);
  const userWithoutPassword = await User.findById(user.id).select("-password").lean().exec();
  return userWithoutPassword as IUser;
}

function updateUser(userId: string, data: Partial<IUser>): Promise<IUser | null> {
  return User.findByIdAndUpdate(userId, { $set: data }, { new: true });
}

function deleteUser(id: string): Promise<IUser | null> {
  return User.findByIdAndDelete(id);
}

function searchUser(params: any = {}): Promise<IUser[]> {
  const query = User.find();
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
  query: FilterQuery<IUser>,
  update?: UpdateQuery<IUser>,
  options?: { multi?: boolean }
): Promise<IUser | null | { modifiedCount: number }> {
  if (!update) {
    return User.findOne(query).populate("organizationId", "name code type branding").exec();
  }

  if (options?.multi) {
    const result = await User.updateMany(query, update);
    return { modifiedCount: result.modifiedCount };
  }

  return User.findOneAndUpdate(query, update, { new: true });
}

async function getUserMetrics(
  organizationId: string,
  startTime: Date,
  endTime: Date
): Promise<any> {
  try {
    const metrics = await User.aggregate([
      {
        $match: {
          organizationId: new mongoose.Types.ObjectId(organizationId),
          createdAt: {
            $gte: startTime,
            $lte: endTime,
          },
          "archive.status": false,
        },
      },
      {
        $facet: {
          fullTime: [{ $match: { employmentType: "full_time" } }, { $count: "total" }],
          partTime: [{ $match: { employmentType: "part_time" } }, { $count: "total" }],
          probationary: [{ $match: { employmentType: "probationary" } }, { $count: "total" }],
          student: [{ $match: { role: "student" } }, { $count: "total" }],
          activeStudent: [{ $match: { role: "student", status: "active" } }, { $count: "total" }],
          inactiveStudent: [
            { $match: { role: "student", status: "inactive" } },
            { $count: "total" },
          ],
          studentGPA: [
            { $match: { role: "student", status: "active" } },
            {
              $group: {
                _id: null,
                averageGPA: { $avg: "$gpa" },
              },
            },
          ],
          instructor: [{ $match: { role: "instructor" } }, { $count: "total" }],
          teacherStudentRatio: [
            {
              $group: {
                _id: null,
                totalTeachers: {
                  $sum: { $cond: [{ $eq: ["$role", "instructor"] }, 1, 0] },
                },
                totalStudents: {
                  $sum: { $cond: [{ $eq: ["$role", "student"] }, 1, 0] },
                },
              },
            },
            {
              $project: {
                ratio: {
                  $cond: [
                    { $eq: ["$totalTeachers", 0] },
                    0,
                    { $divide: ["$totalStudents", "$totalTeachers"] },
                  ],
                },
              },
            },
          ],
        },
      },
      {
        $project: {
          fullTimeCount: { $ifNull: [{ $arrayElemAt: ["$fullTime.total", 0] }, 0] },
          partTimeCount: { $ifNull: [{ $arrayElemAt: ["$partTime.total", 0] }, 0] },
          probationaryCount: { $ifNull: [{ $arrayElemAt: ["$probationary.total", 0] }, 0] },
          instructorCount: { $ifNull: [{ $arrayElemAt: ["$instructor.total", 0] }, 0] },
          teacherStudentRatio: {
            $ifNull: [{ $arrayElemAt: ["$teacherStudentRatio.ratio", 0] }, 0],
          },
          studentCount: { $ifNull: [{ $arrayElemAt: ["$student.total", 0] }, 0] },
          activeStudentCount: { $ifNull: [{ $arrayElemAt: ["$activeStudent.total", 0] }, 0] },
          inactiveStudentCount: { $ifNull: [{ $arrayElemAt: ["$inactiveStudent.total", 0] }, 0] },
          studentGPA: { $ifNull: [{ $arrayElemAt: ["$studentGPA.averageGPA", 0] }, 0] },
        },
      },
    ]);

    return metrics[0];
  } catch (error) {
    return {
      fullTimeCount: 0,
      partTimeCount: 0,
      probationaryCount: 0,
      instructorCount: 0,
      teacherStudentRatio: 0,
      studentCount: 0,
      activeStudentCount: 0,
      inactiveStudentCount: 0,
      studentGPA: 0,
    };
  }
}

async function bulkCreate(data: Partial<IUser>[]): Promise<IUser[]> {
  const users = await User.insertMany(data, { ordered: true });
  return users;
}

function archiveUser(id: string): Promise<IUser | null> {
  return User.findByIdAndUpdate(
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
