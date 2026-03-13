import express, { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { ACTION, USER_ROLES } from "../config/common";
import { API_ENDPOINTS } from "../config/endpointsConfig";
import { handleZodError } from "../middleware/zodErrorHandler";
import categoryService from "../services/categoryService";
import { CustomRequest } from "../type/types";
import { ValidationSchemas } from "../helper/validationSchemas";
import auditLogService from "../services/auditLogService";
import activityLogService from "../services/activityLogService";
import { validatePermissions } from "../middleware/rabcMiddleware";
import { CategoryZodSchema } from "../models/categoryModel";
import { sendCSVResponse } from "../utils/csvUtils/csvResponse";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: Category management endpoints for organizing and classifying content
 */

/**
 * @swagger
 * /api/category/get/all:
 *   get:
 *     summary: Get all categories
 *     description: Retrieve a list of all categories with optional filtering, sorting, and pagination
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: object
 *         description: Query parameters for filtering categories
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
 *         description: List of categories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Categories retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Category'
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
  API_ENDPOINTS.CATEGORY.GET_ALL,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN], ACTION.GET_ALL),
  getCategories
);

/**
 * @swagger
 * /api/category/get/{id}:
 *   get:
 *     summary: Get category by ID
 *     description: Retrieve a specific category by its unique identifier
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: Fields to populate
 *       - in: query
 *         name: select
 *         schema:
 *           type: array
 *         description: Fields to select
 *       - in: query
 *         name: lean
 *         schema:
 *           type: boolean
 *         description: Whether to return plain JavaScript objects
 *     responses:
 *       200:
 *         description: Category retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Category retrieved successfully
 *                 data:
 *                   $ref: '#/components/schemas/Category'
 *       404:
 *         description: Category not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.CATEGORY.GET_BY_ID,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN], ACTION.GET_BY_ID),
  getCategory
);

/**
 * @swagger
 * /api/category/create:
 *   post:
 *     summary: Create a new category
 *     description: Create a new category with specified details
 *     tags: [Categories]
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
 *                 description: Category name
 *               description:
 *                 type: string
 *                 description: Category description
 *               isActive:
 *                 type: boolean
 *                 description: Whether the category is active
 *               organizationId:
 *                 type: string
 *                 description: Organization ID that the category belongs to
 *     responses:
 *       201:
 *         description: Category created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Category created successfully
 *                 data:
 *                   $ref: '#/components/schemas/Category'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.CATEGORY.CREATE,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN], ACTION.CREATE),
  createCategory
);

/**
 * @swagger
 * /api/category/update:
 *   put:
 *     summary: Update a category
 *     description: Update an existing category's details
 *     tags: [Categories]
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
 *                 description: Category ID
 *               name:
 *                 type: string
 *                 description: Category name
 *               description:
 *                 type: string
 *                 description: Category description
 *               isActive:
 *                 type: boolean
 *                 description: Whether the category is active
 *               organizationId:
 *                 type: string
 *                 description: Organization ID that the category belongs to
 *     responses:
 *       200:
 *         description: Category updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Category updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/Category'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.CATEGORY.UPDATE,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN], ACTION.UPDATE),
  updateCategory
);

/**
 * @swagger
 * /api/category/remove/{id}:
 *   delete:
 *     summary: Delete a category
 *     description: Permanently delete a category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Category deleted successfully
 *                 data:
 *                   $ref: '#/components/schemas/Category'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 */
router.delete(
  API_ENDPOINTS.CATEGORY.REMOVE,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN], ACTION.DELETE),
  deleteCategory
);

