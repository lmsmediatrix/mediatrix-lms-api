import express, { Request, Response } from "express";
import { API_ENDPOINTS } from "../config/endpointsConfig";
import { IProgram, ProgramZodSchema } from "../models/programModel";
import programService from "../services/programService";
import { handleZodError } from "../middleware/zodErrorHandler";
import { ValidationSchemas } from "../helper/validationSchemas";
import { z } from "zod";
import { CustomRequest } from "../type/types";
import activityLogService from "../services/activityLogService";
import auditLogService from "../services/auditLogService";
import mongoose from "mongoose";
import { ACTION } from "../config/common";
import { USER_ROLES } from "../config/common";
import { validatePermissions } from "../middleware/rabcMiddleware";
import { sendCSVResponse } from "../utils/csvUtils/csvResponse";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Programs
 *   description: Program management endpoints for handling educational programs, their structure, and related operations
 */

/**
 * @swagger
 * /api/program/get/all:
 *   get:
 *     summary: Get all programs with filtering and pagination
 *     description: Retrieve a list of all programs with support for filtering, sorting, pagination, and field selection
 *     tags: [Programs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: object
 *         description: Query parameters for filtering programs (e.g., name, status, type)
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
 *       - in: query
 *         name: document
 *         schema:
 *           type: boolean
 *         description: Whether to return the document
 *     responses:
 *       200:
 *         description: List of programs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Successfully retrieved Programs
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Program'
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
  API_ENDPOINTS.PROGRAM.GET_ALL,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN],
    ACTION.GET_ALL
  ),
  getPrograms
);

/**
 * @swagger
 * /api/program/get/{id}:
 *   get:
 *     summary: Get program by ID with detailed information
 *     description: Retrieve detailed information about a specific program by its ID
 *     tags: [Programs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Program ID
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
 *         description: Program retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Program'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Program not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.PROGRAM.GET_BY_ID,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN],
    ACTION.GET_BY_ID
  ),
  getProgram
);

/**
 * @swagger
 * /api/program/create:
 *   post:
 *     summary: Create a new program
 *     description: Create a new educational program with its structure, courses, and settings
 *     tags: [Programs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *               - duration
 *               - academicYear
 *             properties:
 *               name:
 *                 type: string
 *                 description: Program name
 *                 example: "Bachelor of Science in Computer Science"
 *               description:
 *                 type: string
 *                 description: Detailed description of the program
 *                 example: "A comprehensive program covering computer science fundamentals and advanced topics"
 *               duration:
 *                 type: integer
 *                 description: Program duration in years
 *                 example: 4
 *               academicYear:
 *                 type: array
 *                 description: Academic year structure
 *                 items:
 *                   type: object
 *                   properties:
 *                     yearLevel:
 *                       type: integer
 *                       description: Year level (1 or higher)
 *                       example: 1
 *                     semesters:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           semesterNo:
 *                             type: integer
 *                             description: Semester number (1 or 2)
 *                             example: 1
 *                           courses:
 *                             type: array
 *                             items:
 *                               type: string
 *                             description: List of course IDs
 *                             example: ["course1", "course2"]
 *               organizationId:
 *                 type: string
 *                 description: Organization ID that the program belongs to
 *                 example: "60d21b4667d0d8992e610c85"
 *               archive:
 *                 type: object
 *                 properties:
 *                   status:
 *                     type: boolean
 *                     description: Archive status
 *                     example: false
 *                   date:
 *                     type: string
 *                     format: date-time
 *                     description: Archive date
 *                     example: "2024-03-15T00:00:00.000Z"
 *     responses:
 *       200:
 *         description: Program created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Program'
 *       400:
 *         description: Invalid input - Missing required fields or invalid data
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.PROGRAM.CREATE,
  validatePermissions([USER_ROLES.ADMIN], ACTION.CREATE),
  createProgram
);

/**
 * @swagger
 * /api/program/update:
 *   put:
 *     summary: Update program details
 *     description: Update program properties including structure, courses, and settings
 *     tags: [Programs]
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
 *                 description: Program ID
 *                 example: "60d21b4667d0d8992e610c85"
 *               name:
 *                 type: string
 *                 description: Updated program name
 *                 example: "Bachelor of Science in Computer Science"
 *               description:
 *                 type: string
 *                 description: Updated program description
 *                 example: "Updated comprehensive program covering computer science fundamentals"
 *               duration:
 *                 type: integer
 *                 description: Updated program duration in years
 *                 example: 4
 *               academicYear:
 *                 type: array
 *                 description: Updated academic year structure
 *                 items:
 *                   type: object
 *                   properties:
 *                     yearLevel:
 *                       type: integer
 *                       description: Year level (1 or higher)
 *                       example: 1
 *                     semesters:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           semesterNo:
 *                             type: integer
 *                             description: Semester number (1 or 2)
 *                             example: 1
 *                           courses:
 *                             type: array
 *                             items:
 *                               type: string
 *                             description: Updated list of course IDs
 *                             example: ["course1", "course2"]
 *     responses:
 *       200:
 *         description: Program updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Program'
 *       400:
 *         description: Invalid input - Missing required fields or invalid data
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Program not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.PROGRAM.UPDATE,
  validatePermissions([USER_ROLES.ADMIN], ACTION.UPDATE),
  updateProgram
);

/**
 * @swagger
 * /api/program/remove/{id}:
 *   delete:
 *     summary: Delete a program
 *     description: Permanently delete a program and all its associated data
 *     tags: [Programs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Program ID to delete
 *     responses:
 *       200:
 *         description: Program deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Program deleted successfully
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Program not found
 *       500:
 *         description: Server error
 */
