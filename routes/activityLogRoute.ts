import express, { Response } from "express";
import { API_ENDPOINTS } from "../config/endpointsConfig";
import activityLogService from "../services/activityLogService";
import auditLogService from "../services/auditLogService";
import { handleZodError } from "../middleware/zodErrorHandler";
import { ACTION, config, USER_ROLES } from "../config/common";
import { ValidationSchemas } from "../helper/validationSchemas";
import mongoose from "mongoose";
import { CustomRequest } from "../type/types";
import { z } from "zod";
import { IActivityLogging } from "../models/activityLogModel";
import { sendCSVResponse } from "../utils/csvUtils/csvResponse";
import { validatePermissions } from "../middleware/rabcMiddleware";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Activity Logs
 *   description: Activity log management endpoints
 */

/**
 * @swagger
 * /api/activity-log/get/all:
 *   get:
 *     summary: Get all activity logs
 *     tags: [Activity Logs]
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
 *         name: document
 *         schema:
 *           type: boolean
 *         description: Whether to return the document
 *     responses:
 *       200:
 *         description: List of activity logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 activityLogs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ActivityLog'
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
  API_ENDPOINTS.ACTIVITY_LOG.GET_ALL,
  validatePermissions([USER_ROLES.SUPERADMIN], ACTION.GET_ALL),
  getActivityLogs
);

/**
 * @swagger
 * /api/activity-log/get/{id}:
 *   get:
 *     summary: Get activity log by ID
 *     tags: [Activity Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Activity log ID
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
 *         description: Activity log retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActivityLog'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Activity log not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.ACTIVITY_LOG.GET_BY_ID,
  validatePermissions([USER_ROLES.SUPERADMIN], ACTION.GET_BY_ID),
  getActivityLog
);

/**
 * @swagger
 * /api/activity-log/create:
 *   post:
 *     summary: Create a new activity log
 *     tags: [Activity Logs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - action
 *               - description
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID who performed the action
 *               headers:
 *                 type: object
 *                 properties:
 *                   user-agent:
 *                     type: string
 *                     description: User agent string
 *               ip:
 *                 type: string
 *                 description: IP address
 *               path:
 *                 type: string
 *                 description: Request path
 *               method:
 *                 type: string
 *                 description: HTTP method
 *               page:
 *                 type: object
 *                 properties:
 *                   url:
 *                     type: string
 *                     description: Page URL
 *                   title:
 *                     type: string
 *                     description: Page title
 *               action:
 *                 type: string
 *                 enum: [create, read, update, delete, search]
 *                 description: Activity action
 *               description:
 *                 type: string
 *                 description: Activity description
 *               organizationId:
 *                 type: string
 *                 description: Organization ID
 *               entityType:
 *                 type: string
 *                 description: Entity type
 *               createdAt:
 *                 type: string
 *                 format: date-time
 *                 description: Creation timestamp
 *     responses:
 *       201:
 *         description: Activity log created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActivityLog'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.ACTIVITY_LOG.CREATE,
  validatePermissions([USER_ROLES.SUPERADMIN], ACTION.CREATE),
  createActivityLog
);

/**
 * @swagger
 * /api/activity-log/update:
 *   put:
 *     summary: Update an activity log
 *     tags: [Activity Logs]
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
 *                 description: Activity log ID
 *               user:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     description: User ID
 *               headers:
 *                 type: object
 *                 properties:
 *                   user-agent:
 *                     type: string
 *                     description: User agent string
 *               ip:
 *                 type: string
 *                 description: IP address
 *               path:
 *                 type: string
 *                 description: Request path
 *               method:
 *                 type: string
 *                 description: HTTP method
 *               page:
 *                 type: object
 *                 properties:
 *                   url:
 *                     type: string
 *                     description: Page URL
 *                   title:
 *                     type: string
 *                     description: Page title
 *               action:
 *                 type: string
 *                 enum: [create, read, update, delete, search]
 *                 description: Activity action
 *               description:
 *                 type: string
 *                 description: Activity description
 *               organizationId:
 *                 type: string
 *                 description: Organization ID
 *               entityType:
 *                 type: string
 *                 description: Entity type
 *     responses:
 *       200:
 *         description: Activity log updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActivityLog'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Activity log not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.ACTIVITY_LOG.UPDATE,
  validatePermissions([USER_ROLES.SUPERADMIN], ACTION.UPDATE),
  updateActivityLog
);

/**
 * @swagger
 * /api/activity-log/delete/{id}:
 *   delete:
 *     summary: Delete an activity log
 *     tags: [Activity Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Activity log ID
 *     responses:
 *       200:
 *         description: Activity log deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Activity log deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Activity log not found
 *       500:
 *         description: Server error
 */
router.delete(
  API_ENDPOINTS.ACTIVITY_LOG.DELETE,
  validatePermissions([USER_ROLES.SUPERADMIN], ACTION.DELETE),
  deleteActivityLog
);

