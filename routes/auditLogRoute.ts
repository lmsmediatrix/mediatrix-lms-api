import express, { Request, Response } from "express";
import { API_ENDPOINTS } from "../config/endpointsConfig";
import auditLogService from "../services/auditLogService";
import { handleZodError } from "../middleware/zodErrorHandler";
import { ACTION, config, USER_ROLES } from "../config/common";
import { ValidationSchemas } from "../helper/validationSchemas";
import { CustomRequest } from "../type/types";
import { IAuditLog } from "../models/auditLogModel";
import { sendCSVResponse } from "../utils/csvUtils/csvResponse";
import { validatePermissions } from "../middleware/rabcMiddleware";
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Audit Logs
 *   description: Audit log management endpoints for tracking system activities and changes
 */

/**
 * @swagger
 * /api/audit-log/get/all:
 *   get:
 *     summary: Get all audit logs
 *     description: Retrieve a list of all audit logs with optional filtering, sorting, and pagination
 *     tags: [Audit Logs]
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
 *         description: List of audit logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 auditLogs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AuditLog'
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
  API_ENDPOINTS.AUDIT_LOG.GET_ALL,
  validatePermissions([USER_ROLES.SUPERADMIN], ACTION.GET_ALL),
  getAuditLogs
);

/**
 * @swagger
 * /api/audit-log/get/{id}:
 *   get:
 *     summary: Get audit log by ID
 *     description: Retrieve a specific audit log entry by its unique identifier
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Audit log ID
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
 *         description: Audit log retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuditLog'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Audit log not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.AUDIT_LOG.GET_BY_ID,
  validatePermissions([USER_ROLES.SUPERADMIN], ACTION.GET_BY_ID),
  getAuditLog
);

/**
 * @swagger
 * /api/audit-log/create:
 *   post:
 *     summary: Create a new audit log
 *     description: Create a new audit log entry to track system activities and changes
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user
 *               - type
 *               - entity
 *             properties:
 *               user:
 *                 type: string
 *                 description: User ID who performed the action
 *               type:
 *                 type: string
 *                 enum: [CREATE, UPDATE, DELETE]
 *                 description: Type of audit log entry
 *               severity:
 *                 type: string
 *                 enum: [INFO, WARNING, ERROR]
 *                 description: Severity level of the audit log
 *               entity:
 *                 type: object
 *                 required:
 *                   - type
 *                   - id
 *                 properties:
 *                   type:
 *                     type: string
 *                     description: Type of entity (e.g., USER, COURSE, ASSESSMENT)
 *                   id:
 *                     type: string
 *                     description: Entity ID
 *               changes:
 *                 type: object
 *                 properties:
 *                   before:
 *                     type: object
 *                     description: State before the change
 *                   after:
 *                     type: object
 *                     description: State after the change
 *               metadata:
 *                 type: object
 *                 properties:
 *                   userAgent:
 *                     type: string
 *                     description: User agent information
 *                   ip:
 *                     type: string
 *                     description: IP address
 *                   path:
 *                     type: string
 *                     description: API endpoint path
 *                   method:
 *                     type: string
 *                     description: HTTP method
 *               description:
 *                 type: string
 *                 description: Description of the audit log entry
 *               organizationId:
 *                 type: string
 *                 description: Organization ID associated with the audit log
 *     responses:
 *       201:
 *         description: Audit log created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuditLog'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.AUDIT_LOG.CREATE,
  validatePermissions([USER_ROLES.SUPERADMIN], ACTION.CREATE),
  createAuditLog
);

/**
 * @swagger
 * /api/audit-log/update:
 *   put:
 *     summary: Update an audit log
 *     description: Update an existing audit log entry's details
 *     tags: [Audit Logs]
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
 *                 description: Audit log ID
 *               user:
 *                 type: string
 *                 description: User ID who performed the action
 *               type:
 *                 type: string
 *                 enum: [CREATE, UPDATE, DELETE]
 *                 description: Type of audit log entry
 *               severity:
 *                 type: string
 *                 enum: [INFO, WARNING, ERROR]
 *                 description: Severity level of the audit log
 *               entity:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     description: Type of entity
 *                   id:
 *                     type: string
 *                     description: Entity ID
 *               changes:
 *                 type: object
 *                 properties:
 *                   before:
 *                     type: object
 *                     description: State before the change
 *                   after:
 *                     type: object
 *                     description: State after the change
 *               metadata:
 *                 type: object
 *                 properties:
 *                   userAgent:
 *                     type: string
 *                     description: User agent information
 *                   ip:
 *                     type: string
 *                     description: IP address
 *                   path:
 *                     type: string
 *                     description: API endpoint path
 *                   method:
 *                     type: string
 *                     description: HTTP method
 *               description:
 *                 type: string
 *                 description: Description of the audit log entry
 *               organizationId:
 *                 type: string
 *                 description: Organization ID associated with the audit log
 *     responses:
 *       200:
 *         description: Audit log updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuditLog'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Audit log not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.AUDIT_LOG.UPDATE,
  validatePermissions([USER_ROLES.SUPERADMIN], ACTION.UPDATE),
  updateAuditLog
);

/**
 * @swagger
 * /api/audit-log/delete/{id}:
 *   delete:
 *     summary: Delete an audit log
 *     description: Permanently delete an audit log entry
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Audit log ID
 *     responses:
 *       200:
 *         description: Audit log deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Audit log deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Audit log not found
 *       500:
 *         description: Server error
 */
router.delete(
  API_ENDPOINTS.AUDIT_LOG.DELETE,
  validatePermissions([USER_ROLES.SUPERADMIN], ACTION.DELETE),
  deleteAuditLog
);

