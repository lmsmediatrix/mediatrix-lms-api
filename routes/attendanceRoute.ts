import express, { Request, Response } from "express";
import { API_ENDPOINTS } from "../config/endpointsConfig";
import attendanceService from "../services/attendanceService";
import { AttendanceZodSchema } from "../models/attendanceModel";
import { handleZodError } from "../middleware/zodErrorHandler";
import { ValidationSchemas } from "../helper/validationSchemas";
import { z } from "zod";
import { CustomRequest } from "../type/types";
import mongoose from "mongoose";
import { IAttendance } from "../models/attendanceModel";
import activityLogService from "../services/activityLogService";
import auditLogService from "../services/auditLogService";
import { ACTION } from "../config/common";
import { USER_ROLES } from "../config/common";
import { validatePermissions } from "../middleware/rabcMiddleware";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Attendance
 *   description: Attendance management endpoints for tracking student attendance in sections
 */

/**
 * @swagger
 * /api/attendance/get/all:
 *   get:
 *     summary: Get all attendance records
 *     description: Retrieve a list of all attendance records with optional filtering, sorting, and pagination
 *     tags: [Attendance]
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
 *         description: List of attendance records retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 attendance:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Attendance'
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
  API_ENDPOINTS.ATTENDANCE.GET_ALL,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.GET_ALL),
  getAttendances
);

/**
 * @swagger
 * /api/attendance/get/{id}:
 *   get:
 *     summary: Get attendance record by ID
 *     description: Retrieve a specific attendance record by its unique identifier
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Attendance record ID
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
 *         description: Attendance record retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Attendance'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Attendance record not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.ATTENDANCE.GET_BY_ID,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.GET_BY_ID),
  getAttendance
);

/**
 * @swagger
 * /api/attendance/get/student/{studentId}:
 *   get:
 *     summary: Get attendance records for a specific student
 *     description: Retrieve attendance records for a specific student with optional filtering by section and date
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Student ID
 *       - in: query
 *         name: section
 *         schema:
 *           type: string
 *         description: Section ID to filter by
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Date to filter by (YYYY-MM-DD)
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
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort criteria
 *     responses:
 *       200:
 *         description: Student attendance records retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Attendance'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Student not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.ATTENDANCE.GET_ATTENDANCE_STUDENT,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.CUSTOM),
  getStudentAttendance
);

/**
 * @swagger
 * /api/attendance/create:
 *   post:
 *     summary: Create a new attendance record
 *     description: Create a new attendance record for a section
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - section
 *             properties:
 *               section:
 *                 type: string
 *                 description: Section ID
 *     responses:
 *       200:
 *         description: Attendance record created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Attendance'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.ATTENDANCE.CREATE,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.CREATE),
  createAttendance
);

/**
 * @swagger
 * /api/attendance/update:
 *   put:
 *     summary: Update an attendance record
 *     description: Update an existing attendance record's details and status
 *     tags: [Attendance]
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
 *                 description: Attendance record ID
 *               section:
 *                 type: string
 *                 description: Section ID
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Attendance date
 *               status:
 *                 type: string
 *                 enum: [present, absent, late]
 *                 description: Attendance status
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *     responses:
 *       200:
 *         description: Attendance record updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Attendance'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Attendance record not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.ATTENDANCE.UPDATE,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.UPDATE),
  updateAttendance
);

/**
 * @swagger
 * /api/attendance/remove/{id}:
 *   delete:
 *     summary: Delete an attendance record
 *     description: Permanently delete an attendance record
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Attendance record ID
 *     responses:
 *       200:
 *         description: Attendance record deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Attendance record deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Attendance record not found
 *       500:
 *         description: Server error
 */
router.delete(
  API_ENDPOINTS.ATTENDANCE.REMOVE,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.DELETE),
  deleteAttendance
);

