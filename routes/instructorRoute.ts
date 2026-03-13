import express, { Request, Response } from "express";
import { API_ENDPOINTS } from "../config/endpointsConfig";
import { handleZodError } from "../middleware/zodErrorHandler";
import { ValidationSchemas } from "../helper/validationSchemas";
import instructorService from "../services/instructorService";
import { z } from "zod";
import { InstructorZodSchema } from "../models/instructorModel";
import mongoose from "mongoose";
import { upload } from "../middleware/multer";
import { processInstructorFormData } from "../helper/formDataHelper";
import { CustomRequest } from "../type/types";
import { validatePermissions } from "../middleware/rabcMiddleware";
import { ACTION, config, USER_ROLES } from "../config/common";
import activityLogService from "../services/activityLogService";
import auditLogService from "../services/auditLogService";
import { parseCSVBuffer } from "../utils/csvUtils/csvUtils";
import { sendCSVResponse } from "../utils/csvUtils/csvResponse";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Instructors
 *   description: Instructor management endpoints for handling instructor profiles, courses, and related operations
 */

/**
 * @swagger
 * /api/instructor/get/all:
 *   get:
 *     summary: Get all instructors
 *     description: Retrieve a list of all instructors with optional filtering, sorting, and pagination
 *     tags: [Instructors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: object
 *         description: Query parameters for filtering instructors
 *       - in: query
 *         name: queryArray
 *         schema:
 *           type: array
 *         description: Array of query parameters for complex filtering
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: Fields to populate (comma-separated)
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort criteria (e.g., "createdAt:desc")
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Number of records to return
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
 *         description: List of instructors retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Instructors retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Instructor'
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
 *                   type: number
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Internal server error
 */
router.get(
  API_ENDPOINTS.INSTRUCTOR.GET_ALL,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN],
    ACTION.GET_ALL
  ),
  getInstructors
);

/**
 * @swagger
 * /api/instructor/get/{id}:
 *   get:
 *     summary: Get instructor by ID
 *     description: Retrieve detailed information about a specific instructor
 *     tags: [Instructors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Instructor ID
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: Fields to populate (comma-separated)
 *       - in: query
 *         name: select
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Fields to select in the response
 *     responses:
 *       200:
 *         description: Instructor retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Instructor retrieved successfully
 *                 data:
 *                   $ref: '#/components/schemas/Instructor'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Instructor not found
 *       500:
 *         description: Internal server error
 */
router.get(
  API_ENDPOINTS.INSTRUCTOR.GET_BY_ID,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN],
    ACTION.GET_BY_ID
  ),
  getInstructor
);

/**
 * @swagger
 * /api/instructor/create:
 *   post:
 *     summary: Create a new instructor
 *     description: Create a new instructor profile with optional avatar upload
 *     tags: [Instructors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *             properties:
 *               firstName:
 *                 type: string
 *                 description: Instructor's first name
 *               lastName:
 *                 type: string
 *                 description: Instructor's last name
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Instructor's email address
 *               phone:
 *                 type: string
 *                 description: Instructor's phone number
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Instructor avatar image (optional)
 *     responses:
 *       200:
 *         description: Instructor created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Instructor created successfully
 *                 data:
 *                   $ref: '#/components/schemas/Instructor'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.INSTRUCTOR.CREATE,
  upload.fields([{ name: "avatar", maxCount: 1 }]),
  validatePermissions([USER_ROLES.ADMIN], ACTION.CREATE),
  createInstructor
);

/**
 * @swagger
 * /api/instructor/update:
 *   put:
 *     summary: Update an instructor
 *     description: Update an existing instructor's profile information
 *     tags: [Instructors]
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
 *                 description: Instructor ID
 *               firstName:
 *                 type: string
 *                 description: Instructor's first name
 *               lastName:
 *                 type: string
 *                 description: Instructor's last name
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Instructor's email address
 *               phone:
 *                 type: string
 *                 description: Instructor's phone number
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Instructor avatar image (optional)
 *     responses:
 *       200:
 *         description: Instructor updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Instructor updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/Instructor'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Instructor not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.INSTRUCTOR.UPDATE,
  upload.fields([{ name: "avatar", maxCount: 1 }]),
  validatePermissions([USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.UPDATE),
  updateInstructor
);

/**
 * @swagger
 * /api/instructor/remove/{id}:
 *   delete:
 *     summary: Delete an instructor
 *     description: Permanently delete an instructor's profile
 *     tags: [Instructors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Instructor ID to delete
 *     responses:
 *       200:
 *         description: Instructor deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Instructor deleted successfully
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Instructor not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  API_ENDPOINTS.INSTRUCTOR.REMOVE,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR], ACTION.DELETE),
  deleteInstructor
);

/**
 * @swagger
 * /api/instructor/search:
 *   post:
 *     summary: Search instructors
 *     description: Search for instructors based on specified criteria
 *     tags: [Instructors]
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
 *                 description: Search criteria
 *                 example: { "firstName": "John", "specialization": "Mathematics" }
 *     responses:
 *       200:
 *         description: List of instructors matching search criteria
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Instructor'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Internal server error
 */
