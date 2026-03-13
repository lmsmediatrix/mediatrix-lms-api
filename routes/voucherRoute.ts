import express, { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { ACTION, USER_ROLES } from "../config/common";
import { API_ENDPOINTS } from "../config/endpointsConfig";
import { handleZodError } from "../middleware/zodErrorHandler";
import { VoucherZodSchema } from "../models/voucherModel";
import voucherService from "../services/voucherService";
import { CustomRequest } from "../type/types";
import { ValidationSchemas } from "../helper/validationSchemas";
import auditLogService from "../services/auditLogService";
import activityLogService from "../services/activityLogService";
import { validatePermissions } from "../middleware/rabcMiddleware";
import { parseCSVBuffer } from "../utils/csvUtils/csvUtils";
import multer from "multer";

const upload = multer();

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Vouchers
 *   description: Voucher management endpoints for handling discount vouchers, promotions, and related operations
 */

/**
 * @swagger
 * /api/voucher/get/all:
 *   get:
 *     summary: View all vouchers
 *     description: Retrieve a list of all vouchers with optional filtering, sorting, and pagination
 *     tags: [Vouchers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: object
 *         description: Query parameters for filtering vouchers
 *       - in: query
 *         name: queryArray
 *         schema:
 *           type: array
 *         description: Array of query parameters for complex filtering
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: Fields to populate in the response
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort criteria (e.g., "createdAt:desc")
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
 *     responses:
 *       200:
 *         description: List of vouchers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Vouchers retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Voucher'
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
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.VOUCHER.GET_ALL,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN], ACTION.GET_ALL),
  getVouchers
);

/**
 * @swagger
 * /api/voucher/get/{id}:
 *   get:
 *     summary: View voucher details
 *     description: Retrieve detailed information about a specific voucher
 *     tags: [Vouchers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Voucher ID
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: Fields to populate in the response
 *       - in: query
 *         name: select
 *         schema:
 *           type: array
 *         description: Fields to select in the response
 *     responses:
 *       200:
 *         description: Voucher details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Voucher retrieved successfully
 *                 data:
 *                   $ref: '#/components/schemas/Voucher'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Voucher not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.VOUCHER.GET_BY_ID,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN], ACTION.GET_BY_ID),
  getVoucher
);

/**
 * @swagger
 * /api/voucher/create:
 *   post:
 *     summary: Create new voucher
 *     description: Create a new voucher with the provided details
 *     tags: [Vouchers]
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
 *               - discount
 *             properties:
 *               name:
 *                 type: string
 *                 description: Voucher name
 *               code:
 *                 type: string
 *                 description: Unique voucher code
 *               description:
 *                 type: string
 *                 description: Voucher description
 *               status:
 *                 type: string
 *                 enum: [active, inactive, used, expired]
 *                 description: Voucher status
 *               expiryDate:
 *                 type: string
 *                 format: date-time
 *                 description: Voucher expiry date
 *               discount:
 *                 type: number
 *                 description: Discount percentage (0-100)
 *               providerName:
 *                 type: string
 *                 description: Name of the voucher provider
 *               issuedTo:
 *                 type: string
 *                 description: User ID the voucher is issued to
 *     responses:
 *       201:
 *         description: Voucher created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Voucher created successfully
 *                 data:
 *                   $ref: '#/components/schemas/Voucher'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.VOUCHER.CREATE,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN], ACTION.CREATE),
  createVoucher
);

/**
 * @swagger
 * /api/voucher/update:
 *   put:
 *     summary: Update voucher
 *     description: Update an existing voucher's information
 *     tags: [Vouchers]
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
 *                 description: Voucher ID to update
 *               name:
 *                 type: string
 *                 description: New voucher name
 *               code:
 *                 type: string
 *                 description: New voucher code
 *               description:
 *                 type: string
 *                 description: New voucher description
 *               status:
 *                 type: string
 *                 enum: [active, inactive, used, expired]
 *                 description: New voucher status
 *               expiryDate:
 *                 type: string
 *                 format: date-time
 *                 description: New expiry date
 *               discount:
 *                 type: number
 *                 description: New discount percentage (0-100)
 *               providerName:
 *                 type: string
 *                 description: New provider name
 *     responses:
 *       200:
 *         description: Voucher updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Voucher updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/Voucher'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Voucher not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.VOUCHER.UPDATE,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN], ACTION.UPDATE),
  updateVoucher
);

/**
 * @swagger
 * /api/voucher/remove/{id}:
 *   delete:
 *     summary: Delete voucher
 *     description: Permanently delete a voucher
 *     tags: [Vouchers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Voucher ID to delete
 *     responses:
 *       200:
 *         description: Voucher deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Voucher deleted successfully
 *                 data:
 *                   $ref: '#/components/schemas/Voucher'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Voucher not found
 *       500:
 *         description: Server error
 */
router.delete(
  API_ENDPOINTS.VOUCHER.REMOVE,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN], ACTION.DELETE),
  deleteVoucher
);

