import { config } from "../config/common";
import { NotificationModel } from "../models/notificationModel";
import notificationRepository from "../repository/notificationRepository";
import mongoose from "mongoose";
import sectionRepository from "../repository/sectionRepository";
import { NotificationCallback, NotificationTemplate, TemplateParams } from "../helper/interfaces";
import { generatePagination } from "../utils/paginationUtils";
import userRepository from "../repository/userRepository";

const notificationService = {
  getNotification,
  getNotifications,
  createNotification,
  updateNotification,
  deleteNotification,
  searchNotification,
  sendNotification,
  archiveNotification,
  markAsRead,
  markAllAsRead,
};

export default notificationService;

async function getNotification(id: string, params: any): Promise<NotificationModel | null> {
  if (!id) {
    throw new Error(config.ERROR.NOTIFICATION.NO_ID);
  }

  try {
    const dbParams: any = { query: {}, options: {} };

    if (params.populateArray) {
      dbParams.options.populateArray = params.populateArray;
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

    return await notificationRepository.getNotification(id, dbParams);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getNotifications(
  params: any,
  user: any
): Promise<{ notifications: NotificationModel[]; pagination: any; count?: number }> {
  if (!params) {
    throw new Error(config.ERROR.NOTIFICATION.INVALID_PARAMETER);
  }

  try {
    const dbParams: any = {
      query: {},
      options: {},
    };

    if (params.status === "read") {
      dbParams.query = {
        "recipients.read.user": user.id,
        "recipients.unread.user": { $ne: user.id },
      };
    } else if (params.status === "unread") {
      dbParams.query = {
        "recipients.unread.user": user.id,
        "recipients.read.user": { $ne: user.id },
      };
    }

    if (params.queryArray) {
      const queryArrayObj: { [key: string]: any } = {};
      queryArrayObj[params.queryArrayType] = params.queryArray;
      dbParams.query = { ...dbParams.query, ...queryArrayObj };
    }

    if (params.populateArray) {
      dbParams.options.populateArray = params.populateArray;
    }

    if (params.sort) {
      dbParams.options.sort = params.sort;
    }
    const limit = params.limit || 10;
    const skip = params.skip || 0;
    dbParams.options.limit = limit;
    dbParams.options.skip = skip * limit;
    if (params.select) {
      if (!Array.isArray(params.select)) {
        params.select = [params.select];
      }
      dbParams.options.select = params.select.join(" ");
    }
    if (params.lean !== undefined) {
      dbParams.options.lean = params.lean;
    }

    const page = params.page || 1;

    const [notifications, count] = await Promise.all([
      notificationRepository.getNotifications(dbParams),
      notificationRepository.getNotificationsCount(dbParams.query),
    ]);

    const pagination = generatePagination(count, page, limit);

    return {
      ...(params.document && { notifications }),
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

async function createNotification(data: Partial<NotificationModel>): Promise<NotificationModel> {
  if (!data) {
    throw new Error(config.ERROR.NOTIFICATION.REQUIRED_FIELDS);
  }

  try {
    if (!data.recipients) {
      data.recipients = {
        read: [],
        unread: [],
      };
    }
    return await notificationRepository.createNotification(data);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function updateNotification(
  data: Partial<NotificationModel>
): Promise<NotificationModel | null> {
  if (!data._id) {
    throw new Error(config.ERROR.NOTIFICATION.NO_ID);
  }

  try {
    return await notificationRepository.updateNotification(data);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function deleteNotification(id: string): Promise<NotificationModel | null> {
  if (!id) {
    throw new Error(config.ERROR.NOTIFICATION.NO_ID);
  }

  try {
    return await notificationRepository.deleteNotification(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function searchNotification(params: any): Promise<any> {
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

    const userFilter =
      params.status === "read"
        ? {
            "recipients.read.user": params.userId,
            "recipients.unread.user": { $ne: params.userId },
          }
        : params.status === "unread"
          ? {
              "recipients.unread.user": params.userId,
              "recipients.read.user": { $ne: params.userId },
            }
          : {
              $or: [
                { "recipients.read.user": params.userId },
                { "recipients.unread.user": params.userId },
              ],
            };

    const clientQuery = params.query || {};
    if (clientQuery.$or && userFilter.$or) {
      dbParams.query = { $and: [userFilter, { $or: clientQuery.$or }] };
    } else if (Object.keys(clientQuery).length > 0) {
      dbParams.query = { ...userFilter, ...clientQuery };
    } else {
      dbParams.query = userFilter;
    }

    if (params.archivedOnly === true) {
      dbParams.query["archive.status"] = true;
      dbParams.includeArchived = true;
    }

    if (params.match) {
      dbParams.query = { ...dbParams.query, ...params.match };
    }

    if (params.populateArray) {
      dbParams["populateArray"] = params.populateArray;
    }

    const optionsObj = {
      sort: params.sort || "-createdAt",
      skip: params.skip * params.limit || 0,
      select: params.select || "_id",
      limit: params.limit || 10,
    };

    dbParams.options = optionsObj;
    dbParams.lean = params.lean ?? true;
    const skip = params.skip || 0;
    const [notifications, count] = await Promise.all([
      notificationRepository.searchNotification(dbParams),
      params.pagination || params.count
        ? notificationRepository.getNotificationsCount(dbParams.query)
        : Promise.resolve(0),
    ]);

    if (!params.pagination) {
      return params.count ? { notifications, count } : notifications;
    }

    const pagination = generatePagination(count, skip + 1, optionsObj.limit);
    return {
      ...(params.document && { notifications }),
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

async function sendNotification(data: {
  query: Record<string, any>;
  sectionId: string;
  notification: {
    category: string;
    source: mongoose.Types.ObjectId;
    recipients: {
      read: Array<{
        user: mongoose.Types.ObjectId;
        date: Date | null;
      }>;
      unread: Array<{
        user: mongoose.Types.ObjectId;
        date: Date | null;
      }>;
    };
    metadata?: (params: any) => Record<string, unknown>;
  };
  message?: NotificationCallback;
  template?: NotificationTemplate;
  type?: "student" | "instructor";
}): Promise<NotificationModel> {
  if (!data) {
    throw new Error(config.ERROR.NOTIFICATION.REQUIRED_FIELDS);
  }

  try {
    const section = await sectionRepository.getSection(data.sectionId, {
      options: {
        select: "_id instructor students name code",
        populateArray: [
          { path: "instructor", select: "_id firstName lastName" },
          { path: "students", select: "_id firstName lastName" },
        ],
        lean: true,
      },
    });

    if (!section) {
      throw new Error("Section not found");
    }

    const users = await userRepository.searchUser({
      query: data.query,
      options: {
        select: "_id firstName lastName",
        lean: true,
      },
    });

    const notificationData: Partial<NotificationModel> = {
      ...data.notification,
      title:
        typeof data.template?.title === "function"
          ? data.template.title({
              sender: section.instructor as unknown as TemplateParams["sender"],
              recipient: users[0] as unknown as TemplateParams["recipient"],
              section: section as unknown as TemplateParams["section"],
            })
          : data.template?.title || "",
      description: data.message
        ? data.message({
            sender: section.instructor as unknown as TemplateParams["sender"],
            recipient: users[0] as unknown as TemplateParams["recipient"],
            section: section as unknown as TemplateParams["section"],
          }).description
        : typeof data.template?.description === "function"
          ? data.template.description({
              sender: section.instructor as unknown as TemplateParams["sender"],
              recipient: users[0] as unknown as TemplateParams["recipient"],
              section: section as unknown as TemplateParams["section"],
            })
          : "",
      metadata: data.notification.metadata
        ? data.notification.metadata({
            sender: section.instructor as unknown as TemplateParams["sender"],
            recipient: users[0] as unknown as TemplateParams["recipient"],
            section: section as unknown as TemplateParams["section"],
          })
        : undefined,
      recipients: {
        read: [],
        unread: users.map((user) => ({
          user: user._id,
          date: null,
        })),
      },
    };

    return await createNotification(notificationData);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function archiveNotification(id: string): Promise<NotificationModel | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.COURSE.INVALID_PARAMETER.REMOVE);
  }

  try {
    const notification = await notificationRepository.getNotification(id, {});
    if (!notification) {
      return null;
    }

    return await notificationRepository.archiveNotification(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function markAsRead(
  notificationId: string,
  userId: string
): Promise<NotificationModel | null> {
  try {
    const notification = await notificationRepository.getNotification(notificationId, {
      options: {
        select: "recipients",
        lean: false,
      },
    });
    if (!notification) {
      throw new Error("Notification not found");
    }

    notification.recipients.unread = notification.recipients.unread.filter(
      (item) => item.user.toString() !== userId
    );

    const isAlreadyRead = notification.recipients.read.some(
      (item) => item.user.toString() === userId
    );
    if (!isAlreadyRead) {
      notification.recipients.read.push({
        user: new mongoose.Types.ObjectId(userId),
        date: new Date(),
      });
    }

    return await notificationRepository.updateNotification(notification);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function markAllAsRead(userId: string): Promise<NotificationModel[]> {
  try {
    const notifications = await notificationRepository.getNotifications({
      query: {
        "recipients.unread.user": userId,
      },
      options: {
        select: "recipients",
        lean: false,
      },
    });

    const updatedNotifications = await Promise.all(
      notifications.map(async (notification) => {
        notification.recipients.unread = notification.recipients.unread.filter(
          (item) => item.user.toString() !== userId
        );

        const isAlreadyRead = notification.recipients.read.some(
          (item) => item.user.toString() === userId
        );
        if (!isAlreadyRead) {
          notification.recipients.read.push({
            user: new mongoose.Types.ObjectId(userId),
            date: new Date(),
          });
        }

        return await notificationRepository.updateNotification(notification);
      })
    );
    return updatedNotifications.filter(
      (notification): notification is NotificationModel => notification !== null
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}