/**
 * @swagger
 * /api/category/search:
 *   post:
 *     summary: Search categories
 *     description: Search and filter categories using various criteria
 *     tags: [Categories]
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
 *                     description: Search by category name
 *                   isActive:
 *                     type: boolean
 *                     description: Filter by active status
 *                   organizationId:
 *                     type: string
 *                     description: Filter by organization ID
 *     responses:
 *       200:
 *         description: List of categories matching search criteria
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Category'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.CATEGORY.SEARCH,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN], ACTION.CUSTOM),
  searchCategories
);

/**
 * @swagger
 * /api/category/export:
 *   post:
 *     summary: Export categories as CSV
 *     description: Export categories to CSV format with optional filtering
 *     tags: [Categories]
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
 *                 description: Query parameters for filtering categories
 *                 properties:
 *                   name:
 *                     type: string
 *                     description: Filter by category name
 *                   isActive:
 *                     type: boolean
 *                     description: Filter by active status
 *                   organizationId:
 *                     type: string
 *                     description: Filter by organization ID
 *               filename:
 *                 type: string
 *                 description: Custom filename for the exported CSV
 *     responses:
 *       200:
 *         description: Categories exported successfully
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
  API_ENDPOINTS.CATEGORY.EXPORT,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN], ACTION.CUSTOM),
  exportCategories
);

export default router;

/*
 * @desc   get all categories
 * @route  GET /api/category/get/all
 * @access Private/Admin
 */
export async function getCategories(req: CustomRequest, res: Response) {
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
      populateArray: req.query.populateArray
        ? req.query.populateArray
            .toString()
            .split(" ")
            .map((path, index) => ({
              path,
              select: req.query.populateSelect?.toString().split(",")[index]?.trim() || "",
            }))
        : [],
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
    params.query.organizationId = (req as any).user.organizationId;

    const { categories, pagination, count } = await categoryService.getCategories(params);

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
          title: "View All Categories",
        },
        action: "read",
        description: `Retrieved ${categories} categories${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "category",
        createdAt: new Date(),
      });
    }

    res
      .status(200)
      .send({ message: "Categories retrieved successfully", data: categories, pagination, count });
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   get category by id
 * @route  GET /api/category/get/:id
 * @access Private/Admin
 */
export async function getCategory(req: CustomRequest, res: Response) {
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

    const dbParams = {
      ...params,
      query: { organizationId: (req as any).user.organizationId },
    };

    const category = await categoryService.getCategory(id, dbParams);

    if (!category) {
      return res.status(404).send({ message: "Category not found" });
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
          title: "View Category Details",
        },
        action: "read",
        description: `Viewed category details for: ${category.name}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "category",
        createdAt: new Date(),
      });
    }

    res.status(200).send({ message: "Category retrieved successfully", data: category });
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   create category
 * @route  POST /api/category/create
 * @access Private/Admin
 */
export async function createCategory(req: Request, res: Response) {
  try {
    const validatedData = CategoryZodSchema.partial().parse(req.body);

    const categoryData = {
      ...validatedData,
      organizationId: (req as any).user.organizationId,
    };

    const category = await categoryService.createCategory(categoryData);

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
          title: "Create New Category",
        },
        action: "create",
        description: `Created new category: ${category.name}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "category",
        createdAt: new Date(),
      });
    }

    res.status(201).send({ message: "Category created successfully", data: category });

    await auditLogService.createAuditLog({
      user: (req as any).user?.id,
      type: "CREATE",
      severity: "INFO",
      entity: {
        type: "CATEGORY",
        id: new mongoose.Types.ObjectId(category._id.toString()),
      },
      changes: {
        before: {},
        after: {
          name: category.name,
          isActive: category.isActive,
          organizationId: category.organizationId,
        },
      },
      metadata: {
        userAgent: req.get("user-agent"),
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      description: `Created new category: ${category.name}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });
  } catch (error) {
    console.error("Error in createCategory:", error);
    handleZodError(error, res);
  }
}

/*
 * @desc   update category
 * @route  PUT /api/category/update
 * @access Private/Admin
 */
