import express, { Request, Response } from "express";
import { API_ENDPOINTS } from "../config/endpointsConfig";
import notificationService from "../services/notificationService";
import { handleZodError } from "../middleware/zodErrorHandler";
import { ValidationSchemas } from "../helper/validationSchemas";
import { CustomRequest } from "../type/types";
import activityLogService from "../services/activityLogService";
import auditLogService from "../services/auditLogService";
import mongoose from "mongoose";
import { ACTION, config, USER_ROLES } from "../config/common";
import { validatePermissions } from "../middleware/rabcMiddleware";
import { z } from "zod";
import { NotificationSchema } from "../models/notificationModel";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Notification management endpoints for handling user notifications, alerts, and system messages
 */

/**
 * @swagger
 * /api/notification/get/all:
 *   get:
 *     summary: Get all notifications with filtering and pagination
 *     description: Retrieve a list of all notifications with support for filtering, sorting, pagination, and field selection
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: object
 *         description: Query parameters for filtering notifications (e.g., status, category, date)
 *       - in: query
 *         name: queryArray
 *         schema:
 *           type: array
 *         description: Array of query parameters for complex filtering
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: Fields to populate (e.g., sender, recipients)
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort criteria (e.g., "createdAt:-1" for newest first)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of records to return per page
 *       - in: query
 *         name: select
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Fields to select in the response
 *       - in: query
 *         name: count
 *         schema:
 *           type: boolean
 *         description: Whether to return total count of records
 *       - in: query
 *         name: pagination
 *         schema:
 *           type: boolean
 *         description: Whether to return pagination information
 *     responses:
 *       200:
 *         description: List of notifications retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Notifications retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     page:
 *                       type: number
 *                     limit:
 *                       type: number
 *                 count:
 *                   type: number
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.NOTIFICATION.GET_ALL,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN],
    ACTION.GET_ALL
  ),
  getNotifications
);

/**
 * @swagger
 * /api/notification/get/{id}:
 *   get:
 *     summary: Get notification by ID with detailed information
 *     description: Retrieve detailed information about a specific notification by its ID
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: Fields to populate (e.g., sender, recipients)
 *       - in: query
 *         name: select
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Fields to select in the response
 *     responses:
 *       200:
 *         description: Notification retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Notification retrieved successfully
 *                 data:
 *                   $ref: '#/components/schemas/Notification'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Notification not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.NOTIFICATION.GET_BY_ID,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN],
    ACTION.GET_BY_ID
  ),
  getNotification
);

/**
 * @swagger
 * /api/notification/update:
 *   put:
 *     summary: Update notification details
 *     description: Update notification properties including title, description, category, and status
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - _id
 *             properties:
 *               _id:
 *                 type: string
 *                 description: Notification ID
 *                 example: "60d21b4667d0d8992e610c85"
 *               title:
 *                 type: string
 *                 description: Notification title
 *                 example: "New Course Assignment"
 *               description:
 *                 type: string
 *                 description: Notification description
 *                 example: "A new assignment has been posted in your course"
 *               category:
 *                 type: string
 *                 description: Notification category
 *                 example: "COURSE"
 *               status:
 *                 type: string
 *                 enum: [Unread, Read, Archived]
 *                 description: Notification status
 *                 example: "Read"
 *               metadata:
 *                 type: object
 *                 description: Additional notification metadata
 *                 example: { "courseId": "123", "assignmentId": "456" }
 *     responses:
 *       200:
 *         description: Notification updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Notification updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/Notification'
 *       400:
 *         description: Invalid input - Missing required fields or invalid data
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Notification not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.NOTIFICATION.UPDATE,
  validatePermissions([USER_ROLES.ADMIN], ACTION.UPDATE),
  updateNotification
);

/**
 * @swagger
 * /api/notification/mark-read/{id}:
 *   post:
 *     summary: Mark notification(s) as read
 *     description: Mark a specific notification or all notifications as read for the current user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID or 'all' to mark all notifications as read
 *     responses:
 *       200:
 *         description: Notification(s) marked as read successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Notification marked as read
 *                 data:
 *                   $ref: '#/components/schemas/Notification'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Notification not found
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.NOTIFICATION.MARK_READ,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.UPDATE),
  markAsRead
);

/**
 * @swagger
 * /api/notification/search:
 *   post:
 *     summary: Search notifications with custom criteria
 *     description: Search for notifications using custom search criteria and filters
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: object
 *                 description: Search criteria (e.g., title, category, date range)
 *                 example: { "category": "COURSE", "status": "Unread" }
 *     responses:
 *       200:
 *         description: List of notifications matching search criteria
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Notification'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.NOTIFICATION.SEARCH,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.SEARCH),
  searchNotifications
);

/**
 * @swagger
 * /api/notification/archive/{id}:
 *   put:
 *     summary: Archive a notification (soft delete)
 *     description: Archive a notification instead of permanent deletion, making it inaccessible but preserving data
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID to archive
 *     responses:
 *       200:
 *         description: Notification archived successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Notification archived successfully
 *                 data:
 *                   $ref: '#/components/schemas/Notification'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Notification not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.NOTIFICATION.ARCHIVE,
  validatePermissions(
    [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN, USER_ROLES.INSTRUCTOR],
    ACTION.ARCHIVE
  ),
  archiveNotification
);

export default router;

async function getNotifications(req: CustomRequest, res: Response) {
  try {
    const params = ValidationSchemas.getQueriesParams.parse({
      query: req.query.query || {},
      queryArray: req.query.queryArray,
      queryArrayType: req.query.queryArrayType,
      populateArray: req.query.populateArray ? JSON.parse(req.query.populateArray as string) : [],
      sort: req.query.sort,
      limit: req.query.limit,
      skip: req.query.skip,
      select: Array.isArray(req.query.select)
        ? req.query.select
        : [req.query.select].filter(Boolean),
      lean: req.query.lean,
      count: req.query.count === "true",
      document: req.query.document === "true",
      pagination: req.query.pagination === "true",
      status: req.query.status,
    });

    const { notifications, pagination, count } = await notificationService.getNotifications(
      params,
      req.user
    );

    if (req.user) {
      await activityLogService.createActivityLog({
        userId: new mongoose.Types.ObjectId((req as any).user.id),
        headers: {
          "user-agent": req.get("user-agent"),
        },
        ip: req.ip || "0.0.0.0",
        path: req.path,
        method: req.method,
        page: {
          url: req.originalUrl,
          title: "Notification Management - View All Notifications",
        },
        action: "read",
        description: `Retrieved ${Array.isArray(notifications) ? notifications.length : 0} notifications${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "notification",
        createdAt: new Date(),
      });
    }

    res.status(200).json({
      message: "Notifications retrieved successfully",
      data: notifications,
      pagination,
      count,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

async function getNotification(req: Request, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });
    const params = ValidationSchemas.getQueryParams.parse({
      populateArray: req.query.populateArray ? JSON.parse(req.query.populateArray as string) : [],
      select: Array.isArray(req.query.select)
        ? req.query.select
        : [req.query.select].filter(Boolean),
      lean: req.query.lean,
    });

    const notification = await notificationService.getNotification(id, params);

    if ((req as any).user) {
      await activityLogService.createActivityLog({
        userId: new mongoose.Types.ObjectId((req as any).user.id),
        headers: {
          "user-agent": req.get("user-agent"),
        },
        ip: req.ip || "0.0.0.0",
        path: req.path,
        method: req.method,
        page: {
          url: req.originalUrl,
          title: "Notification Management - View Notification Details",
        },
        action: "read",
        description: `Viewed notification details for ${notification?.title || id}${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "notification",
        createdAt: new Date(),
      });
    }

    res.status(200).json(notification);
  } catch (error) {
    handleZodError(error, res);
  }
}

async function markAsRead(req: CustomRequest, res: Response) {
  try {
    if (!req.user) throw new Error("User not found");

    const { id } = ValidationSchemas.idParam.parse(req.body);
    let updatedNotifications;
    if (id === "all") {
      updatedNotifications = await notificationService.markAllAsRead(req.user.id.toString());
      if (!updatedNotifications.length) {
        return res.status(200).json({ message: "No unread notifications found" });
      }
    } else {
      const updatedNotification = await notificationService.markAsRead(
        id.toString(),
        req.user.id.toString()
      );
      if (!updatedNotification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      updatedNotifications = [updatedNotification];
    }

    await activityLogService.createActivityLog({
      userId: new mongoose.Types.ObjectId(req.user.id),
      headers: {
        "user-agent": req.get("user-agent"),
      },
      ip: req.ip || "0.0.0.0",
      path: req.path,
      method: req.method,
      page: {
        url: req.originalUrl,
        title: "Notification Management - Mark Notifications as Read",
      },
      action: "update",
      description: `Marked ${id === "all" ? `all notifications as read (${Array.isArray(updatedNotifications) ? updatedNotifications.length : 0} notifications)` : `notification as read: ${updatedNotifications[0]?.title || updatedNotifications[0]?._id || id}`}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      entityType: "notification",
      createdAt: new Date(),
    });

    res.status(200).json({
      message: id === "all" ? "All notifications marked as read" : "Notification marked as read",
      data: id === "all" ? updatedNotifications : updatedNotifications[0],
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

async function searchNotifications(req: Request, res: Response) {
  try {
    if (!(req as any).user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const searchParams = {
      ...req.body,
      userId: (req as any).user.id,
    };

    const notifications = await notificationService.searchNotification(searchParams);

    if ((req as any).user) {
      const searchCriteria = Object.entries(req.body)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");

      await activityLogService.createActivityLog({
        userId: new mongoose.Types.ObjectId((req as any).user.id),
        headers: {
          "user-agent": req.get("user-agent"),
        },
        ip: req.ip || "0.0.0.0",
        path: req.path,
        method: req.method,
        page: {
          url: req.originalUrl,
          title: "Notification Management - Search Notifications",
        },
        action: "read",
        description: `Searched notifications with criteria: ${searchCriteria || "none"} (found ${Array.isArray(notifications) ? notifications.length : 0} results)`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "notification",
        createdAt: new Date(),
      });
    }

    res.status(200).json(notifications);
  } catch (error) {
    handleZodError(error, res);
  }
}

async function archiveNotification(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "User not authenticated or missing organization" });
    }

    const archivedNotification = await notificationService.archiveNotification(id);

    if (!archivedNotification) {
      return res.status(404).json({ message: "notification not found" });
    }

    await activityLogService.createActivityLog({
      userId: new mongoose.Types.ObjectId((req as any).user.id),
      headers: {
        "user-agent": req.get("user-agent"),
      },
      ip: req.ip || "0.0.0.0",
      path: req.path,
      method: req.method,
      page: {
        url: req.originalUrl,
        title: "Notification Management - Archive Notification",
      },
      action: "archive",
      description: `Archived notification: ${archivedNotification.title || archivedNotification._id || id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      entityType: "notification",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(req.user.id),
      type: "UPDATE",
      severity: "INFO",
      entity: {
        type: "NOTIFICATION",
        id: new mongoose.Types.ObjectId(id),
      },
      changes: {
        before: { archived: false },
        after: { archived: true, archivedDate: new Date() },
      },
      metadata: {
        userAgent: req.get("user-agent"),
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      description: `Archived notification with ID ${id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });

    res.status(200).json({
      message: config.SUCCESS.NOTIFICATION.ARCHIVE,
      data: archivedNotification,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

async function updateNotification(req: CustomRequest, res: Response) {
  try {
    if (!req.user) throw new Error("User not found");

    const validatedData = NotificationSchema.partial()
      .extend({ _id: z.string().min(1) })
      .parse(req.body);

    const currentNotification = await notificationService.getNotification(validatedData._id, {
      select: Object.keys(req.body).filter((key) => key !== "_id"),
    });

    if (!currentNotification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    const updatedNotification = await notificationService.updateNotification(validatedData);

    if (req.user) {
      await activityLogService.createActivityLog({
        userId: new mongoose.Types.ObjectId(req.user.id),
        headers: {
          "user-agent": req.get("user-agent"),
        },
        ip: req.ip || "0.0.0.0",
        path: req.path,
        method: req.method,
        page: {
          url: req.originalUrl,
          title: "Notification Management - Update Notification",
        },
        action: "update",
        description: `Updated notification: ${updatedNotification?.title || validatedData._id} with fields: ${Object.keys(
          req.body
        )
          .filter((key) => key !== "_id")
          .join(", ")}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "notification",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId(req.user.id),
        type: "UPDATE",
        severity: "INFO",
        entity: {
          type: "NOTIFICATION",
          id: new mongoose.Types.ObjectId(validatedData._id),
        },
        changes: {
          before: currentNotification || {},
          after: updatedNotification || {},
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Updated notification ${updatedNotification?.title || validatedData._id}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });
    }

    res.status(200).json({
      message: "Notification updated successfully",
      data: updatedNotification,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}
