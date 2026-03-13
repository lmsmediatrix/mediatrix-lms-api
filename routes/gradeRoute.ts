import express, { Request, Response } from "express";
import { API_ENDPOINTS } from "../config/endpointsConfig";
import gradeService from "../services/gradeService";
import { GradeZodSchema } from "../models/gradeModel";
import { handleZodError } from "../middleware/zodErrorHandler";
import { ValidationSchemas } from "../helper/validationSchemas";
import { z } from "zod";
import { CustomRequest } from "../type/types";
import { ACTION, config, USER_ROLES } from "../config/common";
import { validatePermissions } from "../middleware/rabcMiddleware";
import activityLogService from "../services/activityLogService";
import auditLogService from "../services/auditLogService";
import mongoose from "mongoose";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Grades
 *   description: Grade management endpoints for handling student grades and assessments
 */

/**
 * @swagger
 * /api/grade/get/all:
 *   get:
 *     summary: Get all grades
 *     description: Retrieve a list of all grades with optional filtering, sorting, and pagination
 *     tags: [Grades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: object
 *         description: Query parameters for filtering grades
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
 *         description: List of grades retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Grades retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Grade'
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
  API_ENDPOINTS.GRADE.GET_ALL,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN],
    ACTION.GET_ALL
  ),
  getGrades
);

/**
 * @swagger
 * /api/grade/get/{id}:
 *   get:
 *     summary: Get grade by ID
 *     description: Retrieve detailed information about a specific grade
 *     tags: [Grades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Grade ID
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
 *         description: Grade retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Grade'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Grade not found
 *       500:
 *         description: Internal server error
 */
router.get(
  API_ENDPOINTS.GRADE.GET_BY_ID,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN],
    ACTION.GET_BY_ID
  ),
  getGrade
);

/**
 * @swagger
 * /api/grade/create:
 *   post:
 *     summary: Create a new grade
 *     description: Create a new grade record for a student's assessment
 *     tags: [Grades]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - studentId
 *               - assessmentId
 *               - score
 *             properties:
 *               studentId:
 *                 type: string
 *                 description: ID of the student
 *               assessmentId:
 *                 type: string
 *                 description: ID of the assessment
 *               score:
 *                 type: number
 *                 description: Grade score
 *               feedback:
 *                 type: string
 *                 description: Optional feedback for the grade
 *     responses:
 *       200:
 *         description: Grade created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Grade'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Internal server error
 */
router.post(
  API_ENDPOINTS.GRADE.CREATE,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.CREATE),
  createGrade
);

/**
 * @swagger
 * /api/grade/update:
 *   put:
 *     summary: Update a grade
 *     description: Update an existing grade record
 *     tags: [Grades]
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
 *                 description: Grade ID
 *               studentId:
 *                 type: string
 *                 description: ID of the student
 *               assessmentId:
 *                 type: string
 *                 description: ID of the assessment
 *               score:
 *                 type: number
 *                 description: Updated grade score
 *               feedback:
 *                 type: string
 *                 description: Updated feedback for the grade
 *     responses:
 *       200:
 *         description: Grade updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Grade'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Grade not found
 *       500:
 *         description: Internal server error
 */
router.put(
  API_ENDPOINTS.GRADE.UPDATE,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.UPDATE),
  updateGrade
);

/**
 * @swagger
 * /api/grade/remove/{id}:
 *   delete:
 *     summary: Delete a grade
 *     description: Permanently delete a grade record
 *     tags: [Grades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Grade ID to delete
 *     responses:
 *       200:
 *         description: Grade deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Grade'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Grade not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  API_ENDPOINTS.GRADE.REMOVE,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.DELETE),
  deleteGrade
);

/**
 * @swagger
 * /api/grade/search:
 *   post:
 *     summary: Search grades
 *     description: Search for grades based on specified criteria
 *     tags: [Grades]
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
 *                 example: { "score": { "$gte": 80 } }
 *     responses:
 *       200:
 *         description: List of grades matching search criteria
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Grade'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Internal server error
 */
router.post(
  API_ENDPOINTS.GRADE.SEARCH,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.SEARCH),
  searchGrade
);

/**
 * @swagger
 * /api/grade/archive/{id}:
 *   put:
 *     summary: Archive a grade
 *     description: Soft delete a grade by marking it as archived
 *     tags: [Grades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Grade ID to archive
 *     responses:
 *       200:
 *         description: Grade archived successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Grade archived successfully
 *                 data:
 *                   $ref: '#/components/schemas/Grade'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Grade not found
 *       500:
 *         description: Internal server error
 */
router.put(
  API_ENDPOINTS.GRADE.ARCHIVE,
  validatePermissions(
    [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN, USER_ROLES.INSTRUCTOR],
    ACTION.ARCHIVE
  ),
  archiveGrade
);

export default router;

/*
 * @desc   get all assessment
 * @route  GET /api/assessment/get/all
 * @access Private
 */
