import express, { Response } from "express";
import { API_ENDPOINTS } from "../config/endpointsConfig";
import { handleZodError } from "../middleware/zodErrorHandler";
import { ValidationSchemas } from "../helper/validationSchemas";
import { CustomRequest } from "../type/types";
import { z } from "zod";
import facultyService from "../services/facultyService";
import { ACTION } from "../config/common";
import { validatePermissions } from "../middleware/rabcMiddleware";
import { USER_ROLES } from "../config/common";
import { sendCSVResponse } from "../utils/csvUtils/csvResponse";
import activityLogService from "../services/activityLogService";
import mongoose from "mongoose";
import auditLogService from "../services/auditLogService";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Faculties
 *   description: Faculty management endpoints
 */

/**
 * @swagger
 * /api/faculty/get/all:
 *   get:
 *     summary: Get all faculties
 *     tags: [Faculties]
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
 *         description: List of faculties retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 faculties:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Faculty'
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
  API_ENDPOINTS.FACULTY.GET_ALL,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN],
    ACTION.GET_ALL
  ),
  getFaculties
);

/**
 * @swagger
 * /api/faculty/get/{id}:
 *   get:
 *     summary: Get faculty by ID
 *     tags: [Faculties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Faculty ID
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
 *         description: Faculty retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Faculty'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Faculty not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.FACULTY.GET_BY_ID,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN],
    ACTION.GET_BY_ID
  ),
  getFaculty
);

/**
 * @swagger
 * /api/faculty/create:
 *   post:
 *     summary: Create a new faculty
 *     tags: [Faculties]
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
 *               - code
 *               - description
 *             properties:
 *               name:
 *                 type: string
 *                 description: Faculty name
 *               code:
 *                 type: string
 *                 description: Faculty code
 *               description:
 *                 type: string
 *                 description: Faculty description
 *               isActive:
 *                 type: boolean
 *                 description: Whether the faculty is active
 *               organizationId:
 *                 type: string
 *                 description: Organization ID that the faculty belongs to
 *               createdAt:
 *                 type: string
 *                 format: date-time
 *                 description: Creation timestamp
 *     responses:
 *       201:
 *         description: Faculty created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Faculty'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.FACULTY.CREATE,
  validatePermissions([USER_ROLES.ADMIN], ACTION.CREATE),
  createFaculty
);

/**
 * @swagger
 * /api/faculty/update:
 *   put:
 *     summary: Update a faculty
 *     tags: [Faculties]
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
 *                 description: Faculty ID
 *               name:
 *                 type: string
 *                 description: Faculty name
 *               code:
 *                 type: string
 *                 description: Faculty code
 *               description:
 *                 type: string
 *                 description: Faculty description
 *               isActive:
 *                 type: boolean
 *                 description: Whether the faculty is active
 *               organizationId:
 *                 type: string
 *                 description: Organization ID that the faculty belongs to
 *     responses:
 *       200:
 *         description: Faculty updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Faculty'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Faculty not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.FACULTY.UPDATE,
  validatePermissions([USER_ROLES.ADMIN], ACTION.UPDATE),
  updateFaculty
);

/**
 * @swagger
 * /api/faculty/delete/{id}:
 *   delete:
 *     summary: Delete a faculty
 *     tags: [Faculties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Faculty ID
 *     responses:
 *       200:
 *         description: Faculty deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Faculty deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Faculty not found
 *       500:
 *         description: Server error
 */
router.delete(
  API_ENDPOINTS.FACULTY.REMOVE,
  validatePermissions([USER_ROLES.ADMIN], ACTION.DELETE),
  deleteFaculty
);

