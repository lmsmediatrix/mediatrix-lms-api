import { FilterQuery, UpdateQuery } from "mongoose";
import StudentAssessmentGrade, {
  IStudentAssessmentGrade,
} from "../models/studentAssessmentGradeModel";

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

const studentAssessmentGradeRepository = {
  getStudentAssessmentGrade,
  getStudentAssessmentGrades,
  createStudentAssessmentGrade,
  updateStudentAssessmentGrade,
  deleteStudentAssessmentGrade,
  searchStudentAssessmentGrade,
  searchAndUpdate,
  findOrCreate,
  getStudentAssessmentGradesCount,
  archiveStudentAssessmentGrade,
};

export default studentAssessmentGradeRepository;

function getStudentAssessmentGrade(
  id: string,
  dbParams: DbParams = {}
): Promise<IStudentAssessmentGrade | null> {
  let query = StudentAssessmentGrade.findById(id);

  if (!dbParams.query) {
    dbParams.query = {};
  }

  if (dbParams.query.includeArchived !== true) {
    query = query.where("archive.status").ne(true);

    (dbParams.options?.populateArray || []).forEach((populate) => {
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
    });
  } else {
    (dbParams.options?.populateArray || []).forEach((populate) => {
      query = query.populate(populate);
    });
  }

  const options = {
    select: dbParams.options?.select || "_id",
    lean: dbParams.options?.lean || true,
  };

  query = query.select(options.select).lean(options.lean);

  return query.exec();
}

function getStudentAssessmentGrades(dbParams: DbParams): Promise<IStudentAssessmentGrade[]> {
  let query = StudentAssessmentGrade.find(dbParams.query);

  if (!dbParams.query) {
    dbParams.query = {};
  }

  if (dbParams.query.includeArchived !== true) {
    query = query.where("archive.status").ne(true);

    (dbParams.options?.populateArray || []).forEach((populate) => {
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
    });
  } else {
    (dbParams.options?.populateArray || []).forEach((populate) => {
      query = query.populate(populate);
    });
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

function createStudentAssessmentGrade(
  data: Partial<IStudentAssessmentGrade>
): Promise<IStudentAssessmentGrade> {
  return StudentAssessmentGrade.create(data);
}

function updateStudentAssessmentGrade(
  data: Partial<IStudentAssessmentGrade>
): Promise<IStudentAssessmentGrade | null> {
  return StudentAssessmentGrade.findByIdAndUpdate(data._id, { $set: data }, { new: true });
}

function deleteStudentAssessmentGrade(id: string): Promise<IStudentAssessmentGrade | null> {
  return StudentAssessmentGrade.findByIdAndDelete(id);
}

function searchStudentAssessmentGrade(params: any = {}): Promise<IStudentAssessmentGrade[]> {
  const query = StudentAssessmentGrade.find();
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

async function archiveStudentAssessmentGrade(id: string): Promise<IStudentAssessmentGrade | null> {
  return StudentAssessmentGrade.findByIdAndUpdate(
    id,
    { $set: { "archive.status": true, "archive.date": new Date() } },
    { new: true }
  );
}

function getStudentAssessmentGradesCount(query: any): Promise<number> {
  return StudentAssessmentGrade.countDocuments(query);
}

async function searchAndUpdate(
  query: FilterQuery<IStudentAssessmentGrade>,
  update?: UpdateQuery<IStudentAssessmentGrade>,
  options?: { multi?: boolean }
): Promise<IStudentAssessmentGrade | null | { modifiedCount: number }> {
  if (!update) {
    return StudentAssessmentGrade.findOne(query);
  }

  if (options?.multi) {
    return StudentAssessmentGrade.updateMany(query, update).then((result) => ({
      modifiedCount: result.modifiedCount,
    }));
  }

  return StudentAssessmentGrade.findOneAndUpdate(query, update, { new: true });
}

async function findOrCreate(
  query: FilterQuery<IStudentAssessmentGrade>
): Promise<{ doc: IStudentAssessmentGrade; created: boolean }> {
  const existing = await StudentAssessmentGrade.findOne(query);
  if (existing) {
    return { doc: existing, created: false };
  }
  const created = await StudentAssessmentGrade.create(query);
  return { doc: created, created: true };
}