/**
 * @swagger
 * /api/attendance/search:
 *   post:
 *     summary: Search attendance records
 *     description: Search and filter attendance records using various criteria
 *     tags: [Attendance]
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
 *                   section:
 *                     type: string
 *                     description: Filter by section ID
 *                   date:
 *                     type: object
 *                     description: Date range filter
 *                     properties:
 *                       $gte:
 *                         type: string
 *                         format: date
 *                       $lte:
 *                         type: string
 *                         format: date
 *                   status:
 *                     type: string
 *                     enum: [present, absent, late]
 *                     description: Filter by attendance status
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Attendance'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.ATTENDANCE.SEARCH,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.SEARCH),
  searchAttendance
);

export default router;

export async function getAttendances(req: CustomRequest, res: Response) {
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

    const announcements = await attendanceService.getAttendances(params);

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
          title: "View All Attendance Records",
        },
        action: "read",
        description: `Retrieved ${announcements} attendance records${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "attendance",
        createdAt: new Date(),
      });
    }

    res.status(200).send(announcements);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getAttendance(req: Request, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });
    const params = ValidationSchemas.getQueryParams.parse({
      populateArray: req.query.populateArray ? JSON.parse(req.query.populateArray as string) : [],
      select: Array.isArray(req.query.select)
        ? req.query.select
        : [req.query.select].filter(Boolean),
      lean: req.query.lean,
    });

    const announcement = await attendanceService.getAttendance(id, params);

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
          title: "View Attendance Record",
        },
        action: "read",
        description: `Retrieved attendance record with ID ${id}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "attendance",
        createdAt: new Date(),
      });
    }

    res.status(200).send(announcement);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function createAttendance(req: CustomRequest, res: Response) {
  try {
    const user = req.user;
    if (!user || !user.id) {
      throw new Error("User information is missing or invalid.");
    }
    const validationSchema = z.object({
      section: z.string().min(1, "Section ID is required"),
    });

    const { section } = validationSchema.parse(req.body);

    const attendanceData: Partial<IAttendance> = {
      section: new mongoose.Types.ObjectId(section),
    };

    try {
      const newAttendance = await attendanceService.createAttendance(attendanceData, user);

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
          title: "Create Attendance Record",
        },
        action: "create",
        description: `Created new attendance record for section ${section}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "attendance",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId(user.id),
        type: "CREATE",
        severity: "INFO",
        entity: {
          type: "ATTENDANCE",
          id: new mongoose.Types.ObjectId(newAttendance._id),
        },
        changes: {
          before: {},
          after: attendanceData,
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Created attendance record for section ${section}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });

      res.status(200).send(newAttendance);
    } catch (serviceError) {
      console.error("Attendance service error:", serviceError);
      if (serviceError instanceof Error) {
        res.status(400).json({
          error: serviceError.message,
        });
      } else {
        res.status(500).json({
          error: "Unknown error occurred in attendance service",
        });
      }
    }
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function updateAttendance(req: Request, res: Response) {
  try {
    const validatedData = AttendanceZodSchema.partial()
      .extend({ _id: z.string().min(1) })
      .parse(req.body);

    const updateData = {
      ...validatedData,
      _id: validatedData._id,
    };

    const updateAnnouncement = await attendanceService.updateAttendance(updateData);

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
          title: "Update Attendance Record",
        },
        action: "update",
        description: `Updated attendance record with ID ${validatedData._id}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "attendance",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId((req as any).user.id),
        type: "UPDATE",
        severity: "INFO",
        entity: {
          type: "ATTENDANCE",
          id: new mongoose.Types.ObjectId(validatedData._id),
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
        description: `Updated attendance record with ID ${validatedData._id}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });
    }

    res.status(200).send(updateAnnouncement);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function deleteAttendance(req: Request, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });
    const deleteAnnouncement = await attendanceService.deleteAttendance(id);

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
          title: "Delete Attendance Record",
        },
        action: "delete",
        description: `Deleted attendance record with ID ${id}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "attendance",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId((req as any).user.id),
        type: "DELETE",
        severity: "INFO",
        entity: {
          type: "ATTENDANCE",
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
        description: `Deleted attendance record with ID ${id}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });
    }

    res.status(200).send(deleteAnnouncement);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function searchAttendance(req: Request, res: Response) {
  try {
    const searchAnnouncement = await attendanceService.searchAttendance(req.body);

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
          title: "Search Attendance Records",
        },
        action: "search",
        description: `Searched attendance records with criteria: ${JSON.stringify(req.body)}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "attendance",
        createdAt: new Date(),
      });
    }

    res.status(200).send(searchAnnouncement);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getStudentAttendance(req: Request, res: Response) {
  try {
    const { id: studentId } = ValidationSchemas.idParam.parse({ id: req.params.studentId });
    const query: any = {};
    if (req.query.section) {
      query.section = req.query.section.toString();
    }
    if (req.query.date) {
      const dateStr = req.query.date.toString();
      const queryDate = new Date(dateStr);
      const startOfDay = new Date(queryDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(queryDate);
      endOfDay.setHours(23, 59, 59, 999);

      query.date = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
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
      query: query,
      sort: req.query.sort,
    });

    const attendance = await attendanceService.getStudentAttendance(studentId, params);

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
          title: "View Student Attendance Records",
        },
        action: "read",
        description: `Retrieved attendance records for student ID ${studentId}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "attendance",
        createdAt: new Date(),
      });
    }

    res.status(200).send(attendance);
  } catch (error) {
    handleZodError(error, res);
  }
}
