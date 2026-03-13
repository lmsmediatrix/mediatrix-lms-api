import express, { Request, Response } from "express";
import { API_ENDPOINTS } from "../config/endpointsConfig";
import { handleZodError } from "../middleware/zodErrorHandler";
import { upload } from "../middleware/multer";
import cloudinaryService from "../services/cloudinaryService";
import activityLogService from "../services/activityLogService";
import auditLogService from "../services/auditLogService";
import { config } from "../config/common";
import mongoose from "mongoose";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Cloudinary
 *   description: Cloudinary file management endpoints for handling file uploads and storage
 */

/**
 * @swagger
 * /api/cloudinary/upload/image:
 *   post:
 *     summary: Upload a single image to Cloudinary
 *     description: Upload a single image file to Cloudinary storage with optional folder path
 *     tags: [Cloudinary]
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
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: "Image file to upload (supported formats: jpg, jpeg, png, gif)"
 *               path:
 *                 type: string
 *                 description: "Folder path in Cloudinary where the image will be stored"
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   description: "Cloudinary URL of the uploaded image"
 *       400:
 *         description: No file uploaded or invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(API_ENDPOINTS.CLOUDINARY.UPLOAD_IMAGE, upload.single("file"), uploadImage);

/**
 * @swagger
 * /api/cloudinary/upload/multiple:
 *   post:
 *     summary: Upload multiple files to Cloudinary
 *     description: Upload multiple files to Cloudinary storage with optional folder path
 *     tags: [Cloudinary]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - files
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: "Array of files to upload"
 *               path:
 *                 type: string
 *                 description: "Folder path in Cloudinary where the files will be stored"
 *     responses:
 *       200:
 *         description: Files uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 urls:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: "Array of Cloudinary URLs for the uploaded files"
 *       400:
 *         description: No files uploaded or invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(API_ENDPOINTS.CLOUDINARY.UPLOAD_MULTIPLE, upload.array("files"), uploadMultipleFiles);

/**
 * @swagger
 * /api/cloudinary/upload/document:
 *   post:
 *     summary: Upload a document to Cloudinary
 *     description: Upload a document file to Cloudinary storage with optional folder path
 *     tags: [Cloudinary]
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
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: "Document file to upload (supported formats: pdf, doc, docx, txt)"
 *               path:
 *                 type: string
 *                 description: "Folder path in Cloudinary where the document will be stored"
 *     responses:
 *       200:
 *         description: Document uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   description: "Cloudinary URL of the uploaded document"
 *       400:
 *         description: No file uploaded or invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(API_ENDPOINTS.CLOUDINARY.UPLOAD_DOCUMENT, upload.single("file"), uploadDocument);

/**
 * @swagger
 * /api/cloudinary/delete:
 *   delete:
 *     summary: Delete a file from Cloudinary
 *     description: Delete a file from Cloudinary storage using its URL
 *     tags: [Cloudinary]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 description: "Cloudinary URL of the file to delete"
 *     responses:
 *       200:
 *         description: File deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "File deleted successfully"
 *       400:
 *         description: Invalid URL or no URL provided
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.delete(API_ENDPOINTS.CLOUDINARY.DELETE, deleteFile);

export default router;

/*
 * @desc   Upload a single image to Cloudinary
 * @route  POST /api/cloudinary/upload/image
 * @access Private
 */
export async function uploadImage(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const path = req.body.path || "default-path";
    const imageUrl = await cloudinaryService.uploadImage(req.file, path);

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
          title: "Upload Single Image",
        },
        action: "upload",
        description: `Uploaded image file to path: ${path}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "cloudinary",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId((req as any).user.id),
        type: "CREATE",
        severity: "INFO",
        entity: {
          type: "CLOUDINARY",
          id: new mongoose.Types.ObjectId(),
        },
        changes: {
          before: {},
          after: { url: imageUrl, path },
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Uploaded image file to path: ${path}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });
    }

    res.status(200).json({ url: imageUrl });
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   Upload multiple files to Cloudinary
 * @route  POST /api/cloudinary/upload/multiple
 * @access Private
 */
export async function uploadMultipleFiles(req: Request, res: Response) {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const path = req.body.path || "default-path";
    const urls = await cloudinaryService.multipleUploadFile(req.files, path);

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
          title: "Upload Multiple Files",
        },
        action: "upload",
        description: `Uploaded ${req.files.length} files to path: ${path}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "cloudinary",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId((req as any).user.id),
        type: "CREATE",
        severity: "INFO",
        entity: {
          type: "CLOUDINARY",
          id: new mongoose.Types.ObjectId(),
        },
        changes: {
          before: {},
          after: { urls, path },
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Uploaded ${req.files.length} files to path: ${path}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });
    }

    res.status(200).json({ urls });
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   Upload a document to Cloudinary
 * @route  POST /api/cloudinary/upload/document
 * @access Private
 */
export async function uploadDocument(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const path = req.body.path || "default-path";
    const documentUrl = await cloudinaryService.uploadDocument(req.file, path);

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
          title: "Upload Document",
        },
        action: "upload",
        description: `Uploaded document file to path: ${path}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "cloudinary",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId((req as any).user.id),
        type: "CREATE",
        severity: "INFO",
        entity: {
          type: "CLOUDINARY",
          id: new mongoose.Types.ObjectId(),
        },
        changes: {
          before: {},
          after: { url: documentUrl, path },
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Uploaded document file to path: ${path}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });
    }

    res.status(200).json({ url: documentUrl });
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   Delete file from Cloudinary
 * @route  DELETE /api/cloudinary/delete
 * @access Private
 */
export async function deleteFile(req: Request, res: Response) {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ message: "URL is required in request body" });
    }
    let publicId;
    if (url.startsWith("http")) {
      const urlParts = url.split("/");
      const uploadIndex = urlParts.indexOf("upload");
      if (uploadIndex !== -1 && uploadIndex < urlParts.length - 1) {
        const pathAfterUpload = urlParts.slice(uploadIndex + 1);
        if (pathAfterUpload[0].match(/^v\d+$/)) {
          publicId = pathAfterUpload
            .slice(1)
            .join("/")
            .replace(/\.[^/.]+$/, "");
        } else {
          publicId = pathAfterUpload.join("/").replace(/\.[^/.]+$/, "");
        }
      } else {
        const filenameWithExt = urlParts[urlParts.length - 1];
        publicId = filenameWithExt.split(".")[0];
      }
    }
    await cloudinaryService.deleteImage(publicId);

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
          title: "Delete Cloudinary File",
        },
        action: "delete",
        description: `Deleted file from Cloudinary with URL: ${url}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "cloudinary",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId((req as any).user.id),
        type: "DELETE",
        severity: "INFO",
        entity: {
          type: "CLOUDINARY",
          id: new mongoose.Types.ObjectId(),
        },
        changes: {
          before: { url },
          after: {},
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Deleted file from Cloudinary with URL: ${url}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });
    }

    res.status(200).json({ message: config.SUCCESS.CLOUDINARY.DELETE });
  } catch (error) {
    console.error("Error deleting file:", error);
    handleZodError(error, res);
  }
}
