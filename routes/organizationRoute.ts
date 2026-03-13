import express, { Request, Response } from "express";
import { API_ENDPOINTS } from "../config/endpointsConfig";
import { OrganizationZodSchema } from "../models/organizationModel";
import { handleZodError } from "../middleware/zodErrorHandler";
import { ValidationSchemas } from "../helper/validationSchemas";
import organizationService from "../services/organizationService";
import { z } from "zod";
import { upload } from "../middleware/multer";
import { ACTION, config, USER_ROLES } from "../config/common";
import { CustomRequest } from "../type/types";
import activityLogService from "../services/activityLogService";
import auditLogService from "../services/auditLogService";
import mongoose from "mongoose";
import { validatePermissions } from "../middleware/rabcMiddleware";
import { processNestedFormData } from "../utils/formDataUtils";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Organizations
 *   description: Organization management endpoints for handling educational institutions, their settings, and related operations
 */

/**
 * @swagger
 * /api/organization/get/all:
 *   get:
 *     summary: Get all organizations with filtering and pagination
 *     description: Retrieve a list of all organizations with support for filtering, sorting, pagination, and field selection
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: object
 *         description: Query parameters for filtering organizations (e.g., name, status, type)
 *       - in: query
 *         name: queryArray
 *         schema:
 *           type: array
 *         description: Array of query parameters for complex filtering
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: Fields to populate (e.g., courses, instructors, students)
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort criteria (e.g., "name:1" for ascending, "createdAt:-1" for newest first)
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
 *         description: List of organizations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Organizations retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Organization'
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
  API_ENDPOINTS.ORGANIZATION.GET_ALL,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN],
    ACTION.GET_ALL
  ),
  getOrganizations
);

/**
 * @swagger
 * /api/organization/get/{id}:
 *   get:
 *     summary: Get organization by ID with detailed information
 *     description: Retrieve detailed information about a specific organization by its ID
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: Fields to populate (e.g., courses, instructors, students)
 *       - in: query
 *         name: select
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Fields to select in the response
 *     responses:
 *       200:
 *         description: Organization retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Organization retrieved successfully
 *                 data:
 *                   $ref: '#/components/schemas/Organization'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Organization not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.ORGANIZATION.GET_BY_ID,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN],
    ACTION.GET_BY_ID
  ),
  getOrganization
);

/**
 * @swagger
 * /api/organization/code/{code}:
 *   get:
 *     summary: Get organization by code with detailed information
 *     description: Retrieve detailed information about a specific organization using its unique code
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization code
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: Fields to populate (e.g., courses, instructors, students)
 *       - in: query
 *         name: select
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Fields to select in the response
 *       - in: query
 *         name: includeArchived
 *         schema:
 *           type: boolean
 *         description: Whether to include archived organizations in the search
 *     responses:
 *       200:
 *         description: Organization retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Organization retrieved successfully
 *                 data:
 *                   $ref: '#/components/schemas/Organization'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Organization not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.ORGANIZATION.GET_ORGANIZATION_BY_CODE,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN],
    ACTION.GET_BY_ID
  ),
  getOrganizationByCode
);

/**
 * @swagger
 * /api/organization/create:
 *   post:
 *     summary: Create a new organization
 *     description: Create a new educational organization with branding, contact information, and settings
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               branding:
 *                 type: object
 *                 properties:
 *                   logo:
 *                     type: string
 *                     format: binary
 *                     description: Organization logo image file
 *                   coverPhoto:
 *                     type: string
 *                     format: binary
 *                     description: Organization cover photo image file
 *               name:
 *                 type: string
 *                 description: Organization name
 *                 example: "ABC University"
 *               description:
 *                 type: string
 *                 description: Detailed description of the organization
 *                 example: "A leading educational institution focused on technology and innovation"
 *               address:
 *                 type: string
 *                 description: Physical address of the organization
 *                 example: "123 Education St, City, Country"
 *               contact:
 *                 type: object
 *                 properties:
 *                   email:
 *                     type: string
 *                     description: Primary contact email
 *                     example: "contact@abcu.edu"
 *                   phone:
 *                     type: string
 *                     description: Primary contact phone number
 *                     example: "+1-234-567-8900"
 *     responses:
 *       200:
 *         description: Organization created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Organization created successfully
 *                 data:
 *                   $ref: '#/components/schemas/Organization'
 *       400:
 *         description: Invalid input - Missing required fields or invalid data
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.ORGANIZATION.CREATE,
  upload.fields([
    { name: "branding.logo", maxCount: 1 },
    { name: "branding.coverPhoto", maxCount: 1 },
  ]),
  validatePermissions([USER_ROLES.SUPERADMIN], ACTION.CREATE),
  createOrganization
);

/**
 * @swagger
 * /api/organization/update:
 *   put:
 *     summary: Update organization details
 *     description: Update organization properties including branding, contact information, and settings
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - _id
 *             properties:
 *               _id:
 *                 type: string
 *                 description: Organization ID
 *                 example: "60d21b4667d0d8992e610c85"
 *               branding:
 *                 type: object
 *                 properties:
 *                   logo:
 *                     type: string
 *                     format: binary
 *                     description: Organization logo image file
 *                   coverPhoto:
 *                     type: string
 *                     format: binary
 *                     description: Organization cover photo image file
 *               name:
 *                 type: string
 *                 description: Organization name
 *                 example: "ABC University"
 *               description:
 *                 type: string
 *                 description: Updated description of the organization
 *                 example: "A leading educational institution focused on technology and innovation"
 *               address:
 *                 type: string
 *                 description: Updated physical address
 *                 example: "123 Education St, City, Country"
 *               contact:
 *                 type: object
 *                 properties:
 *                   email:
 *                     type: string
 *                     description: Updated contact email
 *                     example: "contact@abcu.edu"
 *                   phone:
 *                     type: string
 *                     description: Updated contact phone number
 *                     example: "+1-234-567-8900"
 *     responses:
 *       200:
 *         description: Organization updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Organization updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/Organization'
 *       400:
 *         description: Invalid input - Missing required fields or invalid data
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Organization not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.ORGANIZATION.UPDATE,
  upload.fields([
    { name: "branding.logo", maxCount: 1 },
    { name: "branding.coverPhoto", maxCount: 1 },
  ]),
  validatePermissions([USER_ROLES.SUPERADMIN], ACTION.UPDATE),
  updateOrganization
);

/**
 * @swagger
 * /api/organization/remove/{id}:
 *   delete:
 *     summary: Delete an organization
 *     description: Permanently delete an organization and all its associated data
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID to delete
 *     responses:
 *       200:
 *         description: Organization deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Organization deleted successfully
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Organization not found
 *       500:
 *         description: Server error
 */
