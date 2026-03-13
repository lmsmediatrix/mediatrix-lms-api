import express, { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { ACTION, USER_ROLES } from "../config/common";
import { API_ENDPOINTS } from "../config/endpointsConfig";
import { handleZodError } from "../middleware/zodErrorHandler";
import { ProviderZodSchema } from "../models/providerModel";
import providerService from "../services/providerService";
import { CustomRequest } from "../type/types";
import { ValidationSchemas } from "../helper/validationSchemas";
import auditLogService from "../services/auditLogService";
import activityLogService from "../services/activityLogService";
import { validatePermissions } from "../middleware/rabcMiddleware";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Providers
 *   description: Provider management endpoints for handling service providers, their details, and related operations
 */

/**
 * @swagger
 * /api/provider/get/all:
 *   get:
 *     summary: Get all providers with filtering and pagination
 *     description: Retrieve a list of all providers with support for filtering, sorting, pagination, and field selection
 *     tags: [Providers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: object
 *         description: Query parameters for filtering providers (e.g., name, status, type)
 *       - in: query
 *         name: queryArray
 *         schema:
 *           type: array
 *         description: Array of query parameters for complex filtering
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: Fields to populate (e.g., services, contacts)
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
 *         description: List of providers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Providers retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Provider'
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
  API_ENDPOINTS.PROVIDER.GET_ALL,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN], ACTION.GET_ALL),
  getProviders
);

/**
 * @swagger
 * /api/provider/get/{id}:
 *   get:
 *     summary: Get provider by ID with detailed information
 *     description: Retrieve detailed information about a specific provider by its ID
 *     tags: [Providers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Provider ID
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: Fields to populate (e.g., services, contacts)
 *       - in: query
 *         name: select
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Fields to select in the response
 *     responses:
 *       200:
 *         description: Provider retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Provider retrieved successfully
 *                 data:
 *                   $ref: '#/components/schemas/Provider'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Provider not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.PROVIDER.GET_BY_ID,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN], ACTION.GET_BY_ID),
  getProvider
);

/**
 * @swagger
 * /api/provider/create:
 *   post:
 *     summary: Create a new provider
 *     description: Create a new service provider with contact information and details
 *     tags: [Providers]
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
 *                 description: Provider name
 *                 example: "ABC Services Inc."
 *               description:
 *                 type: string
 *                 description: Detailed description of the provider
 *                 example: "Leading provider of educational services"
 *               contactEmail:
 *                 type: string
 *                 format: email
 *                 description: Primary contact email
 *                 example: "contact@abcservices.com"
 *               contactPhone:
 *                 type: string
 *                 description: Primary contact phone number
 *                 example: "+1-234-567-8900"
 *               website:
 *                 type: string
 *                 format: url
 *                 description: Provider's website URL
 *                 example: "https://www.abcservices.com"
 *     responses:
 *       201:
 *         description: Provider created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Provider created successfully
 *                 data:
 *                   $ref: '#/components/schemas/Provider'
 *       400:
 *         description: Invalid input - Missing required fields or invalid data
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.PROVIDER.CREATE,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN], ACTION.CREATE),
  createProvider
);

/**
 * @swagger
 * /api/provider/update:
 *   put:
 *     summary: Update provider details
 *     description: Update provider properties including contact information and settings
 *     tags: [Providers]
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
 *                 description: Provider ID
 *                 example: "60d21b4667d0d8992e610c85"
 *               name:
 *                 type: string
 *                 description: Updated provider name
 *                 example: "ABC Services Inc."
 *               description:
 *                 type: string
 *                 description: Updated provider description
 *                 example: "Updated description of services"
 *               contactEmail:
 *                 type: string
 *                 format: email
 *                 description: Updated contact email
 *                 example: "contact@abcservices.com"
 *               contactPhone:
 *                 type: string
 *                 description: Updated contact phone number
 *                 example: "+1-234-567-8900"
 *               website:
 *                 type: string
 *                 format: url
 *                 description: Updated website URL
 *                 example: "https://www.abcservices.com"
 *     responses:
 *       200:
 *         description: Provider updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Provider updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/Provider'
 *       400:
 *         description: Invalid input - Missing required fields or invalid data
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Provider not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.PROVIDER.UPDATE,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN], ACTION.UPDATE),
  updateProvider
);

/**
 * @swagger
 * /api/provider/remove/{id}:
 *   delete:
 *     summary: Delete a provider
 *     description: Permanently delete a provider and all its associated data
 *     tags: [Providers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Provider ID to delete
 *     responses:
 *       200:
 *         description: Provider deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Provider deleted successfully
 *                 data:
 *                   $ref: '#/components/schemas/Provider'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: Provider not found
 *       500:
 *         description: Server error
 */
router.delete(
  API_ENDPOINTS.PROVIDER.REMOVE,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN], ACTION.DELETE),
  deleteProvider
);

