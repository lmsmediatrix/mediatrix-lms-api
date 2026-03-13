import express, { Request, Response } from "express";
import { API_ENDPOINTS } from "../config/endpointsConfig";
import courseService from "../services/courseService";
import { CourseZodSchema } from "../models/courseModel";
import { handleZodError } from "../middleware/zodErrorHandler";
import { ValidationSchemas } from "../helper/validationSchemas";
import { z } from "zod";
import { upload } from "../middleware/multer";
import { CustomRequest } from "../type/types";
import { ACTION, config, USER_ROLES } from "../config/common";
import { validatePermissions } from "../middleware/rabcMiddleware";
import activityLogService from "../services/activityLogService";
import auditLogService from "../services/auditLogService";
import mongoose from "mongoose";
import { parseCSVBuffer } from "../utils/csvUtils/csvUtils";
import { sendCSVResponse } from "../utils/csvUtils/csvResponse";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Courses
 *   description: Course management endpoints for handling course creation, updates, and administration
 */

/**
 * @swagger
 * /api/course/get/all:
 *   get:
 *     summary: Get all courses
 *     description: Retrieve a list of all courses with optional filtering, sorting, and pagination
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: "JSON string of query parameters for filtering courses"
 *       - in: query
 *         name: queryArray
 *         schema:
 *           type: string
 *         description: "Comma-separated list of query array parameters"
 *       - in: query
 *         name: queryArrayType
 *         schema:
 *           type: string
 *         description: "Comma-separated list of query array types"
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: "Space-separated list of fields to populate"
 *       - in: query
 *         name: populateSelect
 *         schema:
 *           type: string
 *         description: "Comma-separated list of fields to select for populated documents"
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: "Sort criteria (e.g., 'createdAt:desc')"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: "Number of records to return"
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *         description: "Number of records to skip"
 *       - in: query
 *         name: select
 *         schema:
 *           type: string
 *         description: "Comma-separated list of fields to select"
 *       - in: query
 *         name: lean
 *         schema:
 *           type: boolean
 *         description: "Whether to return plain JavaScript objects"
 *       - in: query
 *         name: count
 *         schema:
 *           type: boolean
 *         description: "Whether to return total count"
 *       - in: query
 *         name: pagination
 *         schema:
 *           type: boolean
 *         description: "Whether to return pagination information"
 *       - in: query
 *         name: document
 *         schema:
 *           type: boolean
 *         description: "Whether to return the document"
 *     responses:
 *       200:
 *         description: "List of courses retrieved successfully"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Courses retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Course'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: "Total number of records"
 *                     page:
 *                       type: integer
 *                       description: "Current page number"
 *                     limit:
 *                       type: integer
 *                       description: "Number of records per page"
 *                 count:
 *                   type: integer
 *                   description: "Total count of records"
 *       401:
 *         description: "Unauthorized - User not authenticated"
 *       500:
 *         description: "Server error"
 */
router.get(
  API_ENDPOINTS.COURSE.GET_ALL,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN],
    ACTION.GET_ALL
  ),
  getCourses
);

/**
 * @swagger
 * /api/course/get/{id}:
 *   get:
 *     summary: Get course by ID
 *     description: Retrieve a specific course by its unique identifier
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Course ID"
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: "Space-separated list of fields to populate"
 *       - in: query
 *         name: populateSelect
 *         schema:
 *           type: string
 *         description: "Comma-separated list of fields to select for populated documents"
 *       - in: query
 *         name: select
 *         schema:
 *           type: string
 *         description: "Comma-separated list of fields to select"
 *       - in: query
 *         name: lean
 *         schema:
 *           type: boolean
 *         description: "Whether to return plain JavaScript objects"
 *     responses:
 *       200:
 *         description: "Course retrieved successfully"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Course retrieved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Course'
 *       401:
 *         description: "Unauthorized - User not authenticated"
 *       404:
 *         description: "Course not found"
 *       500:
 *         description: "Server error"
 */
router.get(
  API_ENDPOINTS.COURSE.GET_BY_ID,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN],
    ACTION.GET_BY_ID
  ),
  getCourse
);

/**
 * @swagger
 * /api/course/create:
 *   post:
 *     summary: Create a new course
 *     description: Create a new course with title, description, and optional thumbnail
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *             properties:
 *               title:
 *                 type: string
 *                 description: "Course title"
 *               description:
 *                 type: string
 *                 description: "Course description"
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *                 description: "Course thumbnail image (supported formats: jpg, jpeg, png)"
 *               path:
 *                 type: string
 *                 description: "Course path"
 *     responses:
 *       200:
 *         description: "Course created successfully"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Course created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Course'
 *       400:
 *         description: "Invalid input - Missing required fields or invalid data"
 *       401:
 *         description: "Unauthorized - User not authenticated"
 *       500:
 *         description: "Server error"
 */