/**
 * @swagger
 * /api/audit-log/search:
 *   post:
 *     summary: Search audit logs
 *     description: Search and filter audit logs using various criteria
 *     tags: [Audit Logs]
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
 *                   user:
 *                     type: string
 *                     description: Filter by user ID
 *                   type:
 *                     type: string
 *                     enum: [CREATE, UPDATE, DELETE]
 *                     description: Filter by audit log type
 *                   severity:
 *                     type: string
 *                     enum: [INFO, WARNING, ERROR]
 *                     description: Filter by severity level
 *                   entity:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         description: Filter by entity type
 *                       id:
 *                         type: string
 *                         description: Filter by entity ID
 *                   timestamp:
 *                     type: object
 *                     properties:
 *                       $gte:
 *                         type: string
 *                         format: date-time
 *                         description: Filter by start date
 *                       $lte:
 *                         type: string
 *                         format: date-time
 *                         description: Filter by end date
 *                   organizationId:
 *                     type: string
 *                     description: Filter by organization ID
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AuditLog'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.AUDIT_LOG.SEARCH,
  validatePermissions([USER_ROLES.SUPERADMIN], ACTION.CUSTOM),
  searchAuditLog
);

/**
 * @swagger
 * /api/audit-log/export:
 *   post:
 *     summary: Export audit logs
 *     description: Export audit logs to CSV format with filtering options
 *     tags: [Audit Logs]
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
 *                 description: Export filter criteria
 *                 properties:
 *                   user:
 *                     type: string
 *                     description: Filter by user ID
 *                   type:
 *                     type: string
 *                     enum: [CREATE, UPDATE, DELETE]
 *                     description: Filter by audit log type
 *                   severity:
 *                     type: string
 *                     enum: [INFO, WARNING, ERROR]
 *                     description: Filter by severity level
 *                   entity:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         description: Filter by entity type
 *                       id:
 *                         type: string
 *                         description: Filter by entity ID
 *                   timestamp:
 *                     type: object
 *                     properties:
 *                       $gte:
 *                         type: string
 *                         format: date-time
 *                         description: Filter by start date
 *                       $lte:
 *                         type: string
 *                         format: date-time
 *                         description: Filter by end date
 *                   organizationId:
 *                     type: string
 *                     description: Filter by organization ID
 *     responses:
 *       200:
 *         description: Exported audit logs in CSV format
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.AUDIT_LOG.EXPORT,
  validatePermissions([USER_ROLES.SUPERADMIN], ACTION.CUSTOM),
  exportAuditLog
);

export default router;

export async function getAuditLogs(req: CustomRequest, res: Response) {
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
    });

    const { auditLogs, pagination, count } = await auditLogService.getAuditLogs(params);

    res.status(200).send({ auditLogs, pagination, count });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getAuditLog(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });
    const params = ValidationSchemas.getQueryParams.parse({
      populateArray: req.query.populateArray ? JSON.parse(req.query.populateArray as string) : [],
      select: Array.isArray(req.query.select)
        ? req.query.select
        : [req.query.select].filter(Boolean),
      lean: req.query.lean,
    });

    const auditLog = await auditLogService.getAuditLog(id, params);

    if (!auditLog) {
      res.status(404).json({ error: config.RESPONSE.ERROR.AUDIT_LOG.NOT_FOUND });
      return;
    }
    res.status(200).send(auditLog);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function createAuditLog(req: CustomRequest, res: Response) {
  try {
    const auditLog = await auditLogService.createAuditLog(req.body);
    res.status(201).send(auditLog);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function updateAuditLog(req: Request, res: Response) {
  try {
    const auditLog = await auditLogService.updateAuditLog(req.body);
    if (!auditLog) {
      res.status(404).json({ error: config.RESPONSE.ERROR.AUDIT_LOG.NOT_FOUND });
      return;
    }
    res.status(200).send(auditLog);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function deleteAuditLog(req: Request, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });
    const auditLog = await auditLogService.deleteAuditLog(id);
    if (!auditLog) {
      res.status(404).json({ error: config.RESPONSE.ERROR.AUDIT_LOG.NOT_FOUND });
      return;
    }
    res.status(200).send({ message: config.SUCCESS.AUDIT_LOG.DELETE });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function searchAuditLog(req: CustomRequest, res: Response) {
  try {
    const auditLogs = await auditLogService.searchAuditLog(req.body);
    res.status(200).send(auditLogs);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function exportAuditLog(req: CustomRequest, res: Response) {
  try {
    const result = await auditLogService.searchAuditLog(req.body);

    const auditLogs = Array.isArray(result) ? result : result.auditLogs || [];

    const headers = [
      "User ID",
      "Type",
      "Severity",
      "Entity Type",
      "Entity ID",
      "Description",
      "Changes Before",
      "Changes After",
      "User Agent",
      "IP Address",
      "Path",
      "Method",
      "Timestamp",
      "Organization ID",
    ];

    const csvRows = [
      headers.join(","),
      ...auditLogs.map((log: IAuditLog) =>
        [
          log.user,
          log.type,
          log.severity,
          log.entity.type,
          log.entity.id,
          `"${(log.description || "").replace(/"/g, '""')}"`,
          `"${JSON.stringify(log.changes.before || {}).replace(/"/g, '""')}"`,
          `"${JSON.stringify(log.changes.after || {}).replace(/"/g, '""')}"`,
          log.metadata?.userAgent || "",
          log.metadata?.ip || "",
          log.metadata?.path || "",
          log.metadata?.method || "",
          log.timestamp,
          log.organizationId || "",
        ].join(",")
      ),
    ].join("\n");

    sendCSVResponse(res, csvRows, "audit_logs");
  } catch (error) {
    handleZodError(error, res);
  }
}