router.delete(
  API_ENDPOINTS.PROGRAM.REMOVE,
  validatePermissions([USER_ROLES.ADMIN], ACTION.DELETE),
  deleteProgram
);

/**
 * @swagger
 * /api/program/search:
 *   post:
 *     summary: Search programs with custom criteria
 *     description: Search for programs using custom search criteria and filters
 *     tags: [Programs]
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
 *                 example: { "name": "Computer Science", "type": "Bachelor" }
 *     responses:
 *       200:
 *         description: List of programs matching search criteria
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Program'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.PROGRAM.SEARCH,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.SEARCH),
  searchProgram
);

/**
 * @swagger
 * /api/program/export:
 *   post:
 *     summary: Export programs as CSV
 *     description: Export program data to CSV format with customizable filters and filename
 *     tags: [Programs]
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
 *                 description: Query parameters for filtering programs
 *                 example: { "status": "active" }
 *               filename:
 *                 type: string
 *                 description: Custom filename for the exported CSV
 *                 example: "programs_export_2024"
 *     responses:
 *       200:
 *         description: Programs exported successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.PROGRAM.EXPORT,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN], ACTION.CUSTOM),
  exportPrograms
);

/**
 * @swagger
 * /api/program/code:
 *   post:
 *     summary: Generate a unique program code
 *     description: Generate a unique code for a program based on its name and other parameters
 *     tags: [Programs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Program name to generate code from
 *                 example: "Bachelor of Science in Computer Science"
 *               code:
 *                 type: string
 *                 description: Optional custom code prefix
 *                 example: "BSCS"
 *     responses:
 *       200:
 *         description: Program code generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Program code generated successfully
 *                 code:
 *                   type: string
 *                   example: "BSCS-2024-001"
 *       400:
 *         description: Invalid input - Missing required fields
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.PROGRAM.HELPER_CODE,
  validatePermissions([USER_ROLES.ADMIN], ACTION.CUSTOM),
  generateProgramCode
);

export default router;

export async function getPrograms(req: Request, res: Response) {
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

    const { programs, pagination, count } = await programService.getPrograms(params);

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
          title: "Program Management - View All Programs",
        },
        action: "read",
        description: `Retrieved ${programs} programs${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "program",
        createdAt: new Date(),
      });
    }

    res
      .status(200)
      .send({ message: "Successfully retrieved Programs", data: programs, pagination, count });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getProgram(req: Request, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });
    const params = ValidationSchemas.getQueryParams.parse({
      populateArray: req.query.populateArray ? JSON.parse(req.query.populateArray as string) : [],
      select: Array.isArray(req.query.select)
        ? req.query.select
        : [req.query.select].filter(Boolean),
      lean: req.query.lean,
    });

    const program = await programService.getProgram(id, params);

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
          title: "Program Management - View Program Details",
        },
        action: "read",
        description: `Viewed program details for ${program?.name || id}${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "program",
        createdAt: new Date(),
      });
    }

    res.status(200).send(program);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function createProgram(req: CustomRequest, res: Response) {
  try {
    const validatedData = ProgramZodSchema.partial().parse(req.body);
    const organizationId = new mongoose.Types.ObjectId((req as any).user.organizationId).toString();
    const newProgram = await programService.createProgram(
      validatedData as Partial<IProgram>,
      organizationId
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
          title: "Program Management - Create New Program",
        },
        action: "create",
        description: `Created new program: ${newProgram.name}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "program",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId(req.user.id),
        type: "CREATE",
        severity: "INFO",
        entity: {
          type: "PROGRAM",
          id: new mongoose.Types.ObjectId(newProgram.id),
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
        description: `Created new program ${newProgram.name}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });
    }

    res.status(200).send(newProgram);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function updateProgram(req: CustomRequest, res: Response) {
  try {
    const validatedData = ProgramZodSchema.partial()
      .extend({ _id: z.string().min(1) })
      .parse(req.body);

    const currentProgram = await programService.getProgram(validatedData._id, {
      select: Object.keys(req.body).filter((key) => key !== "_id"),
    });

    const updatedProgram = await programService.updateProgram(validatedData as Partial<IProgram>);

    if (!updatedProgram) {
      throw new Error("Failed to update program");
    }

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
          title: "Program Management - Update Program",
        },
        action: "update",
        description: `Updated program ${updatedProgram.name} with fields: ${updatedFields}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "program",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId(req.user.id),
        type: "UPDATE",
        severity: "INFO",
        entity: {
          type: "PROGRAM",
          id: new mongoose.Types.ObjectId(updatedProgram.id),
        },
        changes: {
          before: currentProgram || {},
          after: updatedProgram,
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Updated program ${updatedProgram.name}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });
    }

    res.status(200).send(updatedProgram);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function deleteProgram(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    const currentProgram = await programService.getProgram(id, {
      select: ["name"],
    });

    if (!currentProgram) {
      throw new Error("Program not found");
    }

    const deletedProgram = await programService.deleteProgram(id);

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
          title: "Program Management - Delete Program",
        },
        action: "remove",
        description: `Deleted program: ${currentProgram.name}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "program",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId(req.user.id),
        type: "DELETE",
        severity: "INFO",
        entity: {
          type: "PROGRAM",
          id: new mongoose.Types.ObjectId(id),
        },
        changes: {
          before: currentProgram,
          after: {},
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Deleted program ${currentProgram.name}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });
    }

    res.status(200).send(deletedProgram);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function searchProgram(req: Request, res: Response) {
  try {
    const searchResult = await programService.searchProgram(req.body);

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
          title: "Program Management - Search Programs",
        },
        action: "read",
        description: `Searched programs with criteria: ${searchCriteria || "none"} (found ${searchResult?.length} results)`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "program",
        createdAt: new Date(),
      });
    }

    res.status(200).send(searchResult);
  } catch (error) {
    handleZodError(error, res);
  }
}

/**
 * @desc   export programs as CSV
 * @route  POST /api/program/export
 * @access Private/Admin
 */