router.post(
  API_ENDPOINTS.COURSE.CREATE,
  upload.fields([{ name: "thumbnail", maxCount: 1 }]),
  validatePermissions([USER_ROLES.ADMIN], ACTION.CREATE),
  createCourse
);

/**
 * @swagger
 * /api/course/update:
 *   put:
 *     summary: Update a course
 *     description: Update an existing course's details and optional thumbnail
 *     tags: [Courses]
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
 *                 description: "Course ID"
 *               title:
 *                 type: string
 *                 description: "Course title"
 *               description:
 *                 type: string
 *                 description: "Course description"
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *                 description: "Course thumbnail image (supported formats: jpg, jpeg, png)"
 *               path:
 *                 type: string
 *                 description: "Course path"
 *     responses:
 *       200:
 *         description: "Course updated successfully"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Course updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Course'
 *       400:
 *         description: "Invalid input - Missing required fields or invalid data"
 *       401:
 *         description: "Unauthorized - User not authenticated"
 *       404:
 *         description: "Course not found"
 *       500:
 *         description: "Server error"
 */
router.put(
  API_ENDPOINTS.COURSE.UPDATE,
  upload.fields([{ name: "thumbnail", maxCount: 1 }]),
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR], ACTION.UPDATE),
  updateCourse
);

/**
 * @swagger
 * /api/course/remove/{id}:
 *   delete:
 *     summary: Delete a course
 *     description: Permanently delete a course and all its associated data
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Course ID"
 *     responses:
 *       200:
 *         description: "Course deleted successfully"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Course deleted successfully"
 *       401:
 *         description: "Unauthorized - User not authenticated"
 *       404:
 *         description: "Course not found"
 *       500:
 *         description: "Server error"
 */
router.delete(
  API_ENDPOINTS.COURSE.REMOVE,
  validatePermissions([USER_ROLES.ADMIN], ACTION.DELETE),
  deleteCourse
);

/**
 * @swagger
 * /api/course/search:
 *   post:
 *     summary: Search courses
 *     description: Search and filter courses using various criteria
 *     tags: [Courses]
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
 *                 description: "Search criteria"
 *                 properties:
 *                   title:
 *                     type: string
 *                     description: "Search by course title"
 *                   description:
 *                     type: string
 *                     description: "Search by course description"
 *                   isActive:
 *                     type: boolean
 *                     description: "Filter by active status"
 *                   organizationId:
 *                     type: string
 *                     description: "Filter by organization ID"
 *     responses:
 *       200:
 *         description: "Search results"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Course'
 *       401:
 *         description: "Unauthorized - User not authenticated"
 *       500:
 *         description: "Server error"
 */
router.post(
  API_ENDPOINTS.COURSE.SEARCH,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.SEARCH),
  searchCourse
);

/**
 * @swagger
 * /api/course/archive/{id}:
 *   put:
 *     summary: Archive a course
 *     description: Archive a course (soft delete) while preserving its data and history
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Course ID to archive"
 *     responses:
 *       200:
 *         description: "Course archived successfully"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Course archived successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Course'
 *       401:
 *         description: "Unauthorized - User not authenticated"
 *       404:
 *         description: "Course not found"
 *       500:
 *         description: "Server error"
 */
router.put(
  API_ENDPOINTS.COURSE.ARCHIVE,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN], ACTION.ARCHIVE),
  archiveCourse
);

/**
 * @swagger
 * /api/course/create/bulk:
 *   post:
 *     summary: Bulk create courses
 *     description: Create multiple courses from a CSV file
 *     tags: [Courses]
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
 *                 description: "CSV file containing course data (required columns: title, description)"
 *     responses:
 *       200:
 *         description: "Courses created successfully"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Successfully created 10 courses (2 failed)"
 *                 result:
 *                   type: object
 *                   properties:
 *                     successCount:
 *                       type: number
 *                       description: "Number of successfully created courses"
 *                     successList:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           code:
 *                             type: string
 *                           title:
 *                             type: string
 *                     errorCount:
 *                       type: number
 *                       description: "Number of failed creations"
 *                     errorList:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           errorMessage:
 *                             type: string
 *                           errorCode:
 *                             type: number
 *                           row:
 *                             type: number
 *       400:
 *         description: "Invalid input or CSV file"
 *       401:
 *         description: "Unauthorized - User not authenticated"
 *       500:
 *         description: "Server error"
 */
router.post(
  API_ENDPOINTS.COURSE.BULK_CREATE,
  validatePermissions([USER_ROLES.ADMIN], ACTION.CUSTOM),
  upload.single("file"),
  bulkCreateCourses
);