/**
 * @swagger
 * /api/faculty/search:
 *   post:
 *     summary: Search faculties
 *     tags: [Faculties]
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
 *                   name:
 *                     type: string
 *                     description: Search by faculty name
 *                   code:
 *                     type: string
 *                     description: Search by faculty code
 *                   isActive:
 *                     type: boolean
 *                     description: Filter by active status
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
 *                 $ref: '#/components/schemas/Faculty'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.FACULTY.SEARCH,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.SEARCH),
  searchFaculty
);

/**
 * @swagger
 * /api/faculty/export:
 *   post:
 *     summary: Export faculties to CSV
 *     tags: [Faculties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: filename
 *         schema:
 *           type: string
 *         description: Custom filename for the exported CSV (without extension)
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
 *               select:
 *                 type: string
 *                 description: Fields to include in export
 *     responses:
 *       200:
 *         description: CSV file containing faculty data
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
  API_ENDPOINTS.FACULTY.EXPORT,
  validatePermissions([USER_ROLES.ADMIN], ACTION.CUSTOM),
  exportFacultyRoute
);

/**
 * @swagger
 * /api/faculty/code:
 *   post:
 *     summary: Generate a unique faculty code
 *     tags: [Faculties]
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
 *                 description: Faculty name to generate code from (will be converted to uppercase and special characters removed)
 *     responses:
 *       200:
 *         description: Faculty code generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Faculty code generated successfully
 *                 code:
 *                   type: string
 *                   description: Generated faculty code (uppercase, no special characters)
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.FACULTY.HELPER_CODE,
  validatePermissions([USER_ROLES.ADMIN], ACTION.CUSTOM),
  generateFacultyCode
);

export default router;

export async function getFaculties(req: CustomRequest, res: Response) {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      throw new Error("Organization ID is required.");
    }

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

    const { faculties, pagination, count } = await facultyService.getFaculties(
      params,
      organizationId
    );

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
          title: "View All Faculties",
        },
        action: "read",
        description: `Retrieved ${faculties.length} faculties${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId(organizationId),
        entityType: "faculty",
        createdAt: new Date(),
      });
    }

    res.status(200).send({ faculties, pagination, count });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getFaculty(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });
    const params = ValidationSchemas.getQueryParams.parse({
      populateArray: req.query.populateArray ? JSON.parse(req.query.populateArray as string) : [],
      select: Array.isArray(req.query.select)
        ? req.query.select
        : [req.query.select].filter(Boolean),
      lean: req.query.lean,
    });

    const faculty = await facultyService.getFaculty(id, params);
    if (!faculty) {
      res.status(404).json({ error: "Faculty not found" });
      return;
    }

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
          title: "View Faculty Details",
        },
        action: "read",
        description: `Retrieved faculty with ID: ${id}${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
        entityType: "faculty",
        createdAt: new Date(),
      });
    }

    res.status(200).send(faculty);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function createFaculty(req: CustomRequest, res: Response) {
  try {
    const validatedData = ValidationSchemas.faculty.parse(req.body);

    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      throw new Error("Organization ID is required.");
    }
    const faculty = await facultyService.createFaculty(validatedData, organizationId);
    console.log(faculty);

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
          title: "Create New Faculty",
        },
        action: "create",
        description: `Created new faculty: ${faculty.name} (${faculty.code})`,
        organizationId: new mongoose.Types.ObjectId(organizationId),
        entityType: "faculty",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId(req.user.id),
        type: "CREATE",
        severity: "INFO",
        entity: {
          type: "FACULTY",
          id: faculty._id as mongoose.Types.ObjectId,
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
        description: `Created new faculty: ${faculty.name} (${faculty.code})`,
        organizationId: new mongoose.Types.ObjectId(organizationId),
      });
    }

    res.status(201).send(faculty);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function updateFaculty(req: CustomRequest, res: Response) {
  try {
    const updateSchema = z
      .object({
        _id: z.string().min(1, "Faculty ID is required"),
      })
      .passthrough();

    updateSchema.parse(req.body);

    const faculty = await facultyService.updateFaculty(req.body);
    if (!faculty) {
      res.status(404).json({ error: "Faculty not found" });
      return;
    }

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
          title: "Update Faculty",
        },
        action: "update",
        description: `Updated faculty: ${faculty.name} (${faculty.code}) with fields: ${Object.keys(req.body).join(", ")}`,
        organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
        entityType: "faculty",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId(req.user.id),
        type: "UPDATE",
        severity: "INFO",
        entity: {
          type: "FACULTY",
          id: faculty._id as mongoose.Types.ObjectId,
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
        description: `Updated faculty: ${faculty.name} (${faculty.code})`,
        organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
      });
    }

    res.status(200).send(faculty);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function deleteFaculty(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });
    const faculty = await facultyService.deleteFaculty(id);
    if (!faculty) {
      res.status(404).json({ error: "Faculty not found" });
      return;
    }

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
          title: "Delete Faculty",
        },
        action: "delete",
        description: `Deleted faculty with ID: ${id}`,
        organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
        entityType: "faculty",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId(req.user.id),
        type: "DELETE",
        severity: "INFO",
        entity: {
          type: "FACULTY",
          id: faculty._id as mongoose.Types.ObjectId,
        },
        changes: {
          before: faculty,
          after: {},
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Deleted faculty: ${faculty.name} (${faculty.code})`,
        organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
      });
    }

    res.status(200).send({ message: "Faculty deleted successfully" });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function searchFaculty(req: CustomRequest, res: Response) {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      throw new Error("Organization ID is required.");
    }
    const faculties = await facultyService.searchFaculty(req.body, organizationId);

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
          title: "Search Faculties",
        },
        action: "search",
        description: `Searched faculties with criteria: ${JSON.stringify(req.body)} (found ${faculties.length} results)`,
        organizationId: new mongoose.Types.ObjectId(organizationId),
        entityType: "faculty",
        createdAt: new Date(),
      });
    }

    res.status(200).send(faculties);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function exportFacultyRoute(req: CustomRequest, res: Response) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) throw new Error("Organization ID is required.");

    const csv = await facultyService.exportFaculty(req.body, organizationId);

    let filename = "faculties";
    if (req.query.filename && typeof req.query.filename === "string") {
      filename = req.query.filename;
    } else if (req.body.filename && typeof req.body.filename === "string") {
      filename = req.body.filename;
    }

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
          title: "Export Faculties",
        },
        action: "export",
        description: `Exported faculties to CSV${req.body.query ? ` with filters: ${JSON.stringify(req.body.query)}` : ""}`,
        organizationId: new mongoose.Types.ObjectId(organizationId),
        entityType: "faculty",
        createdAt: new Date(),
      });
    }

    sendCSVResponse(res, csv, filename);
    res.status(200).send(csv);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function generateFacultyCode(req: CustomRequest, res: Response) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) throw new Error("Organization ID is required.");

    const data = req.body;
    const code = await facultyService.generateFacultyCode(data, organizationId);

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
          title: "Generate Faculty Code",
        },
        action: "create",
        description: `Generated faculty code: ${code} for name: ${data.name}`,
        organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
        entityType: "faculty",
        createdAt: new Date(),
      });
    }

    res.status(200).send({
      message: "Faculty code generated successfully",
      code: code,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}