export async function exportPrograms(req: CustomRequest, res: Response) {
  try {
    const requestBody = { ...req.body };
    if (req.user && req.user.id) {
      requestBody.currentUserId = req.user.id;
    }
    let filename = "programs";
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
    const csv = await programService.exportProgram(requestBody, organizationId);
    sendCSVResponse(res, csv, filename);

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
          title: "Program Management - Export Programs",
        },
        action: "export",
        description: `Exported programs list`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "program",
        createdAt: new Date(),
      });
    }
  } catch (error) {
    console.error("Error exporting program data:", error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "An unexpected error occurred",
      status: "error",
      details: error instanceof Error ? error.stack : String(error),
    });
  }
}

export async function generateProgramCode(req: CustomRequest, res: Response) {
  try {
    const data = req.body;
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        message: "User not authenticated or missing organization",
        status: "error",
      });
    }
    const code = await programService.generateProgramCode(data, organizationId);

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
          title: "Program Management - Generate Program Code",
        },
        action: "create",
        description: `Generated program code for: ${data.name || "Unknown Program"}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "program",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId(req.user.id),
        type: "CREATE",
        severity: "INFO",
        entity: {
          type: "PROGRAM",
          id: new mongoose.Types.ObjectId(),
        },
        changes: {
          before: {},
          after: { code, name: data.name },
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Generated program code for ${data.name || "Unknown Program"}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });
    }

    res.status(200).send({
      message: "Program code generated successfully",
      code: code,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}
