import { FilterQuery, UpdateQuery } from "mongoose";
import Announcement, { IAnnouncement } from "../models/announcementModel";
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

const announcementRepository = {
  getAnnouncement,
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  searchAnnouncement,
  searchAndUpdate,
  findOrCreate,
  announcementsCount,
  archiveAnnouncement,
};

export default announcementRepository;

function getAnnouncement(id: string, dbParams: DbParams = {}): Promise<IAnnouncement | null> {
  let query = Announcement.findById(id);

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

function getAnnouncements(dbParams: DbParams): Promise<IAnnouncement[]> {
  let query = Announcement.find(dbParams.query);

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

function createAnnouncement(data: Partial<IAnnouncement>): Promise<IAnnouncement> {
  return Announcement.create(data);
}

function updateAnnouncement(data: Partial<IAnnouncement>): Promise<IAnnouncement | null> {
  return Announcement.findByIdAndUpdate(data._id, { $set: data }, { new: true });
}

function deleteAnnouncement(id: string): Promise<IAnnouncement | null> {
  return Announcement.findByIdAndDelete(id);
}

function searchAnnouncement(params: any = {}): Promise<IAnnouncement[]> {
  const query = Announcement.find();
  query.setQuery(params.query);
  query.populate(params.populateArray);
  query.projection(params.projection);
  query.setOptions(params.options);
  query.lean(params.lean);

  if (params.match) {
    query.where(params.match);
  }
  return query.exec();
}

async function searchAndUpdate(
  query: FilterQuery<IAnnouncement>,
  update?: UpdateQuery<IAnnouncement>,
  options?: { multi?: boolean }
): Promise<IAnnouncement | null | { modifiedCount: number }> {
  if (!update) {
    return Announcement.findOne(query);
  }

  if (options?.multi) {
    const result = await Announcement.updateMany(query, update);
    return { modifiedCount: result.modifiedCount };
  }

  return Announcement.findOneAndUpdate(query, update, { new: true });
}

async function findOrCreate(query: any): Promise<IAnnouncement | null> {
  return await Announcement.findOne(query).lean();
}

async function announcementsCount(query: any): Promise<number> {
  return await Announcement.countDocuments(query);
}

function archiveAnnouncement(id: string): Promise<IAnnouncement | null> {
  return Announcement.findByIdAndUpdate(
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
