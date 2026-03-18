import express, { CookieOptions, Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { ACTION, config, USER_ROLES } from "../config/common";
import { API_ENDPOINTS } from "../config/endpointsConfig";
import { handleZodError } from "../middleware/zodErrorHandler";
import { UserZodSchema } from "../models/userModel";
import userService from "../services/userService";
import { CustomRequest } from "../type/types";
import { upload } from "../middleware/multer";
import cloudinaryService from "../services/cloudinaryService";
import { ValidationSchemas } from "../helper/validationSchemas";
import auditLogService from "../services/auditLogService";
import activityLogService from "../services/activityLogService";
import { parseCSVBuffer } from "../utils/csvUtils/csvUtils";
import unifiedAuthMiddleware from "../middleware/authMiddleware";
import { validatePermissions } from "../middleware/rabcMiddleware";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management endpoints for handling user accounts, authentication, and related operations
 */

/**
 * @swagger
 * /api/user/get/all:
 *   get:
 *     summary: View all users
 *     description: Retrieve a list of all users with optional filtering, sorting, and pagination
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: object
 *         description: Query parameters for filtering users
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
 *         description: List of users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Users retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
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
router.get(API_ENDPOINTS.USER.GET_ALL, getUsers);

/**
 * @swagger
 * /api/user/get/{id}:
 *   get:
 *     summary: View user details
 *     description: Retrieve detailed information about a specific user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
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
 *         description: User details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User retrieved successfully
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get(API_ENDPOINTS.USER.GET_BY_ID, getUser);

/**
 * @swagger
 * /api/user/create:
 *   post:
 *     summary: Create new user
 *     description: Create a new user account with the provided details
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: User profile picture
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 description: User password
 *               firstName:
 *                 type: string
 *                 description: User's first name
 *               lastName:
 *                 type: string
 *                 description: User's last name
 *               role:
 *                 type: string
 *                 enum: [student, instructor, admin, superadmin]
 *                 description: User role
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User created successfully
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.USER.CREATE,
  upload.fields([{ name: "avatar", maxCount: 1 }]),
  createUser
);

/**
 * @swagger
 * /api/user/update:
 *   put:
 *     summary: Update user
 *     description: Update an existing user's information
 *     tags: [Users]
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
 *                 description: User ID to update
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: New profile picture
 *               email:
 *                 type: string
 *                 format: email
 *                 description: New email address
 *               firstName:
 *                 type: string
 *                 description: New first name
 *               lastName:
 *                 type: string
 *                 description: New last name
 *               oldPassword:
 *                 type: string
 *                 minLength: 6
 *                 description: Current password for verification
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 description: New password
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.put(API_ENDPOINTS.USER.UPDATE, upload.fields([{ name: "avatar", maxCount: 1 }]), updateUser);

/**
 * @swagger
 * /api/user/remove/{id}:
 *   delete:
 *     summary: Delete user
 *     description: Permanently delete a user account
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to delete
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User deleted successfully
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.delete(API_ENDPOINTS.USER.REMOVE, deleteUser);

/**
 * @swagger
 * /api/user/login:
 *   post:
 *     summary: User login
 *     description: Authenticate user and create session
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 description: User password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *                   description: JWT authentication token
 *                 message:
 *                   type: string
 *                   example: Login successful
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
router.post(API_ENDPOINTS.USER.LOGIN, loginUser);

/**
 * @swagger
 * /api/user/logout:
 *   get:
 *     summary: User logout
 *     description: End user session and clear authentication
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Logout successful
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Server error
 */
router.get(API_ENDPOINTS.USER.LOGOUT, logoutUser);

/**
 * @swagger
 * /api/user/check-login:
 *   get:
 *     summary: Check session
 *     description: Verify current user session and retrieve user details
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Session valid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Session invalid or expired
 *       500:
 *         description: Server error
 */
router.get(API_ENDPOINTS.USER.CHECKLOGIN, unifiedAuthMiddleware, currentUser);

/**
 * @swagger
 * /api/user/search:
 *   post:
 *     summary: Search users
 *     description: Search for users based on provided criteria
 *     tags: [Users]
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
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Server error
 */
router.post(API_ENDPOINTS.USER.SEARCH, searchUser);

/**
 * @swagger
 * /api/user/upload-image/{id}:
 *   post:
 *     summary: Update profile picture
 *     description: Upload and update user profile picture
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Profile picture file
 *     responses:
 *       200:
 *         description: Profile picture updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: No image uploaded
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post(API_ENDPOINTS.USER.UPLOAD, upload.single("image"), uploadImage);

/**
 * @swagger
 * /api/user/metrics:
 *   get:
 *     summary: View metrics
 *     description: Retrieve user-related metrics and statistics
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *         description: Filter criteria for metrics
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Type of metrics to retrieve
 *     responses:
 *       200:
 *         description: Metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Metrics retrieved successfully
 *                 data:
 *                   type: object
 *                   description: Metrics data
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Server error
 */
router.get(API_ENDPOINTS.USER.METRICS, getUserMetrics);

/**
 * @swagger
 * /api/user/create/bulk:
 *   post:
 *     summary: Bulk import users
 *     description: Import multiple users from a CSV file
 *     tags: [Users]
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
 *                 description: CSV file containing user data
 *     responses:
 *       200:
 *         description: Users imported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Users imported successfully
 *                 result:
 *                   type: object
 *                   description: Import results
 *       400:
 *         description: No file uploaded or missing organization ID
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Server error
 */
router.post(API_ENDPOINTS.USER.BULK_CREATE, upload.single("file"), bulkCreate);

/**
 * @swagger
 * /api/user/archive/{id}:
 *   put:
 *     summary: Archive user
 *     description: Soft delete a user by marking them as archived
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to archive
 *     responses:
 *       200:
 *         description: User archived successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User archived successfully
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.USER.ARCHIVE,
  validatePermissions(
    [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN, USER_ROLES.INSTRUCTOR],
    ACTION.ARCHIVE
  ),
  archiveUser
);

/**
 * @swagger
 * /api/user/reset-password:
 *   post:
 *     summary: Reset user password
 *     description: Reset user password to a default value
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - firstName
 *               - lastName
 *             properties:
 *               id:
 *                 type: string
 *                 description: User ID
 *               firstName:
 *                 type: string
 *                 description: User's first name
 *               lastName:
 *                 type: string
 *                 description: User's last name
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Password reset successfully
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post(API_ENDPOINTS.USER.RESET_PASSWORD, resetPassword);

export default router;

export async function getUsers(req: CustomRequest, res: Response) {
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

    const { users, pagination, count } = await userService.getUsers(params);

    res.status(200).send({ message: config.SUCCESS.USER.GET_ALL, data: users, pagination, count });
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
          title: "User Management - View All Users",
        },
        action: "read",
        description: `Retrieved ${users.length} users${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId(req.user.organizationId) || undefined,
        entityType: "user",
        createdAt: new Date(),
      });
    }
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getUser(req: CustomRequest, res: Response) {
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

    const user = await userService.getUser(id, dbParams);

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    res.status(200).send({ message: config.SUCCESS.USER.GET_BY_ID, data: user });
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
          title: "User Management - View User Details",
        },
        action: "read",
        description: `Viewed user details for ${user.email || id}${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "user",
        createdAt: new Date(),
      });
    }
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function createUser(req: Request, res: Response) {
  try {
    const requestBody = {
      ...req.body,
      isPasswordChanged: req.body.isPasswordChanged === "true",
    };

    const validatedData = UserZodSchema.partial()
      .extend({ path: z.string().optional() })
      .parse(requestBody);

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const user = await userService.createUser(validatedData, files);
    res.status(201).send({ message: config.SUCCESS.USER.CREATE, data: user });
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
          title: "User Management - Create New User",
        },
        action: "create",
        description: `Created new user account: ${user.email} (${user.firstName} ${user.lastName}) with role ${user.role}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "user",
        createdAt: new Date(),
      });
    }

    const userDetails = {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organizationId: user.organizationId,
      avatar: user.avatar,
    };

    await auditLogService.createAuditLog({
      user: (req as any).user?.id,
      type: "CREATE",
      severity: "INFO",
      entity: {
        type: "USER",
        id: user._id,
      },
      changes: {
        before: {},
        after: userDetails,
      },
      metadata: {
        userAgent: req.get("user-agent"),
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      description: `Created new user ${userDetails.email} (${userDetails.firstName} ${userDetails.lastName}) with role: ${userDetails.role}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function updateUser(req: CustomRequest, res: Response) {
  try {
    const requestBody = {
      ...req.body,
      ...(req.body.isPasswordChanged !== undefined && {
        isPasswordChanged: req.body.isPasswordChanged === "true",
      }),
    };

    const validatedData = UserZodSchema.partial()
      .extend({
        _id: z.string().min(1),
        oldPassword: z.string().min(6).optional(),
        newPassword: z.string().min(6).optional(),
        path: z.string().optional(),
      })
      .parse(requestBody);

    const fieldsToSelect = Object.keys(requestBody).filter(
      (field) => !["_id", "oldPassword", "newPassword", "path", "isPasswordChanged"].includes(field)
    );

    const updateData = {
      ...validatedData,
      _id: new mongoose.Types.ObjectId(validatedData._id),
      ...(validatedData.organizationId ? {} : { organizationId: (req as any).user.organizationId }),
    };
    const currentUser = await userService.getUser(updateData._id.toString(), {
      query: { organizationId: (req as any).user.organizationId },
      select: fieldsToSelect,
    });
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    const updatedUser = await userService.updateUser(updateData, files);

    res.status(200).send({ message: config.SUCCESS.USER.UPDATE, data: updatedUser });

    if (req.user) {
      const updatedFields = Object.keys(requestBody)
        .filter(
          (field) =>
            !["_id", "oldPassword", "newPassword", "path", "isPasswordChanged"].includes(field)
        )
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
          title: "User Management - Update User",
        },
        action: "update",
        description: `Updated user ${updatedUser?.email || validatedData._id} with fields: ${updatedFields}${validatedData.newPassword ? " (including password)" : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "user",
        createdAt: new Date(),
      });
    }

    const before: Record<string, any> = {};
    const after: Record<string, any> = {};

    fieldsToSelect.forEach((field) => {
      if ((currentUser as any)?.[field] !== (updatedUser as any)?.[field]) {
        before[field] = (currentUser as any)?.[field];
        after[field] = (updatedUser as any)?.[field];
      }
    });

    const changes = Object.keys(after).map((field) => {
      const oldValue = before[field] || "not set";
      const newValue = after[field] || "not set";
      return `${field}: ${oldValue} → ${newValue}`;
    });

    const description =
      changes.length > 0
        ? `Updated user ${updatedUser?.email || ""} - Changed: ${changes.join(", ")}`
        : `Updated user ${updatedUser?.email || ""} - No fields changed`;

    await auditLogService.createAuditLog({
      user: (req.user as any)?.id as mongoose.Types.ObjectId,
      type: "UPDATE",
      severity: "INFO",
      entity: {
        type: "USER",
        id: updatedUser?._id as mongoose.Types.ObjectId,
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
    handleZodError(error, res);
  }
}

export async function deleteUser(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    const currentUser = await userService.getUser(id, {
      select: ["email", "firstName", "lastName", "role", "organizationId", "avatar"],
    });

    if (!currentUser) {
      throw new Error("User not found");
    }

    const deletedUser = await userService.deleteUser(id);

    res.status(200).send({ message: config.SUCCESS.USER.DELETE, data: deletedUser });

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
          title: "User Management - Delete User",
        },
        action: "remove",
        description: `Deleted user account: ${currentUser.email} (${currentUser.firstName} ${currentUser.lastName}) with role ${currentUser.role}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "user",
        createdAt: new Date(),
      });
    }

    const userDetails = {
      email: currentUser.email || "No email",
      firstName: currentUser.firstName || "No first name",
      lastName: currentUser.lastName || "No last name",
      role: currentUser.role || "No role",
      organizationId: currentUser.organizationId,
      avatar: currentUser.avatar || "No avatar",
    };
    auditLogService
      .createAuditLog({
        user: new mongoose.Types.ObjectId((req as any).user.id),
        type: "DELETE",
        severity: "INFO",
        entity: {
          type: "USER",
          id: new mongoose.Types.ObjectId(id),
        },
        changes: {
          before: userDetails,
          after: {},
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Deleted user ${userDetails.email} (${userDetails.firstName} ${userDetails.lastName}) with role: ${userDetails.role}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      })
      .catch((error) => {
        console.error("Error saving audit log:", error);
      });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function loginUser(req: CustomRequest, res: Response) {
  try {
    const loginSchema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
    });

    const credentials = loginSchema.parse(req.body);
    const result = await userService.loginUser(credentials);

    if (result?.user && result.token) {
      const isProduction = process.env.NODE_ENV === config.JWTCONFIG.NODE_ENV;
      res.cookie(config.JWTCONFIG.CLEAR_COOKIE, result.token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 24 * 60 * 60 * 1000,
        path: "/",
      });
      res.status(200).json({
        success: true,
        user: result.user,
        token: result.token,
        message: config.SUCCESS.USER.LOGIN,
      });

      try {
        await activityLogService.createActivityLog({
          userId: new mongoose.Types.ObjectId(result.user.id),
          headers: {
            "user-agent": req.get("user-agent"),
          },
          ip: req.ip || "0.0.0.0",
          path: req.path,
          method: req.method,
          page: {
            url: req.originalUrl,
            title: "User Management - User Login",
          },
          action: "login",
          description: `Successful login by ${result.user.email} (${result.user.firstname || "No first name"} ${result.user.lastname || "No last name"})`,
          organizationId: result.user.organizationId
            ? new mongoose.Types.ObjectId(result.user.organizationId)
            : undefined,
          entityType: "user",
          createdAt: new Date(),
        });
      } catch (error) {
        console.error("[Login] Error logging activity:", error);
      }
    } else {
      res.status(401).json({ message: config.ERROR.USER.INVALID_CREDENTIALS });
    }
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function logoutUser(req: CustomRequest, res: Response) {
  try {
    await userService.logoutUser(req);

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
          title: "User Management - User Logout",
        },
        action: "logout",
        description: `User ${req.user.email} logged out successfully`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "user",
        createdAt: new Date(),
      });
    }

    const isProduction = process.env.NODE_ENV === config.JWTCONFIG.NODE_ENV;
    const cookieOptions: CookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      path: "/",
    };

    const sessionCookieOptions: CookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      expires: new Date(0),
    };

    res.clearCookie(config.JWTCONFIG.CLEAR_COOKIE, cookieOptions);
    res.clearCookie("auth_flag", { ...cookieOptions, httpOnly: false });
    res.clearCookie("connect.sid", sessionCookieOptions);

    req.user = undefined;

    res.status(200).json({
      success: true,
      message: config.SUCCESS.USER.LOGOUT,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function currentUser(req: CustomRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: config.ERROR.USER.NOT_AUTHORIZED });
    }
    const user = await userService.currentUser(req);

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
          title: "User Management - Check Session",
        },
        action: "read",
        description: `Session check for user ${req.user.email}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "user",
        createdAt: new Date(),
      });
    }

    return res.status(200).json(user);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(401).json({ error: error.message });
    }
    return res.status(401).json({ error: "An unknown error occurred" });
  }
}

export async function searchUser(req: Request, res: Response) {
  try {
    const users = await userService.searchUser(req.body);

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
          title: "User Management - Search Users",
        },
        action: "read",
        description: `Searched users with criteria: ${searchCriteria || "none"} (found ${users?.length} results)`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "user",
        createdAt: new Date(),
      });
    }

    res.status(200).send(users);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function uploadImage(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Please upload an image" });
    }
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });
    const currentUser = await userService.getUser(id, { select: ["avatar"] });
    if (currentUser?.avatar) {
      const publicId = currentUser.avatar.split("/").pop()?.split(".")[0];
      if (publicId) {
        await cloudinaryService.deleteImage(`user-avatars/${publicId}`);
      }
    }

    const imageUrl = await cloudinaryService.uploadImage(req.file);
    const updateData = {
      _id: new mongoose.Types.ObjectId(id),
      avatar: imageUrl,
    };

    const user = await userService.updateUser(updateData);

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
          title: "User Management - Update Profile Picture",
        },
        action: "update",
        description: `Updated profile picture for user ${user?.email || id}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "user",
        createdAt: new Date(),
      });
    }

    res.status(200).send(user);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getUserMetrics(req: CustomRequest, res: Response) {
  try {
    const organizationId = (req as any).user.organizationId;
    const filter = req.query.filter as string;
    const type = req.query.type as string;
    const metrics = await userService.getUserMetrics(organizationId, filter, type);

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
          title: "User Management - View Metrics",
        },
        action: "read",
        description: `Retrieved user metrics${filter ? ` with filter: ${filter}` : ""}${type ? ` (type: ${type})` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "user",
        createdAt: new Date(),
      });
    }

    res.status(200).send({ message: config.SUCCESS.USER.METRICS, data: metrics });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function bulkCreate(req: CustomRequest, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).send({ message: "No CSV file uploaded" });
    }

    const organizationId = (req as any).user.organizationId;
    if (!organizationId) {
      return res.status(400).send({ message: "Organization ID is required" });
    }

    const data = await parseCSVBuffer(req.file.buffer);
    const result = await userService.bulkCreate(data, organizationId);

    res.status(200).send({ message: config.SUCCESS.USER.BULK_CREATE, result });
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
          title: "User Management - Bulk Import Users",
        },
        action: "create",
        description: `Bulk imported ${data.length} users`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "user",
        createdAt: new Date(),
      });

      await auditLogService
        .createAuditLog({
          user: new mongoose.Types.ObjectId((req as any).user.id),
          type: "CREATE",
          severity: "INFO",
          entity: {
            type: "USER",
            id: new mongoose.Types.ObjectId(),
          },
          changes: {
            before: {},
            after: {
              count: data.length,
              summary: `${data.length} users imported`,
            },
          },
          metadata: {
            userAgent: req.get("user-agent"),
            ip: req.ip,
            path: req.path,
            method: req.method,
          },
          description: `Bulk imported ${data.length} users via CSV upload`,
          organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        })
        .catch((error) => {
          console.error("Error saving audit log for bulk create:", error);
        });
    }
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function archiveUser(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    const archivedUser = await userService.archiveUser(id);

    if (!archivedUser) {
      return res.status(404).json({ message: "user not found" });
    }
    res.status(200).json({
      message: config.SUCCESS.USER.ARCHIVE,
      data: archivedUser,
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
        title: "User Management - Archive User",
      },
      action: "archive",
      description: `Archived user with ID: ${id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      entityType: "user",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId((req as any).user.id),
      type: "UPDATE",
      severity: "INFO",
      entity: {
        type: "USER",
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
      description: `Archived user with ID ${id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { id, firstName, lastName } = req.body;
    if (!id || !firstName || !lastName) {
      return res.status(400).json({ message: "id, firstName, and lastName are required" });
    }
    const user = await userService.resetPassword(id, firstName, lastName);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ message: "Password reset successfully", data: user });

    // Activity and Audit Logging
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
          title: "User Management - Reset Password",
        },
        action: "update",
        description: `Reset password for user ${user?.email || id}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "user",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId((req as any).user.id),
        type: "UPDATE",
        severity: "INFO",
        entity: {
          type: "USER",
          id: new mongoose.Types.ObjectId(id),
        },
        changes: {
          before: { isPasswordChanged: user.isPasswordChanged },
          after: { isPasswordChanged: false },
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Reset password for user ${user?.email || id}`,
        organizationId: (req as any).user.organizationId
          ? new mongoose.Types.ObjectId((req as any).user.organizationId)
          : undefined,
      });
    }
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : "Server error" });
  }
}