/**
 * @swagger
 * /api/course/export:
 *   post:
 *     summary: Export courses as CSV
 *     description: Export courses to CSV format with optional filtering and custom filename
 *     tags: [Courses]
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
 *                 description: "Query parameters for filtering courses"
 *                 properties:
 *                   title:
 *                     type: string
 *                     description: "Filter by course title"
 *                   isActive:
 *                     type: boolean
 *                     description: "Filter by active status"
 *                   organizationId:
 *                     type: string
 *                     description: "Filter by organization ID"
 *               filename:
 *                 type: string
 *                 description: "Custom filename for the exported CSV (without extension)"
 *     responses:
 *       200:
 *         description: "Courses exported successfully"
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: "Unauthorized or missing organization"
 *       500:
 *         description: "Server error"
 */
router.post(
  API_ENDPOINTS.COURSE.EXPORT,
  validatePermissions([USER_ROLES.ADMIN], ACTION.CUSTOM),
  exportCourses
);

export default router;

/*
 * @desc   get all course
 * @route  GET /api/course/get/all
 * @access Private
 */
export async function getCourses(req: CustomRequest, res: Response) {
  try {
    const params = ValidationSchemas.getQueriesParams.parse({
      query:
        typeof req.query.query === "string" ? JSON.parse(req.query.query) : req.query.query || {},
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

    const { courses, pagination, count } = await courseService.getCourses(params);

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
          title: "View All Courses",
        },
        action: "read",
        description: `Retrieved ${courses} courses${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "course",
        createdAt: new Date(),
      });
    }

    res
      .status(200)
      .send({ message: config.SUCCESS.COURSE.GET_ALL, data: courses, pagination, count });
  } catch (error) {
    handleZodError(error, res);
  }
}
/*
 * @desc   get course by id
 * @route  GET /api/course/get/:id
 * @access Private
 */
export async function getCourse(req: CustomRequest, res: Response) {
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
    const course = await courseService.getCourse(id, dbParams);
    if (!course) {
      return res.status(404).send({ message: "Course not found" });
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
          title: "View Course Details",
        },
        action: "read",
        description: `Retrieved course with ID: ${id}${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "course",
        createdAt: new Date(),
      });
    }
    res.status(200).send({ message: config.SUCCESS.COURSE.GET_BY_ID, data: course });
  } catch (error) {
    handleZodError(error, res);
  }
}
/*
 * @desc   create course
 * @route  POST /api/course/create
 * @access Private
 */
export async function createCourse(req: CustomRequest, res: Response) {
  try {
    const user = req.user;
    if (!user) throw new Error("User not found");
    const validatedData = CourseZodSchema.partial()
      .extend({ path: z.string().optional() })
      .parse(req.body);
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const newCourse = await courseService.createCourse(validatedData, files, user);

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
        title: "Create New Course",
      },
      action: "create",
      description: `Created new course: ${newCourse.title}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      entityType: "course",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(user.id),
      type: "CREATE",
      severity: "INFO",
      entity: {
        type: "COURSE",
        id: newCourse._id,
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
      description: `Created new course ${newCourse.title}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });

    res.status(200).send({ message: config.SUCCESS.COURSE.CREATE, data: newCourse });
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   update course
 * @route  PUT /api/course/update
 * @access Private
 */
export async function updateCourse(req: Request, res: Response) {
  try {
    const validatedData = CourseZodSchema.partial()
      .extend({ _id: z.string().min(1) })
      .parse(req.body);
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const updatedCourse = await courseService.updateCourse(validatedData, files);

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
        title: "Update Course",
      },
      action: "update",
      description: updatedCourse
        ? `Updated course: ${updatedCourse.title} with fields: ${Object.keys(validatedData).join(", ")}`
        : "Updated course (not found)",
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      entityType: "course",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId((req as any).user?.id),
      type: "UPDATE",
      severity: "INFO",
      entity: {
        type: "COURSE",
        id: updatedCourse?._id || new mongoose.Types.ObjectId(),
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
      description: updatedCourse
        ? `Updated course ${updatedCourse.title}`
        : "Updated course (not found)",
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });

    res.status(200).send({ message: config.SUCCESS.COURSE.UPDATE, data: updatedCourse });
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   remove course
 * @route  DELETE /api/course/remove/:id
 * @access Private
 */
export async function deleteCourse(req: Request, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });
    await courseService.deleteCourse(id);

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
        title: "Delete Course",
      },
      action: "delete",
      description: `Deleted course with ID: ${id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user?.organizationId || null),
      entityType: "course",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId((req as any).user?.id),
      type: "DELETE",
      severity: "INFO",
      entity: {
        type: "COURSE",
        id: new mongoose.Types.ObjectId(id),
      },
      changes: {
        before: {},
        after: {},
      },
      metadata: {
        userAgent: req.get("user-agent"),
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      description: `Deleted course with ID ${id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });

    res.status(200).send({ message: config.SUCCESS.COURSE.DELETE });
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   search course
 * @route  POST /api/course/search
 * @access Private
 */