/**
 * @swagger
 * /api/provider/search:
 *   post:
 *     summary: Search providers with custom criteria
 *     description: Search for providers using custom search criteria and filters
 *     tags: [Providers]
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
 *                 example: { "name": "ABC", "type": "Educational" }
 *     responses:
 *       200:
 *         description: List of providers matching search criteria
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Provider'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.PROVIDER.SEARCH,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN], ACTION.CUSTOM),
  searchProviders
);

export default router;

export async function getProviders(req: CustomRequest, res: Response) {
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

    if (!req.user || !req.user.organizationId) {
      throw new Error("User not authenticated or missing organization");
    }
    params.query.organizationId = req.user.organizationId;

    const { providers, pagination, count } = await providerService.getProviders(params);

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
          title: "Provider Management - View All Providers",
        },
        action: "read",
        description: `Retrieved ${providers} providers${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId(req.user.organizationId) || undefined,
        entityType: "provider",
        createdAt: new Date(),
      });
    }

    res
      .status(200)
      .send({ message: "Providers retrieved successfully", data: providers, pagination, count });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getProvider(req: CustomRequest, res: Response) {
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
      query: { organizationId: req.user.organizationId },
    };

    const provider = await providerService.getProvider(id, dbParams);

    if (!provider) {
      return res.status(404).send({ message: "Provider not found" });
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
          title: "Provider Management - View Provider Details",
        },
        action: "read",
        description: `Viewed provider details for: ${provider.name}${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "provider",
        createdAt: new Date(),
      });
    }

    res.status(200).send({ message: "Provider retrieved successfully", data: provider });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function createProvider(req: Request, res: Response) {
  try {
    const validatedData = ProviderZodSchema.partial().parse(req.body);

    if (!(req as any).user?.organizationId) {
      throw new Error("User not authenticated or missing organization");
    }

    const providerData = {
      ...validatedData,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId),
    };

    const provider = await providerService.createProvider(providerData);

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
          title: "Provider Management - Create New Provider",
        },
        action: "create",
        description: `Created new provider: ${provider.name}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "provider",
        createdAt: new Date(),
      });
    }

    res.status(201).send({ message: "Provider created successfully", data: provider });

    await auditLogService.createAuditLog({
      user: (req as any).user?.id,
      type: "CREATE",
      severity: "INFO",
      entity: {
        type: "PROVIDER",
        id: new mongoose.Types.ObjectId(provider._id.toString()),
      },
      changes: {
        before: {},
        after: {
          name: provider.name,
          description: provider.description,
          contactEmail: provider.contactEmail,
          contactPhone: provider.contactPhone,
          website: provider.website,
          organizationId: provider.organizationId,
        },
      },
      metadata: {
        userAgent: req.get("user-agent"),
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      description: `Created new provider: ${provider.name}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });
  } catch (error) {
    console.error("Error in createProvider:", error);
    handleZodError(error, res);
  }
}

export async function updateProvider(req: CustomRequest, res: Response) {
  try {
    const validatedData = ProviderZodSchema.partial()
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

    const currentProvider = await providerService.getProvider(updateData._id.toString(), {
      query: { organizationId: (req as any).user.organizationId },
      select: fieldsToSelect,
    });

    const updatedProvider = await providerService.updateProvider(updateData);

    if (!updatedProvider) {
      return res.status(404).send({ message: "Provider not found" });
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
          title: "Provider Management - Update Provider",
        },
        action: "update",
        description: `Updated provider ${updatedProvider.name} with fields: ${Object.keys(req.body)
          .filter((key) => key !== "_id")
          .join(", ")}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "provider",
        createdAt: new Date(),
      });
    }

    res.status(200).send({ message: "Provider updated successfully", data: updatedProvider });

    const before: Record<string, any> = {};
    const after: Record<string, any> = {};

    fieldsToSelect.forEach((field) => {
      if ((currentProvider as any)?.[field] !== (updatedProvider as any)?.[field]) {
        before[field] = (currentProvider as any)?.[field];
        after[field] = (updatedProvider as any)?.[field];
      }
    });

    const changes = Object.keys(after).map((field) => {
      const oldValue = before[field] || "not set";
      const newValue = after[field] || "not set";
      return `${field}: ${oldValue} → ${newValue}`;
    });

    const description =
      changes.length > 0
        ? `Updated provider ${updatedProvider.name} - Changed: ${changes.join(", ")}`
        : `Updated provider ${updatedProvider.name} - No fields changed`;

    await auditLogService.createAuditLog({
      user: (req.user as any)?.id as mongoose.Types.ObjectId,
      type: "UPDATE",
      severity: "INFO",
      entity: {
        type: "PROVIDER",
        id: updatedProvider?._id as mongoose.Types.ObjectId,
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
    console.error("Error in updateProvider:", error);
    handleZodError(error, res);
  }
}

export async function deleteProvider(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "User not authenticated or missing organization" });
    }

    const currentProvider = await providerService.getProvider(id, {
      select: ["_id", "name", "description"],
    });

    if (!currentProvider) {
      return res.status(404).send({ message: "Provider not found" });
    }

    const deletedProvider = await providerService.deleteProvider(id);

    if (!deletedProvider) {
      return res.status(500).send({ message: "Failed to delete provider" });
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
          title: "Provider Management - Delete Provider",
        },
        action: "remove",
        description: `Deleted provider: ${currentProvider.name}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "provider",
        createdAt: new Date(),
      });
    }

    res.status(200).send({ message: "Provider deleted successfully", data: deletedProvider });

    const providerDetails = {
      name: currentProvider.name,
      description: currentProvider.description,
    };

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId((req as any).user.id),
      type: "DELETE",
      severity: "INFO",
      entity: {
        type: "PROVIDER",
        id: new mongoose.Types.ObjectId(id),
      },
      changes: {
        before: providerDetails,
        after: {},
      },
      metadata: {
        userAgent: req.get("user-agent"),
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      description: `Deleted provider ${providerDetails.name}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });
  } catch (error) {
    console.error("Error in deleteProvider:", error);
    handleZodError(error, res);
  }
}

export async function searchProviders(req: Request, res: Response) {
  try {
    if (!(req as any).user?.organizationId) {
      throw new Error("User not authenticated or missing organization");
    }

    const searchParams = {
      ...req.body,
      organizationId: (req as any).user.organizationId,
    };

    const providers = await providerService.searchProvider(searchParams);

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
          title: "Provider Management - Search Providers",
        },
        action: "read",
        description: `Searched providers with criteria: ${searchCriteria || "none"} (found ${providers?.length} results)`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "provider",
        createdAt: new Date(),
      });
    }

    res.status(200).send(providers);
  } catch (error) {
    handleZodError(error, res);
  }
}
