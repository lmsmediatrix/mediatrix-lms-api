import express, { Response } from "express";
import emailService from "../services/emailService";
import { API_ENDPOINTS } from "../config/endpointsConfig";
import { getTokenRemainingTime, validateToken } from "../utils/invitationToken";
import { formatDate } from "../utils/formatDate";
import { handleZodError } from "../middleware/zodErrorHandler";
import activityLogService from "../services/activityLogService";
import auditLogService from "../services/auditLogService";
import mongoose from "mongoose";
import { CustomRequest } from "../type/types";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Email
 *   description: Email management endpoints for handling invitation emails and token validation
 */

/**
 * @swagger
 * /api/email/invitation/send:
 *   post:
 *     summary: Send invitation email
 *     description: Send an invitation email to a new user with specified roles and organization
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - firstname
 *               - lastname
 *               - roles
 *               - organization
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: "Recipient email address"
 *               firstname:
 *                 type: string
 *                 description: "Recipient first name"
 *               lastname:
 *                 type: string
 *                 description: "Recipient last name"
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: "User roles to be assigned"
 *               organization:
 *                 type: string
 *                 description: "Organization ID"
 *     responses:
 *       200:
 *         description: "Invitation sent successfully"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invitation sent successfully"
 *                 token:
 *                   type: string
 *                   description: "Invitation token"
 *                 expiryDate:
 *                   type: string
 *                   format: date-time
 *                   description: "Token expiry date"
 *       400:
 *         description: "Invalid input - Missing required fields or invalid data"
 *       401:
 *         description: "Unauthorized - User not authenticated"
 *       500:
 *         description: "Server error"
 */
router.post(API_ENDPOINTS.EMAIL.INVITATION.SEND, sendInvitation);

/**
 * @swagger
 * /api/email/invitation/get:
 *   get:
 *     summary: Get invitation details by token
 *     description: Retrieve invitation details using a valid invitation token
 *     tags: [Email]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: "Invitation token"
 *     responses:
 *       200:
 *         description: "Invitation details retrieved successfully"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 email:
 *                   type: string
 *                   format: email
 *                   description: "Recipient email address"
 *                 firstname:
 *                   type: string
 *                   description: "Recipient first name"
 *                 lastname:
 *                   type: string
 *                   description: "Recipient last name"
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: "Assigned user roles"
 *                 organization:
 *                   type: string
 *                   description: "Organization ID"
 *       400:
 *         description: "Invalid or expired token"
 *       500:
 *         description: "Server error"
 */
router.get(API_ENDPOINTS.EMAIL.INVITATION.GET, getInvitation);

/**
 * @swagger
 * /api/email/invitation/validate:
 *   post:
 *     summary: Validate invitation token
 *     description: Check if an invitation token is valid and get its remaining time
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: "Invitation token to validate"
 *     responses:
 *       200:
 *         description: "Token validated successfully"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isValid:
 *                   type: boolean
 *                   description: "Whether the token is valid"
 *                 expiryTime:
 *                   type: number
 *                   description: "Remaining time in seconds"
 *       400:
 *         description: "Invalid or expired token"
 *       500:
 *         description: "Server error"
 */
router.post(API_ENDPOINTS.EMAIL.INVITATION.VALIDATE, validateInvitation);

/*
 * @desc   Send invitation email
 * @route  POST /api/email/invitation/send
 * @access Private
 */
async function sendInvitation(req: CustomRequest, res: Response) {
  try {
    const { email, firstname, lastname, roles, organization } = req.body;

    const invitation = await emailService.sendInvitationEmail(
      email,
      firstname,
      lastname,
      roles,
      organization
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
          title: "Send Invitation Email",
        },
        action: "create",
        description: `Sent invitation email to ${email} (${firstname} ${lastname}) with roles: ${roles.join(", ")}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "email",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId(req.user.id),
        type: "CREATE",
        severity: "INFO",
        entity: {
          type: "EMAIL_INVITATION",
          id: new mongoose.Types.ObjectId(),
        },
        changes: {
          before: {},
          after: { email, firstname, lastname, roles, organization },
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Sent invitation email to ${email}`,
      });
    }

    res.status(200).json({
      message: "Invitation sent successfully",
      token: invitation.token,
      expiryDate: formatDate(invitation.expiryDate),
    });
  } catch (error) {
    return handleZodError(error, res);
  }
}

/*
 * @desc   Get invitation details by token
 * @route  GET /api/email/invitation/get
 * @access Public
 */
async function getInvitation(req: CustomRequest, res: Response) {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Valid token is required" });
    }

    const invitationData = validateToken(token);

    if (!invitationData) {
      return res.status(400).json({ error: "Invalid or expired invitation" });
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
          title: "View Invitation Details",
        },
        action: "read",
        description: `Retrieved invitation details for token: ${token.substring(0, 8)}...`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "email",
        createdAt: new Date(),
      });
    }

    res.status(200).json(invitationData.payload);
  } catch (error) {
    return handleZodError(error, res);
  }
}

/*
 * @desc   Validate invitation token
 * @route  POST /api/email/invitation/validate
 * @access Public
 */
async function validateInvitation(req: CustomRequest, res: Response) {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    const invitationData = validateToken(token);
    const expiryTime = getTokenRemainingTime(token);

    if (!invitationData) {
      return res.status(400).json({ error: "Invalid or expired invitation" });
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
          title: "Validate Invitation Token",
        },
        action: "validate",
        description: `Validated invitation token: ${token.substring(0, 8)}... (expires in ${Math.floor(expiryTime / 60)} minutes)`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "email",
        createdAt: new Date(),
      });
    }

    res.status(200).json({
      isValid: true,
      expiryTime,
    });
  } catch (error) {
    return handleZodError(error, res);
  }
}

export default router;
