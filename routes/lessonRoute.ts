import express, { Request, Response } from "express";
import { API_ENDPOINTS } from "../config/endpointsConfig";
import { LessonZodSchema } from "../models/lessonModel";
import lessonService from "../services/lessonService";
import { handleZodError } from "../middleware/zodErrorHandler";
import { ValidationSchemas } from "../helper/validationSchemas";
import { z } from "zod";
import { upload } from "../middleware/multer";
import { CustomRequest } from "../type/types";
import { config } from "../config/common";
import activityLogService from "../services/activityLogService";
import auditLogService from "../services/auditLogService";
import mongoose from "mongoose";
import { validatePermissions } from "../middleware/rabcMiddleware";
import { ACTION, USER_ROLES } from "../config/common";
import notificationService from "../services/notificationService";
import { processInstructorFormData } from "../helper/formDataHelper";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Lessons
 *   description: Lesson management endpoints for handling course lessons, content, and related operations
 */

/**
 * @swagger
 * /api/lesson/get/all:
 *   get:
 *     summary: Get all lessons
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: object
 *         description: Query parameters for filtering lessons
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
 *         name: select
 *         schema:
 *           type: array
 *           items:
 *             type: string
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
 *         description: List of lessons retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Lesson'
 *                 pagination:
 *                   type: object
 *                 count:
 *                   type: number
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.LESSON.GET_ALL,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.GET_ALL),
  getLessons
);

/**
 * @swagger
 * /api/lesson/get/{id}:
 *   get:
 *     summary: Get lesson by ID
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Lesson ID
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: Fields to populate
 *       - in: query
 *         name: select
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Fields to select
 *     responses:
 *       200:
 *         description: Lesson retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Lesson'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Lesson not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.LESSON.GET_BY_ID,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.GET_BY_ID),
  getLesson
);

/**
 * @swagger
 * /api/lesson/create:
 *   post:
 *     summary: Create a new lesson
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               moduleId:
 *                 type: string
 *                 description: Optional module ID
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Lesson files (max 2)
 *               mainContent:
 *                 type: string
 *                 format: binary
 *                 description: Main content file
 *               mainContentText:
 *                 type: string
 *                 description: Main content as text (alternative to mainContent file)
 *     responses:
 *       200:
 *         description: Lesson created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Lesson'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.LESSON.CREATE,
  upload.fields([
    { name: "files", maxCount: 2 },
    { name: "mainContent", maxCount: 1 },
  ]),
  validatePermissions([USER_ROLES.INSTRUCTOR], ACTION.CREATE),
  createLesson
);

/**
 * @swagger
 * /api/lesson/update:
 *   put:
 *     summary: Update a lesson
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *                 description: Lesson ID
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               moduleId:
 *                 type: string
 *                 description: Optional module ID
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Lesson files (max 2)
 *               mainContent:
 *                 type: string
 *                 format: binary
 *                 description: Main content file
 *               mainContentText:
 *                 type: string
 *                 description: Main content as text (alternative to mainContent file)
 *     responses:
 *       200:
 *         description: Lesson updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Lesson'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Lesson not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.LESSON.UPDATE,
  upload.fields([
    { name: "files", maxCount: 2 },
    { name: "mainContent", maxCount: 1 },
  ]),
  validatePermissions([USER_ROLES.INSTRUCTOR], ACTION.UPDATE),
  updateLesson
);

/**
 * @swagger
 * /api/lesson/remove/{id}:
 *   delete:
 *     summary: Delete a lesson
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Lesson ID
 *     responses:
 *       200:
 *         description: Lesson deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Lesson not found
 *       500:
 *         description: Server error
 */
router.delete(
  API_ENDPOINTS.LESSON.REMOVE,
  validatePermissions([USER_ROLES.INSTRUCTOR], ACTION.DELETE),
  deleteLesson
);

