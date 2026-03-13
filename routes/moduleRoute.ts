import express, { Request, Response } from "express";
import { API_ENDPOINTS } from "../config/endpointsConfig";
import { ModuleZodSchema } from "../models/moduleModel";
import moduleService from "../services/moduleService";
import { handleZodError } from "../middleware/zodErrorHandler";
import { ValidationSchemas } from "../helper/validationSchemas";
import { z } from "zod";
import { ACTION, config, USER_ROLES } from "../config/common";
import { CustomRequest } from "../type/types";
import activityLogService from "../services/activityLogService";
import auditLogService from "../services/auditLogService";
import mongoose from "mongoose";
import { upload } from "../middleware/multer";
import { parseCSVBuffer } from "../utils/csvUtils/csvUtils";
import { validatePermissions } from "../middleware/rabcMiddleware";
import notificationService from "../services/notificationService";
import sectionService from "../services/sectionService";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Modules
 *   description: Module management endpoints for handling course modules, content organization, and related operations
 */

/**
 * @swagger
 * /api/module/get/all:
 *   get:
 *     summary: Get all modules with filtering and pagination
 *     description: Retrieve a list of all modules with support for filtering, sorting, pagination, and field selection
 *     tags: [Modules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: object
 *         description: Query parameters for filtering modules (e.g., title, description, sectionCode)
 *       - in: query
 *         name: queryArray
 *         schema:
 *           type: array
 *         description: Array of query parameters for complex filtering
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: Fields to populate (e.g., section, lessons)
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort criteria (e.g., "title:1" for ascending, "title:-1" for descending)
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
 *         description: List of modules retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Modules retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Module'
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
  API_ENDPOINTS.MODULE.GET_ALL,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN],
    ACTION.GET_ALL
  ),
  getModules
);

/**
 * @swagger
 * /api/module/get/{id}:
 *   get:
 *     summary: Get module by ID with detailed information
 *     description: Retrieve detailed information about a specific module by its ID
 *     tags: [Modules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Module ID
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: Fields to populate (e.g., section, lessons)
 *       - in: query
 *         name: select
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Fields to select in the response
 *     responses:
 *       200:
 *         description: Module retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Module retrieved successfully
 *                 data:
 *                   $ref: '#/components/schemas/Module'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Module not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.MODULE.GET_BY_ID,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN],
    ACTION.GET_BY_ID
  ),
  getModule
);

/**
 * @swagger
 * /api/module/create:
 *   post:
 *     summary: Create a new module
 *     description: Create a new module with title, description, and optional section code
 *     tags: [Modules]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 description: Title of the module
 *                 example: "Introduction to Programming"
 *               description:
 *                 type: string
 *                 description: Detailed description of the module
 *                 example: "Basic concepts of programming and problem-solving"
 *               sectionCode:
 *                 type: string
 *                 description: Optional section code to associate the module with
 *                 example: "CS101-2024"
 *     responses:
 *       200:
 *         description: Module created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Module created successfully
 *                 data:
 *                   $ref: '#/components/schemas/Module'
 *       400:
 *         description: Invalid input - Missing required fields or invalid data
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.MODULE.CREATE,
  validatePermissions([USER_ROLES.INSTRUCTOR], ACTION.CREATE),
  createModule
);

/**
 * @swagger
 * /api/module/update:
 *   put:
 *     summary: Update an existing module
 *     description: Update module details including title, description, and section code
 *     tags: [Modules]
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
 *                 description: Module ID to update
 *                 example: "60d21b4667d0d8992e610c85"
 *               title:
 *                 type: string
 *                 description: Updated title of the module
 *                 example: "Advanced Programming Concepts"
 *               description:
 *                 type: string
 *                 description: Updated description of the module
 *                 example: "Advanced programming concepts and best practices"
 *               sectionCode:
 *                 type: string
 *                 description: Updated section code
 *                 example: "CS201-2024"
 *     responses:
 *       200:
 *         description: Module updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Module updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/Module'
 *       400:
 *         description: Invalid input - Missing required fields or invalid data
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Module not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.MODULE.UPDATE,
  validatePermissions([USER_ROLES.INSTRUCTOR], ACTION.UPDATE),
  updateModule
);

/**
 * @swagger
 * /api/module/remove/{id}:
 *   delete:
 *     summary: Delete a module
 *     description: Permanently delete a module by its ID
 *     tags: [Modules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Module ID to delete
 *     responses:
 *       200:
 *         description: Module deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Module deleted successfully
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Module not found
 *       500:
 *         description: Server error
 */
router.delete(
  API_ENDPOINTS.MODULE.REMOVE,
  validatePermissions([USER_ROLES.INSTRUCTOR], ACTION.DELETE),
  deleteModule
);

