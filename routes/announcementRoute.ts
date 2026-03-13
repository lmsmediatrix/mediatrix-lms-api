import express, { Request, Response } from "express";
import { API_ENDPOINTS } from "../config/endpointsConfig";
import announcementService from "../services/announcementService";
import { AnnouncementZodSchema } from "../models/announcementModel";
import { handleZodError } from "../middleware/zodErrorHandler";
import { ValidationSchemas } from "../helper/validationSchemas";
import { z } from "zod";
import { CustomRequest } from "../type/types";
import { ACTION, config, USER_ROLES } from "../config/common";
import { validatePermissions } from "../middleware/rabcMiddleware";
import activityLogService from "../services/activityLogService";
import auditLogService from "../services/auditLogService";
import mongoose from "mongoose";
import notificationService from "../services/notificationService";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Announcements
 *   description: Announcement management endpoints for creating, updating, and managing course announcements
 */

/**
 * @swagger
 * /api/announcement/get/all:
 *   get:
 *     summary: Get all announcements
 *     tags: [Announcements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: JSON string of query parameters
 *       - in: query
 *         name: queryArray
 *         schema:
 *           type: string
 *         description: Comma-separated list of query array parameters
 *       - in: query
 *         name: queryArrayType
 *         schema:
 *           type: string
 *         description: Comma-separated list of query array types
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: Space-separated list of fields to populate
 *       - in: query
 *         name: populateSelect
 *         schema:
 *           type: string
 *         description: Comma-separated list of fields to select for populated documents
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort criteria
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of records to return
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *         description: Number of records to skip
 *       - in: query
 *         name: select
 *         schema:
 *           type: string
 *         description: Comma-separated list of fields to select
 *       - in: query
 *         name: lean
 *         schema:
 *           type: boolean
 *         description: Whether to return plain JavaScript objects
 *       - in: query
 *         name: count
 *         schema:
 *           type: boolean
 *         description: Whether to return total count
 *       - in: query
 *         name: pagination
 *         schema:
 *           type: boolean
 *         description: Whether to return pagination information
 *       - in: query
 *         name: document
 *         schema:
 *           type: boolean
 *         description: Whether to return the document
 *     responses:
 *       200:
 *         description: List of announcements retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 announcements:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Announcement'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                 count:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.ANNOUNCEMENT.GET_ALL,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN],
    ACTION.GET_ALL
  ),
  getAnnouncements
);

/**
 * @swagger
 * /api/announcement/get/{id}:
 *   get:
 *     summary: Get announcement by ID
 *     tags: [Announcements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Announcement ID
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: Space-separated list of fields to populate
 *       - in: query
 *         name: populateSelect
 *         schema:
 *           type: string
 *         description: Comma-separated list of fields to select for populated documents
 *       - in: query
 *         name: select
 *         schema:
 *           type: string
 *         description: Comma-separated list of fields to select
 *       - in: query
 *         name: lean
 *         schema:
 *           type: boolean
 *         description: Whether to return plain JavaScript objects
 *     responses:
 *       200:
 *         description: Announcement retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Announcement'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Announcement not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.ANNOUNCEMENT.GET_BY_ID,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN],
    ACTION.GET_BY_ID
  ),
  getAnnouncement
);

/**
 * @swagger
 * /api/announcement/create:
 *   post:
 *     summary: Create a new announcement
 *     tags: [Announcements]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *                 description: Announcement title
 *               content:
 *                 type: string
 *                 description: Announcement content
 *               section:
 *                 type: string
 *                 description: Section ID
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 description: Announcement priority
 *               status:
 *                 type: string
 *                 enum: [draft, published, archived]
 *                 description: Announcement status
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of attachment URLs
 *     responses:
 *       200:
 *         description: Announcement created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Announcement'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.ANNOUNCEMENT.CREATE,
  validatePermissions(
    [USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN],
    ACTION.CREATE
  ),
  createAnnouncement
);

/**
 * @swagger
 * /api/announcement/update:
 *   put:
 *     summary: Update an announcement
 *     tags: [Announcements]
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
 *                 description: Announcement ID
 *               title:
 *                 type: string
 *                 description: Announcement title
 *               content:
 *                 type: string
 *                 description: Announcement content
 *               section:
 *                 type: string
 *                 description: Section ID
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 description: Announcement priority
 *               status:
 *                 type: string
 *                 enum: [draft, published, archived]
 *                 description: Announcement status
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of attachment URLs
 *     responses:
 *       200:
 *         description: Announcement updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Announcement'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Announcement not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.ANNOUNCEMENT.UPDATE,
  validatePermissions(
    [USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN],
    ACTION.UPDATE
  ),
  updateAnnouncement
);

/**
 * @swagger
 * /api/announcement/remove/{id}:
 *   delete:
 *     summary: Delete an announcement
 *     tags: [Announcements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Announcement ID
 *     responses:
 *       200:
 *         description: Announcement deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Announcement deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Announcement not found
 *       500:
 *         description: Server error
 */