/**
 * @swagger
 * /api/lesson/search:
 *   post:
 *     summary: Search lessons
 *     tags: [Lessons]
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
 *         description: List of lessons matching search criteria
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Lesson'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.LESSON.SEARCH,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.SEARCH),
  searchLesson
);

/**
 * @swagger
 * /api/lesson/archive/{id}:
 *   put:
 *     summary: Archive a lesson (soft delete)
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Lesson ID to archive
 *     responses:
 *       200:
 *         description: Lesson archived successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Lesson archived successfully
 *                 data:
 *                   $ref: '#/components/schemas/Lesson'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Lesson not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.LESSON.ARCHIVE,
  validatePermissions(
    [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN, USER_ROLES.INSTRUCTOR],
    ACTION.ARCHIVE
  ),
  archiveLesson
);

/**
 * @swagger
 * /api/lesson/{id}/progress:
 *   put:
 *     summary: Update lesson progress for the current student
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Lesson ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [completed, in-progress, not-started]
 *     responses:
 *       200:
 *         description: Progress updated
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.LESSON.UPDATE_PROGRESS,
  validatePermissions([USER_ROLES.STUDENT], ACTION.UPDATE),
  updateLessonProgress
);

export default router;

/*
 * @desc   get all lesson
 * @route  GET /api/lesson/get/all
 * @access Private
 */
export async function getLessons(req: Request, res: Response) {
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

    const { lessons, pagination, count } = await lessonService.getLessons(params);

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
          title: "Lesson Management - View All Lessons",
        },
        action: "read",
        description: `Retrieved ${lessons} lessons${Array.isArray(params.select) && params.select.length ? ` (fields: ${params.select.join(", ")})` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "lesson",
        createdAt: new Date(),
      });
    }

    res
      .status(200)
      .send({ message: config.SUCCESS.LESSON.GET_ALL, data: lessons, pagination, count });
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   get lesson by id
 * @route  GET /api/lesson/get/:id
 * @access Private
 */
export async function getLesson(req: Request, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });
    const params = ValidationSchemas.getQueryParams.parse({
      populateArray: req.query.populateArray ? JSON.parse(req.query.populateArray as string) : [],
      select: Array.isArray(req.query.select)
        ? req.query.select
        : [req.query.select].filter(Boolean),
      lean: req.query.lean,
    });

    const lesson = await lessonService.getLesson(id, params);

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
          title: "Lesson Management - View Lesson Details",
        },
        action: "read",
        description: `Viewed lesson details for ${lesson?.title || id}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "lesson",
        createdAt: new Date(),
      });
    }

    res.status(200).send({ message: config.SUCCESS.LESSON.GET_BY_ID, data: lesson });
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   create lesson
 * @route  POST /api/lesson/create
 * @access Private
 */
