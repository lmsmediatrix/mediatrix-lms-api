import express, { Request, Response } from "express";
import { API_ENDPOINTS } from "../config/endpointsConfig";
import studentService from "../services/studentService";
import { handleZodError } from "../middleware/zodErrorHandler";
import { ValidationSchemas } from "../helper/validationSchemas";
import { z } from "zod";
import { StudentZodSchema } from "../models/studentModel";
import mongoose, { Types } from "mongoose";
import { upload } from "../middleware/multer";
import { validatePermissions } from "../middleware/rabcMiddleware";
import { ACTION, config, USER_ROLES } from "../config/common";
import { CustomRequest } from "../type/types";
import unifiedAuthMiddleware from "../middleware/authMiddleware";
import { processStudentFormData } from "../helper/formDataHelper";
import activityLogService from "../services/activityLogService";
import auditLogService from "../services/auditLogService";
import { parseCSVBuffer } from "../utils/csvUtils/csvUtils";
import sectionService from "../services/sectionService";
import { sendCSVResponse } from "../utils/csvUtils/csvResponse";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Students
 *   description: Student management endpoints for handling student profiles, enrollments, grades, and related operations
 */

/**
 * @swagger
 * /api/student/get/all:
 *   get:
 *     summary: Get all students
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: object
 *         description: Query parameters for filtering students
 *       - in: query
 *         name: queryArray
 *         schema:
 *           type: array
 *         description: Array of query parameters
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: Fields to populate
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
 *           type: array
 *           items:
 *             type: string
 *         description: Fields to select
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
 *         description: List of students retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Student'
 *                 pagination:
 *                   type: object
 *                 count:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.STUDENT.GET_ALL,
  validatePermissions(
    [USER_ROLES.SUPERADMIN, USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN],
    ACTION.GET_ALL
  ),
  getStudents
);

/**
 * @swagger
 * /api/student/get/{id}:
 *   get:
 *     summary: Get student by ID
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Student ID
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: Fields to populate
 *       - in: query
 *         name: select
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Fields to select
 *     responses:
 *       200:
 *         description: Student retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Student'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Student not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.STUDENT.GET_BY_ID,
  validatePermissions(
    [USER_ROLES.SUPERADMIN, USER_ROLES.STUDENT, USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR],
    ACTION.GET_BY_ID
  ),
  getStudent
);

/**
 * @swagger
 * /api/student/create:
 *   post:
 *     summary: Create a new student
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *               studentId:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               organizationId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Student created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Student'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.STUDENT.CREATE,
  upload.fields([{ name: "avatar", maxCount: 1 }]),
  unifiedAuthMiddleware,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN], ACTION.CREATE),
  createStudent
);

/**
 * @swagger
 * /api/student/update:
 *   put:
 *     summary: Update a student
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *               avatar:
 *                 type: string
 *                 format: binary
 *               studentId:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Student updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Student'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.STUDENT.UPDATE,
  upload.fields([{ name: "avatar", maxCount: 1 }]),
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.UPDATE),
  updateStudent
);

/**
 * @swagger
 * /api/student/remove/{id}:
 *   delete:
 *     summary: Delete a student
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Student ID
 *     responses:
 *       200:
 *         description: Student deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Student'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Student not found
 *       500:
 *         description: Server error
 */
router.delete(
  API_ENDPOINTS.STUDENT.REMOVE,
  validatePermissions([USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN], ACTION.DELETE),
  deleteStudent
);