export async function getGrades(req: Request, res: Response) {
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

    const { grades, pagination, count } = await gradeService.getGrades(params);

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
          title: "Grade Management - View All Grades",
        },
        action: "read",
        description: `Retrieved ${grades} grades${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "grade",
        createdAt: new Date(),
      });
    }

    res.status(200).send({
      message: config.SUCCESS.GRADES.GET_ALL,
      data: grades,
      pagination,
      count,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   get assessment by id
 * @route  GET /api/assessment/get/:id
 * @access Private
 */
export async function getGrade(req: Request, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });
    const params = ValidationSchemas.getQueryParams.parse({
      populateArray: req.query.populateArray ? JSON.parse(req.query.populateArray as string) : [],
      select: Array.isArray(req.query.select)
        ? req.query.select
        : [req.query.select].filter(Boolean),
      lean: req.query.lean,
    });

    const assessment = await gradeService.getGrade(id, params);

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
          title: "Grade Management - View Grade Details",
        },
        action: "read",
        description: `Retrieved grade with ID: ${id}${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "grade",
        createdAt: new Date(),
      });
    }

    res.status(200).send(assessment);
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   create assessment
 * @route  POST /api/assessment/create
 * @access Private
 */
export async function createGrade(req: CustomRequest, res: Response) {
  if (!req.user) {
    return Promise.reject(new Error("User not found"));
  }

  try {
    const validatedData = GradeZodSchema.partial().parse(req.body);
    const newGrade = await gradeService.createGrade(validatedData, req.user);

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
        title: "Grade Management - Create New Grade",
      },
      action: "create",
      description: `Created new grade with ID: ${newGrade._id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      entityType: "grade",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(req.user.id),
      type: "CREATE",
      severity: "INFO",
      entity: {
        type: "GRADE",
        id: newGrade._id,
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
      description: `Created new grade for ${validatedData._id || "unknown Id"}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });

    res.status(200).send(newGrade);
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   update assessment
 * @route  PUT /api/assessment/update
 * @access Private
 */
export async function updateGrade(req: CustomRequest, res: Response) {
  try {
    if (!req.user) throw new Error("User not found");

    const validatedData = GradeZodSchema.partial()
      .extend({ _id: z.string().min(1) })
      .parse(req.body);

    const currentGrade = await gradeService.getGrade(validatedData._id, {
      select: Object.keys(req.body).filter((key) => key !== "_id"),
    });

    const updatedGrade = await gradeService.updateGrade(validatedData);

    if (!updatedGrade) {
      throw new Error("Failed to update grade");
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
        title: "Grade Management - Update Grade",
      },
      action: "update",
      description: `Updated grade with ID: ${updatedGrade._id} with fields: ${Object.keys(validatedData).join(", ")}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      entityType: "grade",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(req.user.id),
      type: "UPDATE",
      severity: "INFO",
      entity: {
        type: "GRADE",
        id: updatedGrade._id,
      },
      changes: {
        before: currentGrade || {},
        after: updatedGrade,
      },
      metadata: {
        userAgent: req.get("user-agent"),
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      description: `Updated grade for ${updatedGrade._id || "unknown Id"}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });

    res.status(200).send(updatedGrade);
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   remove assessment
 * @route  DELETE /api/assessment/remove/:id
 * @access Private
 */
export async function deleteGrade(req: CustomRequest, res: Response) {
  try {
    if (!req.user) throw new Error("User not found");

    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    const currentGrade = await gradeService.getGrade(id, {
      select: ["studentId"],
    });

    if (!currentGrade) {
      return res.status(404).json({ message: "Grade not found" });
    }

    const deletedGrade = await gradeService.deleteGrade(id);

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
        title: "Grade Management - Delete Grade",
      },
      action: "remove",
      description: `Deleted grade with ID: ${currentGrade._id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      entityType: "grade",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(req.user.id),
      type: "DELETE",
      severity: "INFO",
      entity: {
        type: "GRADE",
        id: new mongoose.Types.ObjectId(id),
      },
      changes: {
        before: currentGrade,
        after: {},
      },
      metadata: {
        userAgent: req.get("user-agent"),
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      description: `Deleted grade for ${currentGrade._id || "unknown Id"}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });

    res.status(200).send(deletedGrade);
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   search assessment
 * @route  POST /api/assessment/search
 * @access Private
 */
export async function searchGrade(req: Request, res: Response) {
  try {
    const searchResult = await gradeService.searchGrade(req.body);

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
          title: "Grade Management - Search Grades",
        },
        action: "read",
        description: `Searched grades with criteria: ${searchCriteria || "none"} (found ${searchResult?.length} results)`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "grade",
        createdAt: new Date(),
      });
    }

    res.status(200).send(searchResult);
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   archive grade (soft delete)
 * @route  PUT /api/grade/archive/:id
 * @access Private (Admin, SuperAdmin, Instructor)
 */
export async function archiveGrade(req: CustomRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "User not authenticated" });
  }

  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    const archivedGrade = await gradeService.archiveGrade(id);

    if (!archivedGrade) {
      return res.status(404).json({ message: "Grade not found" });
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
        title: "Grade Management - Archive Grade",
      },
      action: "archive",
      description: `Archived grade with ID: ${id}`,
      organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
      entityType: "grade",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(req.user.id),
      type: "UPDATE",
      severity: "INFO",
      entity: {
        type: "GRADE",
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
      description: `Archived grade with ID ${id}`,
    });

    res.status(200).json({
      message: config.SUCCESS.GRADES.ARCHIVE,
      data: archivedGrade,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}