export async function createLesson(req: CustomRequest, res: Response) {
  try {
    const processed = processInstructorFormData(req.body);
    const user = req.user;
    if (!user) throw new Error("User not found");
    const validatedData = LessonZodSchema.partial()
      .extend({
        moduleId: z.string().optional(),
        path: z.string().optional(),
        mainContentText: z.string().optional(),
      })
      .parse(processed.processedData);
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const { newLesson, section } = await lessonService.createLesson(validatedData, files, req.user);
    if (newLesson) {
      res.status(200).send({ message: config.SUCCESS.LESSON.CREATE, data: newLesson });
    } else {
      throw new Error("Failed to create lesson");
    }

    // Run subsequent operations asynchronously
    (async () => {
      try {
        const user = req.user;
        if (!user) {
          console.error("User not found in background operations");
          return;
        }

        if (section && section.instructor && section.students && section.students.length > 0) {
          await notificationService.sendNotification({
            query: { _id: { $in: section.students.map((student: any) => student._id) } },
            sectionId: String(section._id),
            notification: {
              category: "LESSON",
              source: section.instructor._id,
              recipients: {
                read: [],
                unread: section.students.map((student: any) => ({
                  user: student._id,
                  date: null,
                })),
              },
              metadata: () => ({
                path: `/student/sections/${section.code}?tab=lessons&id=${newLesson._id}`,
                lesson: {
                  title: newLesson.title,
                  id: newLesson._id,
                },
              }),
            },
            template: {
              title: ({ section: _section }) => `A new lesson has been added to ${_section.name}`,
              description: ({ sender }) =>
                `${sender.firstName} has added a new lesson: "${newLesson.title}"`,
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
            title: "Lesson Management - Create New Lesson",
          },
          action: "create",
          description: `Created new lesson: ${newLesson.title}`,
          organizationId: user.organizationId
            ? new mongoose.Types.ObjectId(user.organizationId)
            : undefined,
          entityType: "lesson",
          createdAt: new Date(),
        });

        await auditLogService.createAuditLog({
          user: new mongoose.Types.ObjectId(user.id),
          type: "CREATE",
          severity: "INFO",
          entity: {
            type: "LESSON",
            id: new mongoose.Types.ObjectId(newLesson._id),
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
          description: `Created new lesson ${newLesson.title}`,
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

/*
 * @desc   update lesson
 * @route  PUT /api/lesson/update
 * @access Private
 */
export async function updateLesson(req: CustomRequest, res: Response) {
  try {
    if (!req.user) throw new Error("User not found");

    const processed = processInstructorFormData(req.body);
    const validatedData = LessonZodSchema.partial()
      .extend({
        _id: z.string().min(1),
        path: z.string().optional(),
        moduleId: z.string().optional(),
        mainContentText: z.string().optional(),
      })
      .parse(processed.processedData);

    const currentLesson = await lessonService.getLesson(validatedData._id, {
      select: Object.keys(req.body).filter((key) => key !== "_id"),
    });

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const updatedLesson = await lessonService.updateLesson(validatedData, files);

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
        title: "Lesson Management - Update Lesson",
      },
      action: "update",
      description: `Updated lesson ${updatedLesson?.title || "Unknown"}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      entityType: "lesson",
      createdAt: new Date(),
    });

    if (!updatedLesson) {
      throw new Error("Failed to update lesson");
    }

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(req.user.id),
      type: "UPDATE",
      severity: "INFO",
      entity: {
        type: "LESSON",
        id: updatedLesson._id,
      },
      changes: {
        before: currentLesson || {},
        after: updatedLesson || {},
      },
      metadata: {
        userAgent: req.get("user-agent"),
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      description: `Updated lesson ${updatedLesson.title}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });

    res.status(200).send({ message: config.SUCCESS.LESSON.UPDATE, data: updatedLesson });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function deleteLesson(req: CustomRequest, res: Response) {
  try {
    if (!req.user) throw new Error("User not found");

    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    const currentLesson = await lessonService.getLesson(id, {
      select: ["title"],
    });

    if (!currentLesson) {
      throw new Error("Lesson not found");
    }

    await lessonService.deleteLesson(id);

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
        title: "Lesson Management - Delete Lesson",
      },
      action: "remove",
      description: `Deleted lesson: ${currentLesson.title}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      entityType: "lesson",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(req.user.id),
      type: "DELETE",
      severity: "INFO",
      entity: {
        type: "LESSON",
        id: new mongoose.Types.ObjectId(id),
      },
      changes: {
        before: currentLesson,
        after: {},
      },
      metadata: {
        userAgent: req.get("user-agent"),
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      description: `Deleted lesson ${currentLesson.title}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });

    res.status(200).send({ message: config.SUCCESS.LESSON.DELETE });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function searchLesson(req: Request, res: Response) {
  try {
    const searchResult = await lessonService.searchLesson(req.body);

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
          title: "Lesson Management - Search Lessons",
        },
        action: "read",
        description: `Lesson search performed with criteria: ${searchCriteria || "none"} (found ${searchResult?.length} results)`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "lesson",
        createdAt: new Date(),
      });
    }

    res.status(200).send(searchResult);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function archiveLesson(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "User not authenticated or missing organization" });
    }

    const archivedLesson = await lessonService.archiveLesson(id);

    if (!archivedLesson) {
      return res.status(404).json({ message: "Lesson not found" });
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
        title: "Lesson Management - Archive Lesson",
      },
      action: "archive",
      description: `Archived lesson with ID: ${id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      entityType: "lesson",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(req.user.id),
      type: "UPDATE",
      severity: "INFO",
      entity: {
        type: "LESSON",
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
      description: `Archived lesson with ID ${id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });

    res.status(200).json({
      message: config.SUCCESS.LESSON.ARCHIVE,
      data: archivedLesson,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   Update lesson progress for current student
 * @route  PUT /api/lesson/:id/progress
 * @access Private (Student)
 */
export async function updateLessonProgress(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    if (!req.user) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const progressSchema = z.object({
      status: z.enum(["completed", "in-progress", "not-started"]),
    });
    const { status } = progressSchema.parse(req.body);

    const lesson = await lessonService.updateLessonProgress(id, req.user.id, { status });

    if (!lesson) {
      return res.status(404).json({ message: config.RESPONSE.ERROR.LESSON.NOT_FOUND });
    }

    res.status(200).json({
      message: config.SUCCESS.LESSON.UPDATE_PROGRESS,
      data: lesson,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}