router.delete(
  API_ENDPOINTS.ANNOUNCEMENT.REMOVE,
  validatePermissions(
    [USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN],
    ACTION.DELETE
  ),
  deleteAnnouncement
);

/**
 * @swagger
 * /api/announcement/search:
 *   post:
 *     summary: Search announcements with advanced filtering
 *     tags: [Announcements]
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
 *                 description: Search criteria object
 *                 properties:
 *                   title:
 *                     type: string
 *                     description: Search by announcement title
 *                   content:
 *                     type: string
 *                     description: Search by announcement content
 *                   section:
 *                     type: string
 *                     description: Filter by section ID
 *                   priority:
 *                     type: string
 *                     enum: [low, medium, high]
 *                     description: Filter by priority level
 *                   status:
 *                     type: string
 *                     enum: [draft, published, archived]
 *                     description: Filter by announcement status
 *                   createdAt:
 *                     type: object
 *                     description: Date range filter
 *                     properties:
 *                       $gte:
 *                         type: string
 *                         format: date-time
 *                       $lte:
 *                         type: string
 *                         format: date-time
 *               match:
 *                 type: object
 *                 description: Additional match criteria
 *               populateArray:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Fields to populate
 *               sort:
 *                 type: string
 *                 description: Sort criteria
 *               limit:
 *                 type: integer
 *                 description: Number of records to return
 *               skip:
 *                 type: integer
 *                 description: Number of records to skip
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Announcement'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.ANNOUNCEMENT.SEARCH,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN],
    ACTION.SEARCH
  ),
  searchAnnouncement
);

/**
 * @swagger
 * /api/announcement/archive/{id}:
 *   put:
 *     summary: Archive an announcement (soft delete)
 *     tags: [Announcements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Announcement ID to archive
 *     responses:
 *       200:
 *         description: Announcement archived successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Announcement archived successfully
 *                 data:
 *                   $ref: '#/components/schemas/Announcement'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Announcement not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.ANNOUNCEMENT.ARCHIVE,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.ARCHIVE),
  archiveAnnouncement
);

export default router;

export async function getAnnouncements(req: Request, res: Response) {
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
      pagination: req.query.pagination === "true",
      document: req.query.document === "true",
    });

    const { announcements, pagination, count } = await announcementService.getAnnouncements(params);

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
          title: "Announcements List",
        },
        action: "read",
        description: `Retrieved ${Array.isArray(announcements) ? announcements.length : 0} announcements${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "announcement",
        createdAt: new Date(),
      });
    }

    res.status(200).send({ announcements, pagination, count });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getAnnouncement(req: Request, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });
    const params = ValidationSchemas.getQueryParams.parse({
      populateArray: req.query.populateArray ? JSON.parse(req.query.populateArray as string) : [],
      select: Array.isArray(req.query.select)
        ? req.query.select
        : [req.query.select].filter(Boolean),
      lean: req.query.lean,
    });

    const announcement = await announcementService.getAnnouncement(id, params);

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
          title: `Announcement: ${announcement?.title || "Untitled"}`,
        },
        action: "read",
        description: `Viewed announcement: ${announcement?.title || id}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "announcement",
        createdAt: new Date(),
      });
    }

    res.status(200).send(announcement);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function createAnnouncement(req: CustomRequest, res: Response) {
  try {
    const user = req.user;
    if (!user || !user.id) {
      throw new Error("User information is missing or invalid.");
    }
    const validatedData = AnnouncementZodSchema.partial().parse(req.body);
    const newAnnouncement = await announcementService.createAnnouncement(validatedData, user);

    res.status(200).send(newAnnouncement);
    if (newAnnouncement && newAnnouncement.scopeId) {
      const section = await announcementService.getAnnouncement(newAnnouncement._id.toString(), {
        populateArray: [
          {
            path: "scopeId",
            select: "_id students",
            populate: { path: "students", select: "_id" },
          },
        ],
      });
      // scopeId may be an ObjectId or a populated Section document; guard accordingly
      const scope = section?.scopeId as unknown;
      const students =
        scope &&
        typeof scope === "object" &&
        "students" in (scope as any) &&
        Array.isArray((scope as any).students)
          ? (scope as any).students
          : [];
      if (students.length > 0) {
        await notificationService.sendNotification({
          query: { _id: { $in: students.map((student: any) => student._id) } },
          sectionId: newAnnouncement.scopeId.toString(),
          notification: {
            category: "ANNOUNCEMENT",
            source: new mongoose.Types.ObjectId(user.id),
            recipients: {
              read: [],
              unread: [],
            },
            metadata: ({ section }) => ({
              path: `/student/sections/${section.code}?tab=announcements&id=${newAnnouncement._id}`,
              announcement: {
                title: newAnnouncement.title,
              },
            }),
          },
          template: {
            title: ({ section: _section }) =>
              `A new announcement has been added to ${_section.name}`,
            description: ({ sender }) =>
              `${sender.firstName} has added a new announcement: "${newAnnouncement.title}"`,
          },
          type: "student",
        });
      }
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
        title: `Create Announcement: ${newAnnouncement.title || "Untitled"}`,
      },
      action: "create",
      description: `Created new announcement: ${newAnnouncement.title || "Untitled"}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      entityType: "announcement",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(user.id),
      type: "CREATE",
      severity: "INFO",
      entity: {
        type: "ANNOUNCEMENT",
        id: newAnnouncement._id,
      },
      changes: {
        before: {},
        after: validatedData,
      },
      metadata: {
        userAgent: req.get("user-agent"),
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      description: `Created new announcement ${newAnnouncement.title || "Untitled"}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function updateAnnouncement(req: CustomRequest, res: Response) {
  try {
    if (!req.user) throw new Error("User not found");

    const validatedData = AnnouncementZodSchema.partial()
      .extend({ _id: z.string().min(1) })
      .parse(req.body);

    const currentAnnouncement = await announcementService.getAnnouncement(validatedData._id, {
      select: Object.keys(req.body).filter((key) => key !== "_id"),
    });

    const updatedAnnouncement = await announcementService.updateAnnouncement(validatedData);

    res.status(200).send(updatedAnnouncement);

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
        title: `Update Announcement: ${updatedAnnouncement?.title || "Untitled"}`,
      },
      action: "update",
      description: `Updated announcement: ${updatedAnnouncement?.title || validatedData._id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      entityType: "announcement",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(req.user.id),
      type: "UPDATE",
      severity: "INFO",
      entity: {
        type: "ANNOUNCEMENT",
        id: new mongoose.Types.ObjectId(validatedData._id),
      },
      changes: {
        before: currentAnnouncement || {},
        after: updatedAnnouncement || {},
      },
      metadata: {
        userAgent: req.get("user-agent"),
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      description: `Updated announcement ${updatedAnnouncement?.title || validatedData._id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function deleteAnnouncement(req: Request, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });
    const deleteAnnouncement = await announcementService.deleteAnnouncement(id);

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
          title: `Delete Announcement: ${deleteAnnouncement?.title || "Untitled"}`,
        },
        action: "delete",
        description: `Deleted announcement: ${deleteAnnouncement?.title || id}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "announcement",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId((req as any).user.id),
        type: "DELETE",
        severity: "INFO",
        entity: {
          type: "ANNOUNCEMENT",
          id: new mongoose.Types.ObjectId(id),
        },
        changes: {
          before: deleteAnnouncement ?? {},
          after: {},
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Deleted announcement: ${deleteAnnouncement?.title || id}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });
    }

    res.status(200).send(deleteAnnouncement);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function searchAnnouncement(req: Request, res: Response) {
  try {
    const searchAnnouncement = await announcementService.searchAnnouncement(req.body);

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
          title: "Search Announcements",
        },
        action: "search",
        description: `Announcement search performed${Object.keys(req.body).length ? ` with criteria: custom filter` : ""} (found ${searchAnnouncement?.length || 0} results)`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "announcement",
        createdAt: new Date(),
      });
    }

    res.status(200).send(searchAnnouncement);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function archiveAnnouncement(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "User not authenticated or missing organization" });
    }

    const archivedAnnouncement = await announcementService.archiveAnnouncement(id);

    if (!archivedAnnouncement) {
      return res.status(404).json({ message: "Announcement not found" });
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
        title: `Archive Announcement: ${archivedAnnouncement.title || "Untitled"}`,
      },
      action: "archive",
      description: `Archived announcement: ${archivedAnnouncement.title || id}`,
      organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
      entityType: "announcement",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(req.user.id),
      type: "UPDATE",
      severity: "INFO",
      entity: {
        type: "ANNOUNCEMENT",
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
      description: `Archived announcement: ${archivedAnnouncement.title || id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });

    res.status(200).json({
      message: config.SUCCESS.ANNOUNCEMENT.ARCHIVE,
      data: archivedAnnouncement,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}
