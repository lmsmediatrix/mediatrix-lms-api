import { FilterQuery, UpdateQuery } from "mongoose";
import Notification, { NotificationModel } from "../models/notificationModel";

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

const notificationRepository = {
  getNotification,
  getNotifications,
  createNotification,
  updateNotification,
  deleteNotification,
  searchNotification,
  searchAndUpdate,
  insertMany,
  getNotificationsCount,
  archiveNotification,
};

export default notificationRepository;

function getNotification(id: string, dbParams: DbParams = {}): Promise<NotificationModel | null> {
  let query = Notification.findById(id);

  (dbParams.options?.populateArray || []).forEach((populate) => {
    query = query.populate(populate);
  });

  const options = {
    select: dbParams.options?.select || "_id",
    lean: dbParams.options?.lean || true,
  };

  query = query.select(options.select).lean(options.lean);

  return query.exec();
}

function getNotifications(dbParams: DbParams): Promise<NotificationModel[]> {
  let query = Notification.find(dbParams.query);

  (dbParams.options?.populateArray || []).forEach((populate) => {
    query = query.populate(populate);
  });

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

function createNotification(data: Partial<NotificationModel>): Promise<NotificationModel> {
  return Notification.create(data);
}

function updateNotification(data: Partial<NotificationModel>): Promise<NotificationModel | null> {
  return Notification.findByIdAndUpdate(data._id, data, { new: true });
}

function deleteNotification(id: string): Promise<NotificationModel | null> {
  return Notification.findByIdAndDelete(id);
}

function searchNotification(params: any = {}): Promise<NotificationModel[]> {
  const query = Notification.find();
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
  query: FilterQuery<NotificationModel>,
  update?: UpdateQuery<NotificationModel>,
  options?: { multi?: boolean }
): Promise<NotificationModel | null | { modifiedCount: number }> {
  if (!update) {
    return Notification.findOne(query);
  }

  if (options?.multi) {
    const result = await Notification.updateMany(query, update);
    return { modifiedCount: result.modifiedCount };
  }

  return Notification.findOneAndUpdate(query, update, { new: true });
}

async function insertMany(data: Partial<NotificationModel>[]): Promise<any> {
  return Notification.insertMany(data, { ordered: false });
}

function getNotificationsCount(query: any): Promise<number> {
  return Notification.countDocuments(query).exec();
}
function archiveNotification(id: string): Promise<NotificationModel | null> {
  return Notification.findByIdAndUpdate(
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