router.post(
  API_ENDPOINTS.INSTRUCTOR.SEARCH,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.SEARCH),
  searchInstructor
);

/**
 * @swagger
 * /api/instructor/bulk-import:
 *   post:
 *     summary: Bulk import instructors
 *     description: Import multiple instructors from a CSV file
 *     tags: [Instructors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file containing instructor data
 *     responses:
 *       200:
 *         description: Instructors imported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Instructors imported successfully
 *                 result:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: number
 *                     failed:
 *                       type: number
 *       400:
 *         description: Invalid file format or data
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Internal server error
 */
router.post(
  API_ENDPOINTS.INSTRUCTOR.BULK_IMPORT,
  upload.single("file"),
  validatePermissions([USER_ROLES.ADMIN], ACTION.CUSTOM),
  bulkImport
);

/**
 * @swagger
 * /api/instructor/dashboard:
 *   get:
 *     summary: Get instructor dashboard
 *     description: Retrieve dashboard data for the authenticated instructor
 *     tags: [Instructors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: Fields to populate (comma-separated)
 *       - in: query
 *         name: select
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Fields to select in the response
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Dashboard data retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     courses:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Course'
 *                     students:
 *                       type: number
 *                     assessments:
 *                       type: number
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Dashboard data not found
 *       500:
 *         description: Internal server error
 */
router.get(
  API_ENDPOINTS.INSTRUCTOR.DASHBOARD,
  validatePermissions([USER_ROLES.INSTRUCTOR], ACTION.GET_ALL),
  instructorDashboard
);

/**
 * @swagger
 * /api/instructor/archive/{id}:
 *   put:
 *     summary: Archive an instructor
 *     description: Soft delete an instructor by marking them as archived
 *     tags: [Instructors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Instructor ID to archive
 *     responses:
 *       200:
 *         description: Instructor archived successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Instructor archived successfully
 *                 data:
 *                   $ref: '#/components/schemas/Instructor'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Instructor not found
 *       500:
 *         description: Internal server error
 */
router.put(
  API_ENDPOINTS.INSTRUCTOR.ARCHIVE,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN], ACTION.ARCHIVE),
  archiveInstructor
);

/**
 * @swagger
 * /api/instructor/export:
 *   post:
 *     summary: Export instructors
 *     description: Export instructor data to CSV format
 *     tags: [Instructors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: object
 *                 description: Query parameters for filtering instructors
 *               filename:
 *                 type: string
 *                 description: Custom filename for the exported CSV
 *     responses:
 *       200:
 *         description: Instructors exported successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Internal server error
 */
router.post(
  API_ENDPOINTS.INSTRUCTOR.EXPORT,
  validatePermissions([USER_ROLES.ADMIN], ACTION.CUSTOM),
  exportInstructors
);

export default router;