export async function updateCategory(req: CustomRequest, res: Response) {
  try {
    const validatedData = CategoryZodSchema.partial()
      .extend({
        _id: z.string().min(1),
      })
      .parse(req.body);

    const fieldsToSelect = Object.keys(req.body).filter((field) => !["_id"].includes(field));

    const updateData = {
      ...validatedData,
      _id: new mongoose.Types.ObjectId(validatedData._id as string),
      organizationId: (req as any).user.organizationId,
    };

    const currentCategory = await categoryService.getCategory(updateData._id.toString(), {
      query: { organizationId: (req as any).user.organizationId },
      select: fieldsToSelect,
    });

    const updatedCategory = await categoryService.updateCategory(updateData);

    if (!updatedCategory) {
      return res.status(404).send({ message: "Category not found" });
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
          title: "Update Category",
        },
        action: "update",
        description: `Updated category: ${updatedCategory.name} with fields: ${fieldsToSelect.join(", ")}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "category",
        createdAt: new Date(),
      });
    }

    res.status(200).send({ message: "Category updated successfully", data: updatedCategory });

    const before: Record<string, any> = {};
    const after: Record<string, any> = {};

    fieldsToSelect.forEach((field) => {
      if ((currentCategory as any)?.[field] !== (updatedCategory as any)?.[field]) {
        before[field] = (currentCategory as any)?.[field];
        after[field] = (updatedCategory as any)?.[field];
      }
    });

    const changes = Object.keys(after).map((field) => {
      const oldValue = before[field] || "not set";
      const newValue = after[field] || "not set";
      return `${field}: ${oldValue} → ${newValue}`;
    });

    const description =
      changes.length > 0
        ? `Updated category ${updatedCategory.name} - Changed: ${changes.join(", ")}`
        : `Updated category ${updatedCategory.name} - No fields changed`;

    await auditLogService.createAuditLog({
      user: (req.user as any)?.id as mongoose.Types.ObjectId,
      type: "UPDATE",
      severity: "INFO",
      entity: {
        type: "CATEGORY",
        id: updatedCategory?._id as mongoose.Types.ObjectId,
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
      description,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });
  } catch (error) {
    console.error("Error in updateCategory:", error);
    handleZodError(error, res);
  }
}

/*
 * @desc   delete category
 * @route  DELETE /api/category/remove/:id
 * @access Private/Admin
 */
export async function deleteCategory(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    const currentCategory = await categoryService.getCategory(id, {
      select: ["_id", "name", "isActive"],
    });

    if (!currentCategory) {
      return res.status(404).send({ message: "Category not found" });
    }

    const deletedCategory = await categoryService.deleteCategory(id);

    if (!deletedCategory) {
      return res.status(500).send({ message: "Failed to delete category" });
    }
    res.status(200).send({ message: "Category deleted successfully", data: deletedCategory });

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
          title: "Delete Category",
        },
        action: "remove",
        description: `Deleted category: ${currentCategory.name}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "category",
        createdAt: new Date(),
      });
    }
    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId((req as any).user.id),
      type: "DELETE",
      severity: "INFO",
      entity: {
        type: "CATEGORY",
        id: new mongoose.Types.ObjectId(id),
      },
      changes: {
        before: {
          name: currentCategory.name,
          isActive: currentCategory.isActive,
        },
        after: {},
      },
      metadata: {
        userAgent: req.get("user-agent"),
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      description: `Deleted category ${currentCategory.name}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });
  } catch (error) {
    console.error("Error in deleteCategory:", error);
    handleZodError(error, res);
  }
}

/*
 * @desc   search categories
 * @route  POST /api/category/search
 * @access Private/Admin
 */
export async function searchCategories(req: Request, res: Response) {
  try {
    const searchParams = {
      ...req.body,
      query: {
        ...req.body.query,
        organizationId: (req as any).user.organizationId,
      },
    };

    const categories = await categoryService.searchCategory(searchParams);

    if ((req as any).user) {
      const searchCriteria = Object.entries(req.body)
        .filter(([key]) => key !== "query")
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
          title: "Search Categories",
        },
        action: "read",
        description: `Category search performed${searchCriteria ? ` with criteria: ${searchCriteria}` : ""} (found ${categories?.length || 0} results)`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "category",
        createdAt: new Date(),
      });
    }

    res.status(200).send(categories);
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   export categories as CSV
 * @route  POST /api/category/export
 * @access Private/Admin
 */
export async function exportCategories(req: CustomRequest, res: Response) {
  try {
    const requestBody = { ...req.body };
    if (req.user && req.user.id) {
      requestBody.currentUserId = req.user.id;
    }
    let filename = "categories";
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
    const csv = await categoryService.exportCategory(requestBody, organizationId);
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
          title: "Export Categories",
        },
        action: "export",
        description: `Exported categories list`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "category",
        createdAt: new Date(),
      });
    }
  } catch (error) {
    console.error("Error exporting category data:", error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "An unexpected error occurred",
      status: "error",
      details: error instanceof Error ? error.stack : String(error),
    });
  }
}