/**
 * @swagger
 * /api/voucher/search:
 *   post:
 *     summary: Search vouchers
 *     description: Search for vouchers based on provided criteria
 *     tags: [Vouchers]
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
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Voucher'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.VOUCHER.SEARCH,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN], ACTION.CUSTOM),
  searchVouchers
);

/**
 * @swagger
 * /api/voucher/create/bulk:
 *   post:
 *     summary: Bulk import vouchers
 *     description: Import multiple vouchers from a CSV file or create them in bulk
 *     tags: [Vouchers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               count:
 *                 type: number
 *                 description: Number of vouchers to create (when not using CSV)
 *               prefix:
 *                 type: string
 *                 description: Optional prefix for voucher codes
 *               name:
 *                 type: string
 *                 description: Voucher name
 *               description:
 *                 type: string
 *                 description: Voucher description
 *               issuedTo:
 *                 type: string
 *                 description: User ID the vouchers are issued to
 *               expiryDate:
 *                 type: string
 *                 format: date-time
 *                 description: Optional expiry date
 *               discount:
 *                 type: number
 *                 description: Discount percentage (0-100)
 *               providerName:
 *                 type: string
 *                 description: Name of the voucher provider
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file for bulk voucher import
 *     responses:
 *       200:
 *         description: Vouchers imported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Successfully created X vouchers (Y failed)
 *                 result:
 *                   type: object
 *                   properties:
 *                     successCount:
 *                       type: number
 *                     errorCount:
 *                       type: number
 *       400:
 *         description: Invalid input or no file provided
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.VOUCHER.BULK_CREATE,
  upload.single("file"),
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN], ACTION.CREATE),
  bulkCreateVouchers
);

export default router;

export async function getVouchers(req: CustomRequest, res: Response) {
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

    const { vouchers, pagination, count } = await voucherService.getVouchers(params);

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
          title: "Voucher Management - View All Vouchers",
        },
        action: "read",
        description: `Retrieved ${vouchers.length} vouchers${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "voucher",
        createdAt: new Date(),
      });
    }

    res
      .status(200)
      .send({ message: "Vouchers retrieved successfully", data: vouchers, pagination, count });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getVoucher(req: CustomRequest, res: Response) {
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

    const voucher = await voucherService.getVoucher(id, dbParams);

    if (!voucher) {
      return res.status(404).send({ message: "Voucher not found" });
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
          title: "Voucher Management - View Voucher Details",
        },
        action: "read",
        description: `Viewed voucher details for code: ${voucher.code}${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "voucher",
        createdAt: new Date(),
      });
    }

    res.status(200).send({ message: "Voucher retrieved successfully", data: voucher });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function createVoucher(req: Request, res: Response) {
  try {
    const validatedData = VoucherZodSchema.partial().parse(req.body);

    const voucherData = {
      ...validatedData,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId),
      issuedTo: new mongoose.Types.ObjectId(validatedData.issuedTo as any),
    };

    const voucher = await voucherService.createVoucher(voucherData);

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
          title: "Voucher Management - Create New Voucher",
        },
        action: "create",
        description: `Created new voucher: ${voucher.code}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "voucher",
        createdAt: new Date(),
      });
    }

    res.status(201).send({ message: "Voucher created successfully", data: voucher });

    await auditLogService.createAuditLog({
      user: (req as any).user?.id,
      type: "CREATE",
      severity: "INFO",
      entity: {
        type: "VOUCHER",
        id: new mongoose.Types.ObjectId(voucher._id.toString()),
      },
      changes: {
        before: {},
        after: {
          name: voucher.name,
          code: voucher.code,
          status: voucher.status,
          issuedTo: voucher.issuedTo,
          expiryDate: voucher.expiryDate,
          providerId: voucher.providerId,
          discount: voucher.discount,
          organizationId: voucher.organizationId,
        },
      },
      metadata: {
        userAgent: req.get("user-agent"),
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      description: `Created new voucher code: ${voucher.code} (${voucher.name})`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function updateVoucher(req: CustomRequest, res: Response) {
  try {
    const validatedData = VoucherZodSchema.partial()
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

    const currentVoucher = await voucherService.getVoucher(updateData._id.toString(), {
      query: { organizationId: (req as any).user.organizationId },
      select: fieldsToSelect,
    });

    const updatedVoucher = await voucherService.updateVoucher(updateData);

    if (!updatedVoucher) {
      return res.status(404).send({ message: "Voucher not found" });
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
          title: "Voucher Management - Update Voucher",
        },
        action: "update",
        description: `Updated voucher ${updatedVoucher.code} with fields: ${fieldsToSelect.join(", ")}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "voucher",
        createdAt: new Date(),
      });
    }

    res.status(200).send({ message: "Voucher updated successfully", data: updatedVoucher });

    const before: Record<string, any> = {};
    const after: Record<string, any> = {};

    fieldsToSelect.forEach((field) => {
      if ((currentVoucher as any)?.[field] !== (updatedVoucher as any)?.[field]) {
        before[field] = (currentVoucher as any)?.[field];
        after[field] = (updatedVoucher as any)?.[field];
      }
    });

    const changes = Object.keys(after).map((field) => {
      const oldValue = before[field] || "not set";
      const newValue = after[field] || "not set";
      return `${field}: ${oldValue} → ${newValue}`;
    });

    const description =
      changes.length > 0
        ? `Updated voucher ${updatedVoucher.code} - Changed: ${changes.join(", ")}`
        : `Updated voucher ${updatedVoucher.code} - No fields changed`;

    await auditLogService.createAuditLog({
      user: (req.user as any)?.id as mongoose.Types.ObjectId,
      type: "UPDATE",
      severity: "INFO",
      entity: {
        type: "VOUCHER",
        id: updatedVoucher?._id as mongoose.Types.ObjectId,
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
    console.error("Error in updateVoucher:", error);
    handleZodError(error, res);
  }
}

export async function deleteVoucher(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    const currentVoucher = await voucherService.getVoucher(id, {
      select: ["_id", "code", "name", "status", "issuedTo"],
    });

    if (!currentVoucher) {
      return res.status(404).send({ message: "Voucher not found" });
    }

    const deletedVoucher = await voucherService.deleteVoucher(id);

    if (!deletedVoucher) {
      return res.status(500).send({ message: "Failed to delete voucher" });
    }
    res.status(200).send({ message: "Voucher deleted successfully", data: deletedVoucher });

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
          title: "Voucher Management - Delete Voucher",
        },
        action: "remove",
        description: `Deleted voucher: ${currentVoucher.code} (${currentVoucher.name})`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "voucher",
        createdAt: new Date(),
      });
    }
    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId((req as any).user.id),
      type: "DELETE",
      severity: "INFO",
      entity: {
        type: "VOUCHER",
        id: new mongoose.Types.ObjectId(id),
      },
      changes: {
        before: {
          code: currentVoucher.code,
          name: currentVoucher.name,
          status: currentVoucher.status,
          issuedTo: currentVoucher.issuedTo,
        },
        after: {},
      },
      metadata: {
        userAgent: req.get("user-agent"),
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      description: `Deleted voucher ${currentVoucher.code} (${currentVoucher.name})`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });
  } catch (error) {
    console.error("Error in deleteVoucher:", error);
    handleZodError(error, res);
  }
}

export async function searchVouchers(req: Request, res: Response) {
  try {
    const searchParams = {
      ...req.body,
      query: {
        ...req.body.query,
        organizationId: (req as any).user.organizationId,
      },
    };

    const vouchers = await voucherService.searchVoucher(searchParams);

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
          title: "Voucher Management - Search Vouchers",
        },
        action: "read",
        description: `Searched vouchers with criteria: ${searchCriteria || "none"} (found ${vouchers?.length} results)`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "voucher",
        createdAt: new Date(),
      });
    }

    res.status(200).send(vouchers);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function bulkCreateVouchers(req: CustomRequest, res: Response) {
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
        result = await voucherService.bulkCreateVouchers({
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
              title: "Voucher Management - Bulk Import Vouchers",
            },
            action: "create",
            description: `Bulk created ${csvData.length} vouchers via CSV import (${result.successCount} successful, ${result.errorCount} failed)`,
            organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
            entityType: "voucher",
            createdAt: new Date(),
          });
        }

        await auditLogService.createAuditLog({
          user: (req.user as any)?.id as mongoose.Types.ObjectId,
          type: "CREATE",
          severity: "INFO",
          entity: {
            type: "VOUCHER",
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
          description: `Bulk created ${result.successCount} vouchers via CSV import`,
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
      message: `Successfully created ${result.successCount} vouchers (${result.errorCount} failed)`,
      result: result,
    });
  } catch (error) {
    console.error("Error bulk creating vouchers:", error);
    handleZodError(error, res);
  }
}