export async function getInstructors(req: CustomRequest, res: Response) {
  try {
    const params = ValidationSchemas.getQueriesParams.parse({
      query: req.query.query || {},
      queryArray: req.query.queryArray
        ? Array.isArray(req.query.queryArray)
          ? req.query.queryArray
          : String(req.query.queryArray)
              .split(",")
              .map((item) => item.trim())
        : [],
      queryArrayType: req.query.queryArrayType
        ? Array.isArray(req.query.queryArrayType)
          ? req.query.queryArrayType.map(String)
          : String(req.query.queryArrayType).split(",")
        : [],
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

    if (!params.query) params.query = {};
    if (!req.user || !req.user.organizationId) {
      throw new Error("User not authenticated or missing organization");
    }
    params.query.organizationId = req.user.organizationId;

    const { instructors, pagination, count } = await instructorService.getInstructors(params);

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
          title: "Instructor Management - View All Instructors",
        },
        action: "read",
        description: `Retrieved ${instructors} instructors${Array.isArray(params.select) && params.select ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "instructor",
        createdAt: new Date(),
      });
    }

    res.status(200).send({
      message: config.SUCCESS.INSTRUCTOR.GET_ALL,
      data: instructors,
      pagination,
      count,
    });
  } catch (error) {
    if (error) {
      handleZodError(error, res);
    } else {
      res.status(500).send({ message: "Internal server error" });
    }
  }
}

export async function getInstructor(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });
    const params = ValidationSchemas.getQueryParams.parse({
      populateArray: req.query.populateArray ? JSON.parse(req.query.populateArray as string) : [],
      select: Array.isArray(req.query.select)
        ? req.query.select
        : [req.query.select].filter(Boolean),
      lean: req.query.lean,
    });

    if (!req.user || !req.user.organizationId) {
      throw new Error("User not authenticated or missing organization");
    }
    const dbParams = {
      ...params,
      query: { organizationId: req.user.organizationId },
    };

    const instructor = await instructorService.getInstructor(id, dbParams);

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
          title: "Instructor Management - View Instructor Details",
        },
        action: "read",
        description: `Retrieved instructor with ID: ${id}${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "instructor",
        createdAt: new Date(),
      });
    }

    if (!instructor) {
      return res.status(404).send({ message: "instructor not found" });
    }

    res.status(200).send({ message: config.SUCCESS.INSTRUCTOR.GET_BY_ID, data: instructor });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function createInstructor(req: Request, res: Response) {
  try {
    const processed = processInstructorFormData(req.body);

    if (processed.error) {
      return res.status(400).json(processed);
    }

    const validatedData = InstructorZodSchema.partial()
      .extend({ path: z.string().optional() })
      .parse({
        ...processed.processedData,
        organizationId: processed.processedData?.organizationId || (req as any).user.organizationId,
      });

    const files = req.files as { [fieldfirstName: string]: Express.Multer.File[] } | undefined;
    const newInstructor = await instructorService.createInstructor(validatedData, files);

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
          title: "Instructor Management - Create New Instructor",
        },
        action: "create",
        description: `Created new instructor: ${newInstructor.firstName} ${newInstructor.lastName}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "instructor",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId((req as any).user.id),
        type: "CREATE",
        severity: "INFO",
        entity: {
          type: "INSTRUCTOR",
          id: newInstructor._id,
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
        description: `Created new instructor ${newInstructor.firstName} ${newInstructor.lastName}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });
    }

    res.status(200).send({ message: config.SUCCESS.INSTRUCTOR.CREATE, data: newInstructor });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function updateInstructor(req: Request, res: Response) {
  try {
    const processed = processInstructorFormData(req.body);

    if (processed.error) {
      return res.status(400).json(processed);
    }
    const validatedData = InstructorZodSchema.partial()
      .extend({ _id: z.string().min(1), path: z.string().optional() })
      .parse({
        ...processed.processedData,
        organizationId: processed.processedData?.organizationId || (req as any).user.organizationId,
      });

    const updateData = {
      ...validatedData,
      _id: new mongoose.Types.ObjectId(validatedData._id),
    };
    const files = req.files as { [fieldfirstName: string]: Express.Multer.File[] } | undefined;

    const currentInstructor = await instructorService.getInstructor(validatedData._id, {
      select: Object.keys(processed.processedData || {}).filter((key) => key !== "_id"),
    });

    const updateInstructor = await instructorService.updateInstructor(updateData, files);

    if (!updateInstructor) {
      throw new Error("Failed to update instructor");
    }

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
          title: "Instructor Management - Update Instructor",
        },
        action: "update",
        description: `Updated instructor: ${updateInstructor.firstName} ${updateInstructor.lastName} with fields: ${Object.keys(processed.processedData || {}).join(", ")}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "instructor",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId((req as any).user.id),
        type: "UPDATE",
        severity: "INFO",
        entity: {
          type: "INSTRUCTOR",
          id: updateInstructor._id,
        },
        changes: {
          before: currentInstructor || {},
          after: updateInstructor || {},
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Updated instructor ${updateInstructor.firstName} ${updateInstructor.lastName}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });
    }

    res.status(200).send({ message: config.SUCCESS.INSTRUCTOR.UPDATE, data: updateInstructor });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function deleteInstructor(req: Request, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    const currentInstructor = await instructorService.getInstructor(id, {
      select: ["firstName"],
      query: { organizationId: (req as any).user.organizationId },
    });

    if (!currentInstructor) {
      return res.status(404).send({ message: "Instructor not found" });
    }

    await instructorService.deleteInstructor(id);

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
          title: "Instructor Management - Delete Instructor",
        },
        action: "remove",
        description: `Deleted instructor with ID: ${id}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "instructor",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId((req as any).user.id),
        type: "DELETE",
        severity: "INFO",
        entity: {
          type: "INSTRUCTOR",
          id: new mongoose.Types.ObjectId(id),
        },
        changes: {
          before: currentInstructor,
          after: {},
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Deleted instructor ${currentInstructor.firstName}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });
    }

    res.status(200).send({ message: config.SUCCESS.INSTRUCTOR.DELETE });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function searchInstructor(req: Request, res: Response) {
  try {
    const searchResult = await instructorService.searchInstructor(req.body);

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
          title: "Instructor Management - Search Instructors",
        },
        action: "read",
        description: `Searched instructors with criteria: ${searchCriteria || "none"} (found ${searchResult?.length} results)`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "instructor",
        createdAt: new Date(),
      });
    }

    res.status(200).send(searchResult);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function bulkImport(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).send({ message: "No CSV file uploaded" });
    }
    const organizationId = (req as any).user.organizationId;
    const data = await parseCSVBuffer(req.file.buffer);
    const result = await instructorService.bulkImportInstructor(data, organizationId, req);

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
          title: "Instructor Management - Bulk Import Instructors",
        },
        action: "create",
        description: `Bulk imported ${result.successCount} instructors (${result.errorCount} failed)`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "instructor",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId((req as any).user.id),
        type: "BULK_CREATE",
        severity: "INFO",
        entity: {
          type: "INSTRUCTOR",
          id: new mongoose.Types.ObjectId(),
        },
        changes: {
          before: {},
          after: { importedCount: result.successCount, failedCount: result.errorCount },
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Bulk imported ${result.successCount} instructors (${result.errorCount} failed)`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });
    }

    res.status(200).send({ message: config.SUCCESS.INSTRUCTOR.BULK_IMPORT, result });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function instructorDashboard(req: CustomRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send({ message: "User not authenticated" });
    }

    const params = ValidationSchemas.getQueryParams.parse({
      populateArray: req.query.populateArray
        ? req.query.populateArray
            .toString()
            .split(" ")
            .map((path, index) => ({
              path,
              select: req.query.populateSelect?.toString().split(",")[index]?.trim() || "",
            }))
        : [],
      select: Array.isArray(req.query.select)
        ? req.query.select
        : [req.query.select].filter(Boolean),
      lean: req.query.lean,
    });

    if (!req.user || !req.user.organizationId) {
      throw new Error("User not authenticated or missing organization");
    }
    const dbParams = {
      ...params,
      query: { organizationId: req.user.organizationId },
    };

    const dashboardData = await instructorService.instructorDashboard(userId, dbParams);

    if (!dashboardData) {
      return res.status(404).send({ message: "Instructor dashboard data not found" });
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
        title: "Instructor Management - View Dashboard",
      },
      action: "read",
      description: `Viewed instructor dashboard with ${dashboardData.courses?.length || 0} courses, ${dashboardData.students || 0} students, and ${dashboardData.assessments || 0} assessments`,
      organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
      entityType: "instructor",
      createdAt: new Date(),
    });

    res.status(200).send({
      message: config.SUCCESS.INSTRUCTOR.GET_BY_ID,
      data: dashboardData,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function archiveInstructor(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "User not authenticated or missing organization" });
    }

    const archivedInstructor = await instructorService.archiveInstructor(id);

    if (!archivedInstructor) {
      return res.status(404).json({ message: "Instructor not found" });
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
        title: "Instructor Management - Archive Instructor",
      },
      action: "archive",
      description: `Archived instructor with ID: ${id}`,
      organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
      entityType: "instructor",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(req.user.id),
      type: "UPDATE",
      severity: "INFO",
      entity: {
        type: "INSTRUCTOR",
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
      description: `Archived instructor with ID ${id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });

    res.status(200).json({
      message: config.SUCCESS.INSTRUCTOR.ARCHIVE,
      data: archivedInstructor,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function exportInstructors(req: CustomRequest, res: Response) {
  try {
    const requestBody = { ...req.body };
    if (req.user && req.user.id) {
      requestBody.currentUserId = req.user.id;
    }
    let filename = "instructors";
    if (req.query.filename && typeof req.query.filename === "string") {
      filename = req.query.filename;
    } else if (req.body.filename && typeof req.body.filename === "string") {
      filename = req.body.filename;
    }
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        message: "User not authenticated or missing organization",
        status: "error",
      });
    }
    const csv = await instructorService.exportInstructor(requestBody, organizationId);

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
          title: "Instructor Management - Export Instructors",
        },
        action: "export",
        description: `Exported instructors to CSV${req.body.query ? ` with filters: ${JSON.stringify(req.body.query)}` : ""}`,
        organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
        entityType: "instructor",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId(req.user.id),
        type: "EXPORT",
        severity: "INFO",
        entity: {
          type: "INSTRUCTOR",
          id: new mongoose.Types.ObjectId(),
        },
        changes: {
          before: {},
          after: { filename: `${filename}.csv` },
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Exported instructors data to ${filename}.csv`,
        organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
      });
    }

    sendCSVResponse(res, csv, filename);
  } catch (error) {
    console.error("Error exporting instructor data:", error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "An unexpected error occurred",
      status: "error",
      details: error instanceof Error ? error.stack : String(error),
    });
  }
}