router.delete(
  API_ENDPOINTS.ORGANIZATION.REMOVE,
  validatePermissions([USER_ROLES.SUPERADMIN], ACTION.DELETE),
  deleteOrganization
);

/**
 * @swagger
 * /api/organization/search:
 *   post:
 *     summary: Search organizations with custom criteria
 *     description: Search for organizations using custom search criteria and filters
 *     tags: [Organizations]
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
 *                 description: Search criteria (e.g., name, type, status)
 *                 example: { "name": "University", "type": "Educational" }
 *     responses:
 *       200:
 *         description: List of organizations matching search criteria
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Organization'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.ORGANIZATION.SEARCH,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN],
    ACTION.SEARCH
  ),
  searchOrganization
);

/**
 * @swagger
 * /api/organization/{id}/dashboard:
 *   get:
 *     summary: Get dashboard for a specific organization
 *     description: Retrieve detailed dashboard data for a specific organization including statistics, events, and sections
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: Fields to populate (e.g., courses, instructors, students)
 *       - in: query
 *         name: select
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Fields to select in the response
 *     responses:
 *       200:
 *         description: Organization dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Organization dashboard retrieved successfully
 *                 data:
 *                   $ref: '#/components/schemas/Organization'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Organization not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.ORGANIZATION.DASHBOARD,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN],
    ACTION.GET_ALL
  ),
  organizationDashboard
);

/**
 * @swagger
 * /api/organization/archive/{id}:
 *   put:
 *     summary: Archive an organization (soft delete)
 *     description: Archive an organization instead of permanent deletion, making it inaccessible but preserving data
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID to archive
 *     responses:
 *       200:
 *         description: Organization archived successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Organization archived successfully
 *                 data:
 *                   $ref: '#/components/schemas/Organization'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Organization not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.ORGANIZATION.ARCHIVE,
  validatePermissions(
    [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN, USER_ROLES.INSTRUCTOR],
    ACTION.ARCHIVE
  ),
  archiveOrganization
);

router.post(
  API_ENDPOINTS.ORGANIZATION.HELPER_CODE,
  validatePermissions([USER_ROLES.SUPERADMIN], ACTION.CUSTOM),
  generateCode
);

export default router;

export async function getOrganizations(req: Request, res: Response) {
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

    const { organizations, pagination, count } = await organizationService.getOrganizations(params);

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
          title: "Organization Management - View All Organizations",
        },
        action: "read",
        description: `Retrieved ${Array.isArray(organizations) ? organizations.length : 0} organizations${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(" ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "organization",
        createdAt: new Date(),
      });
    }

    res.status(200).send({
      message: config.SUCCESS.ORGANIZATION.GET_ALL,
      data: organizations,
      pagination,
      count,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getOrganization(req: Request, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });
    const params = ValidationSchemas.getQueryParams.parse({
      populateArray: req.query.populateArray ? JSON.parse(req.query.populateArray as string) : [],
      select: Array.isArray(req.query.select)
        ? req.query.select
        : [req.query.select].filter(Boolean),
      lean: req.query.lean,
    });

    const organization = await organizationService.getOrganization(id, params);

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
          title: "Organization Management - View Organization Details",
        },
        action: "read",
        description: `Viewed organization details for ${organization?.name || id}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "organization",
        createdAt: new Date(),
      });
    }

    res.status(200).send({ message: config.SUCCESS.ORGANIZATION.GET_BY_ID, data: organization });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getOrganizationByCode(req: Request, res: Response) {
  try {
    const { code } = req.params;
    const queryParams = ValidationSchemas.getQueryParams.parse({
      populateArray: req.query.populateArray ? JSON.parse(req.query.populateArray as string) : [],
      select: Array.isArray(req.query.select)
        ? req.query.select
        : (typeof req.query.select === "string" ? [req.query.select] : []).filter(Boolean),
      lean: req.query.lean === "true",
    });

    if (req.query.includeArchived !== undefined) {
      (queryParams as any).includeArchived = req.query.includeArchived === "true";
    }

    const organization = await organizationService.getOrganizationByCode(code, queryParams);

    if (!organization) {
      return res.status(config.STATUS.NOT_FOUND.CODE).json({
        message: config.STATUS.NOT_FOUND.TITLE,
      });
    }

    res.status(200).json({
      message: config.SUCCESS.ORGANIZATION.GET_BY_ID,
      data: organization,
    });
  } catch (error) {
    console.error(error);

    if (error instanceof Error) {
      res.status(config.STATUS.SERVER_ERROR.CODE).json({
        message: config.STATUS.SERVER_ERROR.TITLE,
        error: error.message,
      });
    } else {
      res.status(config.STATUS.DEFAULT_ERROR.CODE).json({
        message: config.STATUS.DEFAULT_ERROR.UNEXPECTED,
        error: "An unknown error occurred",
      });
    }
  }
}

export async function createOrganization(req: CustomRequest, res: Response) {
  try {
    const processedBody = processNestedFormData(req.body);

    const validatedData = OrganizationZodSchema.partial()
      .extend({ path: z.string().optional() })
      .parse(processedBody);
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const newOrganization = await organizationService.createOrganization(validatedData, files);

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
          title: "Organization Management - Create New Organization",
        },
        action: "create",
        description: `Created new organization: ${newOrganization.name}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "organization",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId(req.user.id),
        type: "CREATE",
        severity: "INFO",
        entity: {
          type: "ORGANIZATION",
          id: newOrganization._id,
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
        description: `Created new organization ${newOrganization.name}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });
    }

    res.status(200).send({ message: config.SUCCESS.ORGANIZATION.CREATE, data: newOrganization });
  } catch (error) {
    console.error("Error creating organization:", error);
    handleZodError(error, res);
  }
}

export async function updateOrganization(req: CustomRequest, res: Response) {
  try {
    const processedBody = processNestedFormData(req.body);

    const validatedData = OrganizationZodSchema.partial()
      .extend({ _id: z.string().min(1), path: z.string().optional() })
      .parse(processedBody);

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const currentOrganization = await organizationService.getOrganization(validatedData._id, {
      select: Object.keys(req.body)
        .filter((key) => key !== "_id")
        .join(", "),
    });

    const updatedOrganization = await organizationService.updateOrganization(validatedData, files);

    if (req.user) {
      const updatedFields = Object.keys(req.body)
        .filter((key) => key !== "_id")
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
          title: "Organization Management - Update Organization",
        },
        action: "update",
        description: `Updated organization: ${updatedOrganization?.name || "unknown"} with fields: ${updatedFields}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "organization",
        createdAt: new Date(),
      });

      if (!updatedOrganization) {
        throw new Error("Failed to update organization");
      }

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId(req.user.id),
        type: "UPDATE",
        severity: "INFO",
        entity: {
          type: "ORGANIZATION",
          id: updatedOrganization._id,
        },
        changes: {
          before: currentOrganization || {},
          after: updatedOrganization,
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Updated organization: ${updatedOrganization.name}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });
    }

    res
      .status(200)
      .send({ message: config.SUCCESS.ORGANIZATION.UPDATE, data: updatedOrganization });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function deleteOrganization(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    const currentOrganization = await organizationService.getOrganization(id, {
      select: ["name"],
    });

    if (!currentOrganization) {
      throw new Error("Organization not found");
    }

    await organizationService.deleteOrganization(id);

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
          title: "Organization Management - Delete Organization",
        },
        action: "remove",
        description: `Deleted organization: ${currentOrganization.name}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "organization",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId(req.user.id),
        type: "DELETE",
        severity: "INFO",
        entity: {
          type: "ORGANIZATION",
          id: new mongoose.Types.ObjectId(id),
        },
        changes: {
          before: currentOrganization,
          after: {},
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Deleted organization: ${currentOrganization.name}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });
    }

    res.status(200).send({ message: config.SUCCESS.ORGANIZATION.DELETE });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function searchOrganization(req: Request, res: Response) {
  try {
    const searchResult = await organizationService.searchOrganization(req.body);

    if ((req as any).user) {
      const searchCriteria = Object.entries(req.body)
        .filter(([key]) => !["select", "limit", "skip", "document", "pagination"].includes(key))
        .map(([key, value]) => `${key}: ${typeof value === "object" ? "custom filter" : value}`)
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
          title: "Organization Management - Search Organizations",
        },
        action: "read",
        description: `Organization search performed${searchCriteria ? ` with criteria: ${searchCriteria}` : ""} (found ${searchResult?.length || 0} results)`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "organization",
        createdAt: new Date(),
      });
    }

    res.status(200).send(searchResult);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function organizationDashboard(req: Request, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });
    const params = ValidationSchemas.getQueryParams.parse({
      populateArray: req.query.populateArray ? JSON.parse(req.query.populateArray as string) : [],
      select: Array.isArray(req.query.select)
        ? req.query.select
        : [req.query.select].filter(Boolean),
      lean: req.query.lean,
    });

    const organization = await organizationService.organizationDashboard(id, params);

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
          title: "Organization Management - View Organization Dashboard",
        },
        action: "read",
        description: `Viewed organization dashboard for: ${organization?.name || id}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "organization",
        createdAt: new Date(),
      });
    }

    res.status(200).send({ message: config.SUCCESS.ORGANIZATION.GET_BY_ID, data: organization });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function archiveOrganization(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "User not authenticated or missing organization" });
    }

    const archivedOrganization = await organizationService.archiveOrganization(id);

    if (!archivedOrganization) {
      return res.status(404).json({ message: "organization not found" });
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
        title: "Organization Management - Archive Organization",
      },
      action: "archive",
      description: `Archived organization: ${id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      entityType: "organization",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(req.user.id),
      type: "UPDATE",
      severity: "INFO",
      entity: {
        type: "ORGANIZATION",
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
      description: `Archived organization: ${id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });

    res.status(200).json({
      message: config.SUCCESS.ORGANIZATION.ARCHIVE,
      data: archivedOrganization,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function generateCode(req: CustomRequest, res: Response) {
  try {
    const { name, code } = req.body;
    const generatedCode = await organizationService.generateCode(name, code);

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
          title: "Organization Management - Generate Code",
        },
        action: "create",
        description: `Generated organization code: ${generatedCode} for: ${name}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "organization",
        createdAt: new Date(),
      });
    }

    res
      .status(200)
      .send({ message: config.SUCCESS.ORGANIZATION.GENERATE_CODE, code: generatedCode });
  } catch (error) {
    handleZodError(error, res);
  }
}