/**
 * @swagger
 * /api/student/search:
 *   post:
 *     summary: Search students
 *     tags: [Students]
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
 *     responses:
 *       200:
 *         description: List of students matching search criteria
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Student'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.STUDENT.SEARCH,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.SEARCH),
  searchStudent
);

/**
 * @swagger
 * /api/student/bulk-import:
 *   post:
 *     summary: Bulk import students from CSV
 *     tags: [Students]
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
 *                 description: CSV file containing student data
 *     responses:
 *       200:
 *         description: Students imported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 result:
 *                   type: object
 *       400:
 *         description: No file uploaded
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.STUDENT.BULK_IMPORT,
  upload.single("file"),
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR], ACTION.CUSTOM),
  bulkImportStudent
);

/**
 * @swagger
 * /api/student/export:
 *   post:
 *     summary: Export students as CSV
 *     tags: [Students]
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
 *                 description: Query parameters for filtering students
 *               filename:
 *                 type: string
 *                 description: Custom filename for the exported CSV
 *     responses:
 *       200:
 *         description: Students exported successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.STUDENT.EXPORT,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR], ACTION.CUSTOM),
  exportStudents
);

/**
 * @swagger
 * /api/student/calendar/mockup:
 *   get:
 *     summary: Get student calendar mockup data
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: view
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *         description: Calendar view type
 *     responses:
 *       200:
 *         description: Calendar mockup data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 weekData:
 *                   type: object
 *                 dayData:
 *                   type: object
 *                 monthData:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.STUDENT.STUDENT_CALENDAR_MOCKUP,
  validatePermissions(
    [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR],
    ACTION.CUSTOM
  ),
  getStudentCalendar
);

/**
 * @swagger
 * /api/student/dashboard:
 *   get:
 *     summary: Get student dashboard data
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: Fields to populate
 *       - in: query
 *         name: select
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Fields to select
 *     responses:
 *       200:
 *         description: Student dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Student'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Student not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.STUDENT.DASHBOARD,
  validatePermissions([USER_ROLES.STUDENT], ACTION.GET_ALL),
  studentDashboard
);

/**
 * @swagger
 * /api/student/calendar/{id}:
 *   get:
 *     summary: Get student calendar data
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Student ID
 *       - in: query
 *         name: view
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *         description: Calendar view type
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: Fields to populate
 *     responses:
 *       200:
 *         description: Student calendar data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Student'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Student not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.STUDENT.STUDENT_CALENDAR,
  validatePermissions([USER_ROLES.STUDENT], ACTION.GET_BY_ID),
  studentCalendar
);

/**
 * @swagger
 * /api/student/grade/{sectionCode}:
 *   get:
 *     summary: Get student grades by section
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Section code
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: Fields to populate
 *       - in: query
 *         name: select
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Fields to select
 *     responses:
 *       200:
 *         description: Student grades retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Student'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Student not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.STUDENT.STUDENT_GRADE_BY_SECTION,
  validatePermissions(
    [USER_ROLES.ADMIN, USER_ROLES.ADMIN, USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR],
    ACTION.UPDATE
  ),
  getStudentGradeBySection
);

/**
 * @swagger
 * /api/student/archive/{id}:
 *   put:
 *     summary: Archive a student (soft delete)
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Student ID to archive
 *     responses:
 *       200:
 *         description: Student archived successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Student archived successfully
 *                 data:
 *                   $ref: '#/components/schemas/Student'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Student not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.STUDENT.ARCHIVE,
  validatePermissions(
    [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN, USER_ROLES.INSTRUCTOR],
    ACTION.ARCHIVE
  ),
  archiveStudent
);

/**
 * @swagger
 * /api/student/grade/export/{sectionCode}:
 *   get:
 *     summary: Export student grades for a section as CSV
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Section code
 *     responses:
 *       200:
 *         description: CSV file containing student grades
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Section not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.STUDENT.EXPORT_STUDENT_GRADE,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.CUSTOM),
  exportStudentGrade
);

export default router;

export async function getStudents(req: CustomRequest, res: Response) {
  try {
    const hasSelectQuery = typeof req.query.select !== "undefined";
    const hasCountQuery = typeof req.query.count !== "undefined";
    const hasDocumentQuery = typeof req.query.document !== "undefined";
    const hasPaginationQuery = typeof req.query.pagination !== "undefined";

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
      sort: typeof req.query.sort === "string" ? req.query.sort : undefined,
      limit: req.query.limit,
      select: hasSelectQuery
        ? Array.isArray(req.query.select)
          ? req.query.select
          : [req.query.select].filter(Boolean)
        : undefined,
      lean: req.query.lean,
      skip: req.query.skip,
      count: hasCountQuery ? req.query.count === "true" : true,
      document: hasDocumentQuery ? req.query.document === "true" : true,
      pagination: hasPaginationQuery ? req.query.pagination === "true" : true,
    });

    if (!params.query) params.query = {};
    if (!req.user || !req.user.organizationId) {
      throw new Error("User not authenticated or missing organization");
    }
    params.query.organizationId = req.user.organizationId;

    const { students, pagination, count } = await studentService.getStudents(params);
    res
      .status(200)
      .send({ message: config.SUCCESS.STUDENT.GET_ALL, data: students, pagination, count });
    if (req.user) {
      const organizationId =
        req.user.organizationId && mongoose.Types.ObjectId.isValid(req.user.organizationId)
          ? new mongoose.Types.ObjectId(req.user.organizationId)
          : undefined;

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
          title: "Student Management - View All Students",
        },
        action: "read",
        description: `Retrieved ${students.length} students${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId,
        entityType: "student",
        createdAt: new Date(),
      });
    }
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getStudent(req: CustomRequest, res: Response) {
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

    const student = await studentService.getStudent(id, dbParams);

    if (!student) {
      return res.status(404).send({ message: "Student not found" });
    }

    res.status(200).send({ message: config.SUCCESS.STUDENT.GET_BY_ID, data: student });

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
          title: "Student Management - View Student Details",
        },
        action: "read",
        description: `Viewed student details for ${student.studentId || id}${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "student",
        createdAt: new Date(),
      });
    }
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function createStudent(req: Request, res: Response) {
  try {
    const { error, details, processedData } = processStudentFormData(req.body);

    if (error) {
      return res.status(400).json({ message: error, details });
    }

    const validatedData = StudentZodSchema.partial()
      .extend({
        path: z.string().optional(),
        organizationId: z.string().min(1),
        program: z.custom<Types.ObjectId>().optional(),
        studentId: z.string().optional(),
      })
      .parse({
        ...processedData,
        organizationId: (req as any).user.organizationId,
      });

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const newStudent = await studentService.createStudent(validatedData, files);

    res.status(201).send({ message: config.SUCCESS.STUDENT.CREATE, data: newStudent });

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
          title: "Student Management - Create New Student",
        },
        action: "create",
        description: `Created new student: ${newStudent.studentId} (${newStudent.firstName} ${newStudent.lastName})`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "student",
        createdAt: new Date(),
      });
    }

    const studentDetails = {
      studentId: newStudent.studentId,
      firstName: newStudent.firstName,
      lastName: newStudent.lastName,
      email: newStudent.email,
      organizationId: newStudent.organizationId,
      avatar: newStudent.avatar,
    };

    await auditLogService.createAuditLog({
      user: (req as any).user?.id,
      type: "CREATE",
      severity: "INFO",
      entity: {
        type: "STUDENT",
        id: newStudent._id,
      },
      changes: {
        before: {},
        after: studentDetails,
      },
      metadata: {
        userAgent: req.get("user-agent"),
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      description: `Created new student ${studentDetails.studentId} (${studentDetails.firstName} ${studentDetails.lastName})`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });
  } catch (error) {
    console.error("Error creating student:", error);
    handleZodError(error, res);
  }
}

export async function updateStudent(req: Request, res: Response) {
  try {
    if (!(req as any).user?.organizationId) {
      throw new Error("User not authenticated or missing organization");
    }

    const { error, details, processedData } = processStudentFormData(req.body);

    if (error) {
      return res.status(400).json({ message: error, details });
    }

    const validatedData = StudentZodSchema.partial()
      .extend({ _id: z.string().min(1), path: z.string().optional() })
      .parse({
        ...processedData,
        organizationId: req.body.organizationId || (req as any).user.organizationId,
      });

    const fieldsToSelect = Object.keys(processedData || {});

    const currentStudent = await studentService.getStudent(validatedData._id, {
      query: { organizationId: (req as any).user.organizationId },
      select: fieldsToSelect,
    });

    const updateData = {
      ...validatedData,
      _id: new mongoose.Types.ObjectId(validatedData._id),
    };

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const updatedStudent = await studentService.updateStudent(updateData, files);

    res.status(200).send({ message: config.SUCCESS.STUDENT.UPDATE, data: updatedStudent });
    if ((req as any).user) {
      const updatedFields = fieldsToSelect.join(", ");

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
          title: "Student Management - Update Student",
        },
        action: "update",
        description: `Updated student ${updatedStudent?.studentId || validatedData._id} with fields: ${updatedFields}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "student",
        createdAt: new Date(),
      });
    }

    const before: Record<string, any> = {};
    const after: Record<string, any> = {};

    fieldsToSelect.forEach((field) => {
      if ((currentStudent as any)?.[field] !== (updatedStudent as any)?.[field]) {
        before[field] = (currentStudent as any)?.[field];
        after[field] = (updatedStudent as any)?.[field];
      }
    });

    const changes = Object.keys(after).map((field) => {
      const oldValue = before[field] || "not set";
      const newValue = after[field] || "not set";
      return `${field}: ${oldValue} → ${newValue}`;
    });

    await auditLogService.createAuditLog({
      user: (req as any).user.id,
      type: "UPDATE",
      severity: "INFO",
      entity: {
        type: "STUDENT",
        id: updatedStudent?._id as mongoose.Types.ObjectId,
      },
      changes: {
        before,
        after,
      },
      metadata: {
        userAgent: req.get("user-agent"),
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      description:
        changes.length > 0
          ? `Updated student ${updatedStudent?.studentId || ""} - Changed: ${changes.join(", ")}`
          : `Updated student ${updatedStudent?.studentId || ""} - No fields changed`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });
  } catch (error) {
    console.error("Error in updateStudent:", error);
    handleZodError(error, res);
  }
}

export async function deleteStudent(req: Request, res: Response) {
  try {
    if (!(req as any).user?.organizationId) {
      throw new Error("User not authenticated or missing organization");
    }

    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    const currentStudent = await studentService.getStudent(id, {
      query: { organizationId: (req as any).user.organizationId },
      select: ["studentId", "firstName", "lastName", "email", "organizationId", "avatar"],
    });

    if (!currentStudent) {
      throw new Error("Student not found");
    }

    const deletedStudent = await studentService.deleteStudent(id);

    res.status(200).send({ message: config.SUCCESS.STUDENT.DELETE, data: deletedStudent });

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
          title: "Student Management - Delete Student",
        },
        action: "remove",
        description: `Deleted student: ${currentStudent.studentId} (${currentStudent.firstName} ${currentStudent.lastName})`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "student",
        createdAt: new Date(),
      });
    }

    const studentDetails = {
      studentId: currentStudent.studentId || "No ID",
      firstName: currentStudent.firstName || "No first name",
      lastName: currentStudent.lastName || "No last name",
      email: currentStudent.email || "No email",
      organizationId: currentStudent.organizationId,
      avatar: currentStudent.avatar || "No avatar",
    };

    auditLogService
      .createAuditLog({
        user: new mongoose.Types.ObjectId((req as any).user.id),
        type: "DELETE",
        severity: "INFO",
        entity: {
          type: "STUDENT",
          id: new mongoose.Types.ObjectId(id),
        },
        changes: {
          before: studentDetails,
          after: {},
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Deleted student ${studentDetails.studentId} (${studentDetails.firstName} ${studentDetails.lastName})`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      })
      .catch((error) => {
        console.error("Error saving audit log:", error);
      });
  } catch (error) {
    console.error("Error in deleteStudent:", error);
    handleZodError(error, res);
  }
}

export async function searchStudent(req: Request, res: Response) {
  try {
    const searchStudent = await studentService.searchStudent(req.body);
    res.status(200).send(searchStudent);
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
          title: "Student Management - Search Students",
        },
        action: "read",
        description: `Searched students with criteria: ${searchCriteria || "none"} (found ${searchStudent?.length} results)`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "student",
        createdAt: new Date(),
      });
    }
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function bulkImportStudent(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).send({ message: "No CSV file uploaded" });
    }
    const organizationId = (req as any).user.organizationId;

    const data = await parseCSVBuffer(req.file.buffer);
    const result = await studentService.bulkImportStudent(data, organizationId, req);
    res.status(200).send({ message: config.SUCCESS.STUDENT.BULK_IMPORT, result });
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
          title: "Student Management - Bulk Import Students",
        },
        action: "create",
        description: `Bulk imported ${data.length} students`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "student",
        createdAt: new Date(),
      });
    }
    await auditLogService
      .createAuditLog({
        user: new mongoose.Types.ObjectId((req as any).user.id),
        type: "CREATE",
        severity: "INFO",
        entity: {
          type: "STUDENT",
          id: new mongoose.Types.ObjectId(),
        },
        changes: {
          before: {},
          after: {
            count: data.length,
            summary: `${data.length} students imported`,
          },
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Bulk imported ${data.length} students via CSV upload`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      })
      .catch((error) => {
        console.error("Error saving audit log for bulk import:", error);
      });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getStudentCalendar(req: Request, res: Response) {
  try {
    const { view } = req.query;

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
          title: "Student Management - View Calendar",
        },
        action: "read",
        description: `Viewed student calendar in ${view || "all"} view`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "student",
        createdAt: new Date(),
      });
    }

    const data = {
      weekData: {
        events: {
          "2025-02-23": [
            {
              id: 1,
              title: "Meeting title",
              startTime: "08:00",
              endTime: "09:00",
              participants: [
                {
                  id: 101,
                  name: "John Doe",
                  avatar: "https://ui-avatars.com/api/?name=John+Doe&background=random",
                },
                {
                  id: 102,
                  name: "Jane Doe",
                  avatar: "https://ui-avatars.com/api/?name=John+Doe&background=random",
                },
              ],
            },
            {
              id: 1,
              title: "Meeting title",
              startTime: "11:00",
              endTime: "12:00",
              participants: [
                {
                  id: 101,
                  name: "John Doe",
                  avatar: "https://ui-avatars.com/api/?name=John+Doe&background=random",
                },
                {
                  id: 102,
                  name: "Jane Doe",
                  avatar: "https://ui-avatars.com/api/?name=John+Doe&background=random",
                },
              ],
            },
          ],
          "2025-02-24": [
            {
              id: 2,
              title: "Conference",
              startTime: "10:00",
              endTime: "11:00",
              participants: [
                {
                  id: 103,
                  name: "Alice Smith",
                  avatar: "https://ui-avatars.com/api/?name=John+Doe&background=random",
                },
                {
                  id: 104,
                  name: "Bob Johnson",
                  avatar: "https://ui-avatars.com/api/?name=John+Doe&background=random",
                },
              ],
            },
          ],
          "2025-02-25": [
            {
              id: 3,
              title: "Meeting title",
              startTime: "08:00",
              endTime: "10:00",
              participants: [
                {
                  id: 101,
                  name: "John Doe",
                  avatar: "https://ui-avatars.com/api/?name=John+Doe&background=random",
                },
                {
                  id: 105,
                  name: "Emma Watson",
                  avatar: "https://ui-avatars.com/api/?name=John+Doe&background=random",
                },
              ],
            },
          ],
          "2025-02-26": [
            {
              id: 3,
              title: "Meeting title",
              startTime: "10:00",
              endTime: "12:00",
              participants: [
                {
                  id: 101,
                  name: "John Doe",
                  avatar: "https://ui-avatars.com/api/?name=John+Doe&background=random",
                },
                {
                  id: 105,
                  name: "Emma Watson",
                  avatar: "https://ui-avatars.com/api/?name=John+Doe&background=random",
                },
              ],
            },
          ],
          "2025-02-27": [
            {
              id: 3,
              title: "Meeting title",
              startTime: "08:00",
              endTime: "09:00",
              participants: [
                {
                  id: 101,
                  name: "John Doe",
                  avatar: "https://ui-avatars.com/api/?name=John+Doe&background=random",
                },
                {
                  id: 105,
                  name: "Emma Watson",
                  avatar: "https://ui-avatars.com/api/?name=John+Doe&background=random",
                },
              ],
            },
          ],
        },
        upcomingEvents: [
          {
            id: 1,
            title: "Team Meeting",
            date: "2023-10-16",
            startTime: "08:00",
            endTime: "09:00",
            location: "Room 01",
            participants: [
              {
                id: 101,
                name: "John Doe",
                avatar: "https://ui-avatars.com/api/?name=John+Doe&background=random",
              },
              {
                id: 102,
                name: "Jane Doe",
                avatar: "https://ui-avatars.com/api/?name=John+Doe&background=random",
              },
            ],
          },
          {
            id: 2,
            title: "Client Call",
            date: "2023-10-16",
            startTime: "14:00",
            endTime: "15:00",
            location: "Room 02",
            participants: [
              {
                id: 103,
                name: "Alice Smith",
                avatar: "https://ui-avatars.com/api/?name=John+Doe&background=random",
              },
              {
                id: 104,
                name: "Bob Johnson",
                avatar: "https://ui-avatars.com/api/?name=John+Doe&background=random",
              },
            ],
          },
        ],
      },

      dayData: {
        events: {
          "2025-02-28": [
            {
              id: 1,
              title: "Meeting title",
              startTime: "08:00",
              endTime: "09:00",
              participants: [
                {
                  id: 101,
                  name: "John Doe",
                  avatar: "https://ui-avatars.com/api/?name=John+Doe&background=random",
                },
                {
                  id: 102,
                  name: "Jane Doe",
                  avatar: "https://ui-avatars.com/api/?name=Jane+Doe&background=random",
                },
              ],
            },
          ],
        },
        upcomingEvents: [
          {
            id: 1,
            title: "Team Meeting",
            date: "2023-10-16",
            startTime: "08:00",
            endTime: "09:00",
            location: "Room 01",
            participants: [
              {
                id: 101,
                name: "John Doe",
                avatar: "https://ui-avatars.com/api/?name=John+Doe&background=random",
              },
              {
                id: 102,
                name: "Jane Doe",
                avatar: "https://ui-avatars.com/api/?name=Jane+Doe&background=random",
              },
            ],
          },
        ],
      },

      monthData: {
        events: {
          "2025-02-23": [
            {
              count: 4,
            },
          ],
        },
        upcomingEvents: [
          {
            id: 1,
            title: "Team Meeting",
            date: "2023-10-16",
            startTime: "08:00",
            endTime: "09:00",
            location: "Room 01",
            participants: [
              {
                id: 101,
                name: "John Doe",
                avatar: "https://ui-avatars.com/api/?name=John+Doe&background=random",
              },
              {
                id: 102,
                name: "Jane Doe",
                avatar: "https://ui-avatars.com/api/?name=John+Doe&background=random",
              },
            ],
          },
        ],
      },
    };

    let responseData;

    switch (view) {
      case "day":
        responseData = data.dayData;
        break;
      case "week":
        responseData = data.weekData;
        break;
      case "month":
        responseData = data.monthData;
        break;
      default:
        responseData = data;
    }

    return res.status(200).json(responseData);
  } catch (error) {
    handleZodError(error, res);
  }
}
export async function studentDashboard(req: CustomRequest, res: Response) {
  try {
    if (!req.user || !req.user.id || !req.user.organizationId) {
      throw new Error("User not authenticated or missing required information");
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

    const dbParams = {
      ...params,
      query: { organizationId: req.user.organizationId },
    };

    const student = await studentService.studentDashboard(req.user.id, dbParams);
    if (!student) {
      return res.status(404).send({ message: "Student data not found" });
    }

    res.status(200).send({ message: config.SUCCESS.STUDENT.GET_BY_ID, data: student });
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
          title: "Student Management - View Dashboard",
        },
        action: "read",
        description: `Student accessed their dashboard`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "student",
        createdAt: new Date(),
      });
    }
  } catch (error) {
    handleZodError(error, res);
  }
}
export async function studentCalendar(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });
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
      query: {
        organizationId: req.user.organizationId,
        view: (req.query.view as string) || "week",
      },
    };

    const student = await studentService.studentCalendar(id, dbParams);

    if (!student) {
      return res.status(404).send({ message: "Student not found" });
    }

    res.status(200).send({ message: config.SUCCESS.STUDENT.GET_BY_ID, data: student });
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
          title: "Student Management - View Calendar",
        },
        action: "read",
        description: `Student accessed their calendar (view: ${dbParams.query.view})`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "student",
        createdAt: new Date(),
      });
    }
  } catch (error) {
    handleZodError(error, res);
  }
}
export async function getStudentGradeBySection(req: CustomRequest, res: Response) {
  try {
    const { sectionCode } = { sectionCode: req.params.sectionCode };
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

    const student = await studentService.getStudentGradeBySection(sectionCode, dbParams);

    if (!student) {
      return res.status(404).send({ message: "Student not found" });
    }

    res.status(200).send(student);
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
          title: "Student Management - View Grades",
        },
        action: "read",
        description: `Retrieved student grades for section ${sectionCode}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "student",
        createdAt: new Date(),
      });
    }
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function archiveStudent(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "User not authenticated or missing organization" });
    }

    const archivedStudent = await studentService.archiveStudent(id);

    if (!archivedStudent) {
      return res.status(404).json({ message: "student not found" });
    }
    res.status(200).json({
      message: config.SUCCESS.STUDENT.ARCHIVE,
      data: archivedStudent,
    });

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
        title: "Student Management - Archive Student",
      },
      action: "archive",
      description: `Archived student with ID: ${id}`,
      organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
      entityType: "student",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(req.user.id),
      type: "UPDATE",
      severity: "INFO",
      entity: {
        type: "STUDENT",
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
      description: `Archived student with ID ${id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function exportStudents(req: CustomRequest, res: Response) {
  try {
    const requestBody = { ...req.body };
    if (req.user && req.user.id) {
      requestBody.currentUserId = req.user.id;
    }
    let filename = "students";
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
    const csv = await studentService.exportStudent(requestBody, organizationId);
    sendCSVResponse(res, csv, filename);
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
          title: "Student Management - Export Students",
        },
        action: "export",
        description: `Exported students list${req.query.filename ? ` as ${req.query.filename}` : ""}`,
        organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
        entityType: "student",
        createdAt: new Date(),
      });
    }
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "An unexpected error occurred",
      status: "error",
      details: error instanceof Error ? error.stack : String(error),
    });
  }
}

export async function exportStudentGrade(req: CustomRequest, res: Response) {
  function formatDate(dateStr: string | Date) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date
      .toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      })
      .replace(",", "");
  }

  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { sectionCode } = req.params;
    const userId = req.user.id;
    const result = await sectionService.getStudentGrades(sectionCode, userId);
    const headers = ["Assessment Type", "Points", "Due Date", "Status", "Grade"];
    const rows = [];
    rows.push([`Average Grade:`, result.average ?? ""].join(","));
    rows.push("");
    rows.push(headers.join(","));
    if (Array.isArray(result.data)) {
      for (const assessment of result.data) {
        rows.push(
          [
            `"${assessment.assessmentType ?? ""}"`,
            `"'${String(assessment.points ?? "")}'"`,
            `"${formatDate(assessment.endDate)}"`,
            `"${assessment.status ? assessment.status.charAt(0).toUpperCase() + assessment.status.slice(1) : ""}"`,
            `"${assessment.grade ?? ""}"`,
          ].join(",")
        );
      }
    }
    const csvContent = rows.join("\n");
    sendCSVResponse(res, csvContent, `student-grades-${sectionCode}`);
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
          title: "Student Management - Export Grades",
        },
        action: "export",
        description: `Exported student grades for section ${sectionCode}`,
        organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
        entityType: "student",
        createdAt: new Date(),
      });
    }
  } catch (error) {
    handleZodError(error, res);
  }
}