/**
 * @swagger
 * /api/activity-log/search:
 *   post:
 *     summary: Search activity logs
 *     tags: [Activity Logs]
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
 *                   userId:
 *                     type: string
 *                     description: Filter by user ID
 *                   action:
 *                     type: string
 *                     enum: [create, read, update, delete, search]
 *                     description: Filter by action type
 *                   entityType:
 *                     type: string
 *                     description: Filter by entity type
 *                   organizationId:
 *                     type: string
 *                     description: Filter by organization ID
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
 *                 $ref: '#/components/schemas/ActivityLog'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.ACTIVITY_LOG.SEARCH,
  validatePermissions([USER_ROLES.SUPERADMIN], ACTION.SEARCH),
  searchActivityLog
);

/**
 * @swagger
 * /api/activity-log/export:
 *   post:
 *     summary: Export activity logs to CSV
 *     tags: [Activity Logs]
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
 *                 description: Filter criteria
 *                 properties:
 *                   userId:
 *                     type: string
 *                     description: Filter by user ID
 *                   action:
 *                     type: string
 *                     enum: [create, read, update, delete, search]
 *                     description: Filter by action type
 *                   entityType:
 *                     type: string
 *                     description: Filter by entity type
 *                   organizationId:
 *                     type: string
 *                     description: Filter by organization ID
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
 *         description: CSV file containing activity logs
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *             example: |
 *               User ID,IP Address,Path,Method,Action,Description,Organization ID,Entity Type,Created At,User Agent
 *               123,192.168.1.1,/api/users,GET,read,Viewed user list,456,user,2024-03-20T10:00:00Z,Mozilla/5.0
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.ACTIVITY_LOG.EXPORT,
  validatePermissions([USER_ROLES.SUPERADMIN], ACTION.CUSTOM),
  exportActivityLog
);

export default router;

export async function getActivityLogs(req: CustomRequest, res: Response) {
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

    const { activityLogs, pagination, count } = await activityLogService.getActivityLogs(params);

    res.status(200).send({ activityLogs, pagination, count });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getActivityLog(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });
    const params = ValidationSchemas.getQueryParams.parse({
      populateArray: req.query.populateArray ? JSON.parse(req.query.populateArray as string) : [],
      select: Array.isArray(req.query.select)
        ? req.query.select
        : [req.query.select].filter(Boolean),
      lean: req.query.lean,
    });

    const activityLog = await activityLogService.getActivityLog(id, params);
    if (!activityLog) {
      res.status(404).json({ error: config.RESPONSE.ERROR.ACTIVITY_LOG.NOT_FOUND });
      return;
    }

    res.status(200).send(activityLog);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function createActivityLog(req: CustomRequest, res: Response) {
  try {
    const activityLog = await activityLogService.createActivityLog(req.body);

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
          title: "",
        },
        action: "create",
        description: `Created a new activity log with ID: ${activityLog._id}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "activity_log",
        createdAt: new Date(),
      });
      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId(req.user.id),
        type: "CREATE",
        severity: "INFO",
        entity: {
          type: "ACTIVITY_LOG",
          id: new mongoose.Types.ObjectId(activityLog.id.toString()),
        },
        changes: {
          before: {},
          after: req.body,
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Created new activity log entry`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });
    }

    res.status(201).send(activityLog);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function updateActivityLog(req: CustomRequest, res: Response) {
  try {
    const updateSchema = z
      .object({
        _id: z.string().min(1, "Activity log ID is required"),
      })
      .passthrough();

    const validatedData = updateSchema.parse(req.body);

    const currentActivityLog = await activityLogService.getActivityLog(validatedData._id, {
      select: Object.keys(req.body).filter((key) => key !== "_id"),
    });

    const activityLog = await activityLogService.updateActivityLog(req.body);
    if (!activityLog) {
      res.status(404).json({ error: config.RESPONSE.ERROR.ACTIVITY_LOG.NOT_FOUND });
      return;
    }

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
          title: "",
        },
        action: "update",
        description: `Updated activity log with ID: ${activityLog._id}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "activity_log",
        createdAt: new Date(),
      });
      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId(req.user.id),
        type: "UPDATE",
        severity: "INFO",
        entity: {
          type: "ACTIVITY_LOG",
          id: activityLog?._id
            ? new mongoose.Types.ObjectId(activityLog._id.toString())
            : new mongoose.Types.ObjectId(),
        },
        changes: {
          before: currentActivityLog || {},
          after: activityLog || {},
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Updated activity log`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });
    }

    res.status(200).send(activityLog);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function deleteActivityLog(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    const currentActivityLog = await activityLogService.getActivityLog(id, {
      select: ["_id", "action", "description"],
    });

    const activityLog = await activityLogService.deleteActivityLog(id);
    if (!activityLog) {
      res.status(404).json({ error: config.RESPONSE.ERROR.ACTIVITY_LOG.NOT_FOUND });
      return;
    }

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
          title: "",
        },
        action: "delete",
        description: `Deleted activity log with ID: ${id}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "activity_log",
        createdAt: new Date(),
      });
      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId(req.user.id),
        type: "DELETE",
        severity: "INFO",
        entity: {
          type: "ACTIVITY_LOG",
          id: new mongoose.Types.ObjectId(id),
        },
        changes: {
          before: currentActivityLog || {},
          after: {},
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Deleted activity log`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });
    }

    res.status(200).send({ message: config.SUCCESS.ACTIVITY_LOG.DELETE });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function searchActivityLog(req: CustomRequest, res: Response) {
  try {
    const activityLogs = await activityLogService.searchActivityLog(req.body);

    res.status(200).send(activityLogs);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function exportActivityLog(req: CustomRequest, res: Response) {
  try {
    const result = await activityLogService.searchActivityLog(req.body);

    const activityLogs = Array.isArray(result) ? result : result.activityLogs || [];

    const headers = [
      "User ID",
      "IP Address",
      "Path",
      "Method",
      "Action",
      "Description",
      "Organization ID",
      "Entity Type",
      "Created At",
      "User Agent",
    ];

    const csvRows = [
      headers.join(","),
      ...activityLogs.map((log: IActivityLogging) =>
        [
          log.userId,
          log.ip,
          log.path,
          log.method,
          log.action,
          `"${log.description.replace(/"/g, '""')}"`,
          log.organizationId || "",
          log.entityType || "",
          log.createdAt,
          log.headers?.["user-agent"] || "",
        ].join(",")
      ),
    ].join("\n");

    sendCSVResponse(res, csvRows, "activity_logs");
  } catch (error) {
    handleZodError(error, res);
  }
}