/**
 * @swagger
 * /api/module/search:
 *   post:
 *     summary: Search modules with custom criteria
 *     description: Search for modules using custom search criteria and filters
 *     tags: [Modules]
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
 *                 description: Search criteria (e.g., title, description, sectionCode)
 *                 example: { "title": "Programming", "sectionCode": "CS101" }
 *     responses:
 *       200:
 *         description: List of modules matching search criteria
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Module'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.MODULE.SEARCH,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.SEARCH),
  searchModule
);

/**
 * @swagger
 * /api/module/bulk-create:
 *   post:
 *     summary: Bulk create modules from CSV file
 *     description: Import multiple modules at once using a CSV file
 *     tags: [Modules]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - sectionCode
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file containing module data (title, description)
 *               sectionCode:
 *                 type: string
 *                 description: Section code to associate the modules with
 *                 example: "CS101-2024"
 *     responses:
 *       200:
 *         description: Modules created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Modules imported successfully
 *                 result:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: number
 *                       description: Number of successfully imported modules
 *                     failed:
 *                       type: number
 *                       description: Number of failed imports
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         description: Details of failed imports
 *       400:
 *         description: Invalid input - Missing file or section code
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.MODULE.BULK_CREATE,
  validatePermissions([USER_ROLES.INSTRUCTOR], ACTION.CUSTOM),
  upload.single("file"),
  bulkCreateModule
);

/**
 * @swagger
 * /api/module/archive/{id}:
 *   put:
 *     summary: Archive a module (soft delete)
 *     description: Archive a module instead of permanent deletion, making it inaccessible but preserving data
 *     tags: [Modules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Module ID to archive
 *     responses:
 *       200:
 *         description: Module archived successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Module archived successfully
 *                 data:
 *                   $ref: '#/components/schemas/Module'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Module not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.MODULE.ARCHIVE,
  validatePermissions(
    [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN, USER_ROLES.INSTRUCTOR],
    ACTION.ARCHIVE
  ),
  archiveModule
);

export default router;

export async function getModules(req: Request, res: Response) {
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

    const { modules, pagination, count } = await moduleService.getModules(params);

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
          title: "Module Management - View All Modules",
        },
        action: "read",
        description: `Retrieved ${modules} modules${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "module",
        createdAt: new Date(),
      });
    }

    res
      .status(200)
      .send({ message: config.SUCCESS.MODULE.GET_ALL, data: modules, pagination, count });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getModule(req: Request, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });
    const params = ValidationSchemas.getQueryParams.parse({
      populateArray: req.query.populateArray ? JSON.parse(req.query.populateArray as string) : [],
      select: Array.isArray(req.query.select)
        ? req.query.select
        : [req.query.select].filter(Boolean),
      lean: req.query.lean,
    });

    const module = await moduleService.getModule(id, params);

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
          title: "Module Management - View Module Details",
        },
        action: "read",
        description: `Viewed module details for ${module?.title || id}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "module",
        createdAt: new Date(),
      });
    }

    res.status(200).send({ message: config.SUCCESS.MODULE.GET_BY_ID, data: module });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function createModule(req: CustomRequest, res: Response) {
  try {
    if (!req.user) throw new Error("User not found");

    const validatedData = ModuleZodSchema.partial()
      .extend({
        sectionCode: z.string().optional(),
      })
      .parse(req.body);
    const { newSection: newModule, sectionCode } = await moduleService.createModule(validatedData);
    res.status(200).send({ message: config.SUCCESS.MODULE.CREATE, data: newModule });

    (async () => {
      try {
        const user = req.user;
        if (!user) {
          console.error("User not found in background operations");
          return;
        }

        const section = await sectionService.getSection(sectionCode, {
          query: { organizationId: user.organizationId },
          select: "_id instructor students name code",
          populateArray: [
            { path: "instructor", select: "_id firstName lastName" },
            { path: "students", select: "_id firstName lastName" },
          ],
          lean: true,
        });
        if (section && section.instructor && section.students && section.students.length > 0) {
          await notificationService.sendNotification({
            query: { _id: { $in: section.students.map((student: any) => student._id) } },
            sectionId: section._id.toString(),
            notification: {
              category: "MODULE",
              source: section.instructor._id,
              recipients: {
                read: [],
                unread: section.students.map((student: any) => ({
                  user: student._id,
                  date: null,
                })),
              },
              metadata: () => ({
                path: `/student/sections/${section.code}?tab=modules&id=${newModule._id}`,
                module: {
                  title: newModule.title,
                  id: newModule._id,
                },
              }),
            },
            template: {
              title: ({ section: _section }) => `A new module has been added to ${_section.name}`,
              description: ({ sender }) =>
                `${sender.firstName} has added a new module: "${newModule.title}"`,
            },
            type: "student",
          });
        }

        await activityLogService.createActivityLog({
          userId: new mongoose.Types.ObjectId(user.id),
          headers: {
            "user-agent": req.get("user-agent"),
          },
          ip: req.ip || "0.0.0.0",
          path: req.path,
          method: req.method,
          page: {
            url: req.originalUrl,
            title: "Module Management - Create New Module",
          },
          action: "create",
          description: `Created new module: ${newModule.title}`,
          organizationId: user.organizationId
            ? new mongoose.Types.ObjectId(user.organizationId)
            : undefined,
          entityType: "module",
          createdAt: new Date(),
        });

        if (!newModule._id) {
          console.error("Module ID not found for audit log");
          return;
        }

        await auditLogService.createAuditLog({
          user: new mongoose.Types.ObjectId(user.id),
          type: "CREATE",
          severity: "INFO",
          entity: {
            type: "MODULE",
            id: new mongoose.Types.ObjectId(newModule._id),
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
          description: `Created new module ${newModule.title}`,
          organizationId: user.organizationId
            ? new mongoose.Types.ObjectId(user.organizationId)
            : undefined,
        });
      } catch (error) {
        console.error("Error in background operations:", error);
      }
    })();
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function updateModule(req: CustomRequest, res: Response) {
  try {
    if (!req.user) throw new Error("User not found");

    const validatedData = ModuleZodSchema.partial()
      .extend({ _id: z.string().min(1) })
      .parse(req.body);

    const currentModule = await moduleService.getModule(validatedData._id, {
      select: Object.keys(req.body).filter((key) => key !== "_id"),
    });

    const updatedModule = await moduleService.updateModule(validatedData);

    if (!updatedModule) {
      throw new Error("Failed to update module");
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
        title: "Module Management - Update Module",
      },
      action: "update",
      description: `Updated module ${updatedModule?.title || "unknown"} with fields: ${Object.keys(
        req.body
      )
        .filter((key) => key !== "_id")
        .join(", ")}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      entityType: "module",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(req.user.id),
      type: "UPDATE",
      severity: "INFO",
      entity: {
        type: "MODULE",
        id: updatedModule._id,
      },
      changes: {
        before: currentModule || {},
        after: updatedModule,
      },
      metadata: {
        userAgent: req.get("user-agent"),
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      description: `Updated module ${updatedModule.title}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });

    res.status(200).send({ message: config.SUCCESS.MODULE.UPDATE, data: updatedModule });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function deleteModule(req: CustomRequest, res: Response) {
  try {
    if (!req.user) throw new Error("User not found");

    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    const currentModule = await moduleService.getModule(id, {
      select: ["title"],
    });

    if (!currentModule) {
      throw new Error("Module not found");
    }

    await moduleService.deleteModule(id);

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
        title: "Module Management - Delete Module",
      },
      action: "remove",
      description: `Deleted module: ${currentModule.title}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      entityType: "module",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(req.user.id),
      type: "DELETE",
      severity: "INFO",
      entity: {
        type: "MODULE",
        id: new mongoose.Types.ObjectId(id),
      },
      changes: {
        before: currentModule,
        after: {},
      },
      metadata: {
        userAgent: req.get("user-agent"),
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      description: `Deleted module ${currentModule.title}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });

    res.status(200).send({ message: config.SUCCESS.MODULE.DELETE });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function searchModule(req: Request, res: Response) {
  try {
    const searchResult = await moduleService.searchModule(req.body);

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
          title: "Module Management - Search Modules",
        },
        action: "read",
        description: `Searched modules with criteria: ${searchCriteria || "none"} (found ${searchResult?.length} results)`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "module",
        createdAt: new Date(),
      });
    }

    res.status(200).send(searchResult);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function bulkCreateModule(req: CustomRequest, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).send({ message: "No CSV file uploaded" });
    }
    if (!req.body.sectionCode) {
      return res.status(400).send({ message: "Section code is required" });
    }
    const organizationId = (req as any).user.organizationId;
    const sectionCode = req.body.sectionCode;

    const data = await parseCSVBuffer(req.file.buffer);
    const result = await moduleService.bulkCreateModule(data, organizationId, sectionCode);

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
          title: "Module Management - Bulk Import Modules",
        },
        action: "create",
        description: `Bulk imported ${data.length} modules for section: ${sectionCode}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "module",
        createdAt: new Date(),
      });

      await auditLogService
        .createAuditLog({
          user: new mongoose.Types.ObjectId((req as any).user.id),
          type: "CREATE",
          severity: "INFO",
          entity: {
            type: "MODULE",
            id: new mongoose.Types.ObjectId(),
          },
          changes: {
            before: {},
            after: {
              count: data.length,
              summary: `${data.length} modules imported`,
            },
          },
          metadata: {
            userAgent: req.get("user-agent"),
            ip: req.ip,
            path: req.path,
            method: req.method,
          },
          description: `Bulk imported ${data.length} modules via CSV upload`,
        })
        .catch((error) => {
          console.error("Error saving audit log for bulk import:", error);
        });
    }

    res.status(200).send({ message: config.SUCCESS.MODULE.BULK_IMPORT, result });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function archiveModule(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "User not authenticated or missing organization" });
    }

    const archivedModule = await moduleService.archiveModule(id);

    if (!archivedModule) {
      return res.status(404).json({ message: "Module not found" });
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
        title: "Module Management - Archive Module",
      },
      action: "archive",
      description: `Archived module: ${archivedModule.title || id}`,
      organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
      entityType: "module",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(req.user.id),
      type: "UPDATE",
      severity: "INFO",
      entity: {
        type: "MODULE",
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
      description: `Archived module with ID ${id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });

    res.status(200).json({
      message: config.SUCCESS.MODULE.ARCHIVE,
      data: archivedModule,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}