export async function searchCourse(req: Request, res: Response) {
  try {
    const searchCourse = await courseService.searchCourse(req.body);

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
          title: "Search Courses",
        },
        action: "search",
        description: `Searched courses with criteria: ${JSON.stringify(req.body)} (found ${searchCourse?.length || 0} results)`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "course",
        createdAt: new Date(),
      });
    }

    res.status(200).send(searchCourse);
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   archive course (soft delete)
 * @route  PUT /api/course/archive/:id
 * @access Private (Admin, SuperAdmin)
 */
export async function archiveCourse(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "User not authenticated or missing organization" });
    }

    const archivedCourse = await courseService.archiveCourse(id);

    if (!archivedCourse) {
      return res.status(404).json({ message: "Course not found" });
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
        title: "Archive Course",
      },
      action: "archive",
      description: `Archived course with ID: ${id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      entityType: "course",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(req.user.id),
      type: "UPDATE",
      severity: "INFO",
      entity: {
        type: "COURSE",
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
      description: `Archived course with ID ${id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });

    res.status(200).json({
      message: config.SUCCESS.COURSE.ARCHIVE,
      data: archivedCourse,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   bulk create courses
 * @route  POST /api/course/create/bulk
 * @access Private (Admin only)
 */
export async function bulkCreateCourses(req: CustomRequest, res: Response) {
  try {
    let result;
    if (req.file) {
      try {
        const csvData = await parseCSVBuffer(req.file.buffer);

        if (!csvData || csvData.length === 0) {
          return res.status(400).send({
            message: "CSV file contains no valid data",
          });
        }
        result = await courseService.bulkCreateCourses({
          csvData,
          organizationId: (req as any).user.organizationId,
        });

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
              title: "Bulk Create Courses",
            },
            action: "create",
            description: `Bulk created ${csvData.length} courses via CSV import (${result.successCount} successful, ${result.errorCount} failed)`,
            organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
            entityType: "course",
            createdAt: new Date(),
          });
        }

        await auditLogService.createAuditLog({
          user: (req as any).user.id as unknown as mongoose.Types.ObjectId,
          type: "CREATE",
          severity: "INFO",
          entity: {
            type: "COURSE",
            id: new mongoose.Types.ObjectId(),
          },
          changes: {
            before: {},
            after: {
              bulkOperation: {
                csvImport: true,
                recordCount: csvData.length,
                successCount: result.successCount,
                errorCount: result.errorCount,
              },
            },
          },
          metadata: {
            userAgent: req.get("user-agent"),
            ip: req.ip,
            path: req.path,
            method: req.method,
          },
          description: `Bulk created ${result.successCount} courses via CSV import`,
          organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        });
      } catch (error) {
        console.error("Error processing CSV data:", error);
        return res.status(400).send({
          message: "Failed to process CSV file",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      throw new Error("No CSV file provided for bulk creation");
    }

    res.status(200).send({
      message: `Successfully created ${result.successCount} courses (${result.errorCount} failed)`,
      result: result,
    });
  } catch (error) {
    console.error("Error bulk creating courses:", error);
    handleZodError(error, res);
  }
}

/*
 * @desc   export courses as CSV
 * @route  POST /api/course/export
 * @access Private
 */
export async function exportCourses(req: CustomRequest, res: Response) {
  try {
    const requestBody = { ...req.body };
    if (req.user && req.user.id) {
      requestBody.currentUserId = req.user.id;
    }

    let filename = "courses";
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
    const csv = await courseService.exportCourse(requestBody, organizationId);

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
          title: "Export Courses",
        },
        action: "export",
        description: `Exported courses to CSV${requestBody.query ? ` with filters: ${JSON.stringify(requestBody.query)}` : ""}`,
        organizationId: new mongoose.Types.ObjectId(organizationId),
        entityType: "course",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId(req.user.id),
        type: "EXPORT",
        severity: "INFO",
        entity: {
          type: "COURSE",
          id: new mongoose.Types.ObjectId(),
        },
        changes: {
          before: {},
          after: {
            exportDetails: {
              filename,
              filters: requestBody.query || {},
              timestamp: new Date(),
            },
          },
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Exported courses to CSV file: ${filename}`,
        organizationId: new mongoose.Types.ObjectId(organizationId),
      });
    }

    sendCSVResponse(res, csv, filename);
  } catch (error) {
    console.error("Error exporting course data:", error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "An unexpected error occurred",
      status: "error",
      details: error instanceof Error ? error.stack : String(error),
    });
  }
}
