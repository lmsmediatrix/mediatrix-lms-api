import express, { Request, Response } from "express";
import { API_ENDPOINTS } from "../config/endpointsConfig";
import studentAssessmentGradeService from "../services/studentAssessmentGradeService";
import { StudentAssessmentGradeZodSchema } from "../models/studentAssessmentGradeModel";
import { handleZodError } from "../middleware/zodErrorHandler";
import { ValidationSchemas } from "../helper/validationSchemas";
import { z } from "zod";
import { CustomRequest } from "../type/types";
import { ACTION, config, USER_ROLES } from "../config/common";
import { validatePermissions } from "../middleware/rabcMiddleware";
import activityLogService from "../services/activityLogService";
import auditLogService from "../services/auditLogService";
import mongoose from "mongoose";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: StudentAssessmentGrades
 *   description: Per-student, per-assessment grade records
 */

/**
 * @swagger
 * /api/student-assessment-grade/get/all:
 *   get:
 *     summary: Get all student assessment grades
 *     description: Retrieve paginated list with optional filtering by sectionId, assessmentId, or studentId
 *     tags: [StudentAssessmentGrades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: object
 *         description: Filter by organizationId, sectionId, assessmentId, or studentId
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *       - in: query
 *         name: count
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: pagination
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: document
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Assessment grades retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  API_ENDPOINTS.STUDENT_ASSESSMENT_GRADE.GET_ALL,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN],
    ACTION.GET_ALL
  ),
  getStudentAssessmentGrades
);

/**
 * @swagger
 * /api/student-assessment-grade/get/{id}:
 *   get:
 *     summary: Get student assessment grade by ID
 *     tags: [StudentAssessmentGrades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Assessment grade retrieved successfully
 *       404:
 *         description: Not found
 *       401:
 *         description: Unauthorized
 */
router.get(
  API_ENDPOINTS.STUDENT_ASSESSMENT_GRADE.GET_BY_ID,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN],
    ACTION.GET_BY_ID
  ),
  getStudentAssessmentGrade
);

/**
 * @swagger
 * /api/student-assessment-grade/assessment/{assessmentId}:
 *   get:
 *     summary: Get all student grades for one assessment
 *     tags: [StudentAssessmentGrades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assessmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Grades retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  API_ENDPOINTS.STUDENT_ASSESSMENT_GRADE.GET_BY_ASSESSMENT,
  validatePermissions([USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.GET_ALL),
  getGradesByAssessment
);

/**
 * @swagger
 * /api/student-assessment-grade/student/{studentId}/section/{sectionId}:
 *   get:
 *     summary: Get all assessment grades for a student in a section
 *     tags: [StudentAssessmentGrades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Grades retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  API_ENDPOINTS.STUDENT_ASSESSMENT_GRADE.GET_BY_STUDENT_SECTION,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN],
    ACTION.GET_ALL
  ),
  getGradesByStudentSection
);

/**
 * @swagger
 * /api/student-assessment-grade/create:
 *   post:
 *     summary: Submit/create a student assessment grade record
 *     tags: [StudentAssessmentGrades]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sectionId
 *               - assessmentId
 *               - studentId
 *               - score
 *               - totalPoints
 *               - status
 *             properties:
 *               sectionId:
 *                 type: string
 *               assessmentId:
 *                 type: string
 *               studentId:
 *                 type: string
 *               score:
 *                 type: number
 *               totalPoints:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [pending, submitted, graded, returned, late]
 *               remarks:
 *                 type: string
 *     responses:
 *       200:
 *         description: Assessment grade submitted successfully
 *       400:
 *         description: Invalid input or duplicate
 *       401:
 *         description: Unauthorized
 */
router.post(
  API_ENDPOINTS.STUDENT_ASSESSMENT_GRADE.CREATE,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.CREATE),
  createStudentAssessmentGrade
);

/**
 * @swagger
 * /api/student-assessment-grade/update:
 *   put:
 *     summary: Update a student assessment grade (instructor grades)
 *     tags: [StudentAssessmentGrades]
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
 *               score:
 *                 type: number
 *               gradeLabel:
 *                 type: string
 *               remarks:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [pending, submitted, graded, returned, late]
 *     responses:
 *       200:
 *         description: Assessment grade updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.put(
  API_ENDPOINTS.STUDENT_ASSESSMENT_GRADE.UPDATE,
  validatePermissions([USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.UPDATE),
  updateStudentAssessmentGrade
);

/**
 * @swagger
 * /api/student-assessment-grade/remove/{id}:
 *   delete:
 *     summary: Archive a student assessment grade
 *     tags: [StudentAssessmentGrades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Assessment grade deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.delete(
  API_ENDPOINTS.STUDENT_ASSESSMENT_GRADE.REMOVE,
  validatePermissions([USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.DELETE),
  deleteStudentAssessmentGrade
);

/**
 * @swagger
 * /api/student-assessment-grade/archive/{id}:
 *   put:
 *     summary: Explicitly archive a student assessment grade
 *     tags: [StudentAssessmentGrades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Assessment grade archived successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.put(
  API_ENDPOINTS.STUDENT_ASSESSMENT_GRADE.ARCHIVE,
  validatePermissions(
    [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN, USER_ROLES.INSTRUCTOR],
    ACTION.ARCHIVE
  ),
  archiveStudentAssessmentGrade
);

/**
 * @swagger
 * /api/student-assessment-grade/search:
 *   post:
 *     summary: Search student assessment grades
 *     tags: [StudentAssessmentGrades]
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
 *     responses:
 *       200:
 *         description: Search results returned
 *       401:
 *         description: Unauthorized
 */
router.post(
  API_ENDPOINTS.STUDENT_ASSESSMENT_GRADE.SEARCH,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.SEARCH),
  searchStudentAssessmentGrade
);

export default router;

/*
 * @desc   Get all student assessment grades
 * @route  GET /api/student-assessment-grade/get/all
 * @access Private
 */
export async function getStudentAssessmentGrades(req: Request, res: Response) {
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

    const { studentAssessmentGrades, pagination, count } =
      await studentAssessmentGradeService.getStudentAssessmentGrades(params);

    if ((req as any).user) {
      await activityLogService.createActivityLog({
        userId: new mongoose.Types.ObjectId((req as any).user.id),
        headers: { "user-agent": req.get("user-agent") },
        ip: req.ip || "0.0.0.0",
        path: req.path,
        method: req.method,
        page: {
          url: req.originalUrl,
          title: "Student Assessment Grade - View All",
        },
        action: "read",
        description: `Retrieved student assessment grades`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "student_assessment_grade",
        createdAt: new Date(),
      });
    }

    res.status(200).send({
      message: config.SUCCESS.STUDENT_ASSESSMENT_GRADE.GET_ALL,
      data: studentAssessmentGrades,
      pagination,
      count,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   Get student assessment grade by ID
 * @route  GET /api/student-assessment-grade/get/:id
 * @access Private
 */
export async function getStudentAssessmentGrade(req: Request, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });
    const params = ValidationSchemas.getQueryParams.parse({
      populateArray: req.query.populateArray ? JSON.parse(req.query.populateArray as string) : [],
      select: Array.isArray(req.query.select)
        ? req.query.select
        : [req.query.select].filter(Boolean),
      lean: req.query.lean,
    });

    const grade = await studentAssessmentGradeService.getStudentAssessmentGrade(id, params);

    if (!grade) {
      return res.status(config.STATUS.NOT_FOUND.CODE).send({
        message: config.RESPONSE.ERROR.STUDENT_ASSESSMENT_GRADE.NOT_FOUND,
      });
    }

    if ((req as any).user) {
      await activityLogService.createActivityLog({
        userId: new mongoose.Types.ObjectId((req as any).user.id),
        headers: { "user-agent": req.get("user-agent") },
        ip: req.ip || "0.0.0.0",
        path: req.path,
        method: req.method,
        page: {
          url: req.originalUrl,
          title: "Student Assessment Grade - View Details",
        },
        action: "read",
        description: `Retrieved student assessment grade with ID: ${id}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "student_assessment_grade",
        createdAt: new Date(),
      });
    }

    res.status(200).send({
      message: config.SUCCESS.STUDENT_ASSESSMENT_GRADE.GET_BY_ID,
      data: grade,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   Get all grades for a specific assessment
 * @route  GET /api/student-assessment-grade/assessment/:assessmentId
 * @access Private
 */
export async function getGradesByAssessment(req: Request, res: Response) {
  try {
    const assessmentId = req.params.assessmentId;

    if (!assessmentId) {
      return res.status(config.STATUS.VALIDATION_ERROR.CODE).send({
        message: config.RESPONSE.ERROR.STUDENT_ASSESSMENT_GRADE.INVALID_PARAMETER.GET,
      });
    }

    const params = {
      query: {
        assessmentId,
        organizationId: (req as any).user?.organizationId,
      },
      document: true,
      pagination: false,
      count: false,
    };

    const { studentAssessmentGrades } =
      await studentAssessmentGradeService.getStudentAssessmentGrades(params);

    res.status(200).send({
      message: config.SUCCESS.STUDENT_ASSESSMENT_GRADE.GET_ALL,
      data: studentAssessmentGrades,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   Get all assessment grades for a student in a section
 * @route  GET /api/student-assessment-grade/student/:studentId/section/:sectionId
 * @access Private
 */
export async function getGradesByStudentSection(req: Request, res: Response) {
  try {
    const { studentId, sectionId } = req.params;

    if (!studentId || !sectionId) {
      return res.status(config.STATUS.VALIDATION_ERROR.CODE).send({
        message: config.RESPONSE.ERROR.STUDENT_ASSESSMENT_GRADE.INVALID_PARAMETER.GET,
      });
    }

    const params = {
      query: {
        studentId,
        sectionId,
        organizationId: (req as any).user?.organizationId,
      },
      document: true,
      pagination: false,
      count: false,
    };

    const { studentAssessmentGrades } =
      await studentAssessmentGradeService.getStudentAssessmentGrades(params);

    res.status(200).send({
      message: config.SUCCESS.STUDENT_ASSESSMENT_GRADE.GET_ALL,
      data: studentAssessmentGrades,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   Create student assessment grade
 * @route  POST /api/student-assessment-grade/create
 * @access Private
 */
export async function createStudentAssessmentGrade(req: CustomRequest, res: Response) {
  if (!req.user) {
    return Promise.reject(new Error("User not found"));
  }

  try {
    const validatedData = StudentAssessmentGradeZodSchema.partial().parse(req.body);
    const newGrade = await studentAssessmentGradeService.createStudentAssessmentGrade(
      validatedData,
      req.user
    );

    await activityLogService.createActivityLog({
      userId: new mongoose.Types.ObjectId(req.user.id),
      headers: { "user-agent": req.get("user-agent") },
      ip: req.ip || "0.0.0.0",
      path: req.path,
      method: req.method,
      page: {
        url: req.originalUrl,
        title: "Student Assessment Grade - Create",
      },
      action: "create",
      description: `Created student assessment grade with ID: ${newGrade._id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      entityType: "student_assessment_grade",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(req.user.id),
      type: "CREATE",
      severity: "INFO",
      entity: {
        type: "STUDENT_ASSESSMENT_GRADE",
        id: newGrade._id,
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
      description: `Created student assessment grade for student ${validatedData.studentId} on assessment ${validatedData.assessmentId}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });

    res.status(200).send({
      message: config.SUCCESS.STUDENT_ASSESSMENT_GRADE.CREATE,
      data: newGrade,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   Update student assessment grade
 * @route  PUT /api/student-assessment-grade/update
 * @access Private
 */
export async function updateStudentAssessmentGrade(req: CustomRequest, res: Response) {
  try {
    if (!req.user) throw new Error("User not found");

    const validatedData = StudentAssessmentGradeZodSchema.partial()
      .extend({ _id: z.string().min(1) })
      .parse(req.body);

    const currentGrade = await studentAssessmentGradeService.getStudentAssessmentGrade(
      validatedData._id,
      {
        select: Object.keys(req.body).filter((key) => key !== "_id"),
      }
    );

    const updatedGrade =
      await studentAssessmentGradeService.updateStudentAssessmentGrade(validatedData);

    if (!updatedGrade) {
      return res.status(config.STATUS.NOT_FOUND.CODE).send({
        message: config.RESPONSE.ERROR.STUDENT_ASSESSMENT_GRADE.NOT_FOUND,
      });
    }

    await activityLogService.createActivityLog({
      userId: new mongoose.Types.ObjectId(req.user.id),
      headers: { "user-agent": req.get("user-agent") },
      ip: req.ip || "0.0.0.0",
      path: req.path,
      method: req.method,
      page: {
        url: req.originalUrl,
        title: "Student Assessment Grade - Update",
      },
      action: "update",
      description: `Updated student assessment grade with ID: ${validatedData._id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      entityType: "student_assessment_grade",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(req.user.id),
      type: "UPDATE",
      severity: "INFO",
      entity: {
        type: "STUDENT_ASSESSMENT_GRADE",
        id: new mongoose.Types.ObjectId(validatedData._id),
      },
      changes: {
        before: currentGrade ?? {},
        after: validatedData,
      },
      metadata: {
        userAgent: req.get("user-agent"),
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      description: `Updated student assessment grade ${validatedData._id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });

    res.status(200).send({
      message: config.SUCCESS.STUDENT_ASSESSMENT_GRADE.UPDATE,
      data: updatedGrade,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   Archive (delete) student assessment grade
 * @route  DELETE /api/student-assessment-grade/remove/:id
 * @access Private
 */
export async function deleteStudentAssessmentGrade(req: CustomRequest, res: Response) {
  try {
    if (!req.user) throw new Error("User not found");

    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    const deletedGrade = await studentAssessmentGradeService.deleteStudentAssessmentGrade(id);

    if (!deletedGrade) {
      return res.status(config.STATUS.NOT_FOUND.CODE).send({
        message: config.RESPONSE.ERROR.STUDENT_ASSESSMENT_GRADE.NOT_FOUND,
      });
    }

    await activityLogService.createActivityLog({
      userId: new mongoose.Types.ObjectId(req.user.id),
      headers: { "user-agent": req.get("user-agent") },
      ip: req.ip || "0.0.0.0",
      path: req.path,
      method: req.method,
      page: {
        url: req.originalUrl,
        title: "Student Assessment Grade - Delete",
      },
      action: "delete",
      description: `Archived student assessment grade with ID: ${id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      entityType: "student_assessment_grade",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(req.user.id),
      type: "DELETE",
      severity: "WARN",
      entity: {
        type: "STUDENT_ASSESSMENT_GRADE",
        id: new mongoose.Types.ObjectId(id),
      },
      changes: {
        before: deletedGrade ?? {},
        after: {},
      },
      metadata: {
        userAgent: req.get("user-agent"),
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      description: `Archived student assessment grade ${id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });

    res.status(200).send({
      message: config.SUCCESS.STUDENT_ASSESSMENT_GRADE.DELETE,
      data: deletedGrade,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   Archive student assessment grade
 * @route  PUT /api/student-assessment-grade/archive/:id
 * @access Private
 */
export async function archiveStudentAssessmentGrade(req: CustomRequest, res: Response) {
  try {
    if (!req.user) throw new Error("User not found");

    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    const archivedGrade = await studentAssessmentGradeService.archiveStudentAssessmentGrade(id);

    if (!archivedGrade) {
      return res.status(config.STATUS.NOT_FOUND.CODE).send({
        message: config.RESPONSE.ERROR.STUDENT_ASSESSMENT_GRADE.NOT_FOUND,
      });
    }

    await activityLogService.createActivityLog({
      userId: new mongoose.Types.ObjectId(req.user.id),
      headers: { "user-agent": req.get("user-agent") },
      ip: req.ip || "0.0.0.0",
      path: req.path,
      method: req.method,
      page: {
        url: req.originalUrl,
        title: "Student Assessment Grade - Archive",
      },
      action: "archive",
      description: `Archived student assessment grade with ID: ${id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      entityType: "student_assessment_grade",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(req.user.id),
      type: "ARCHIVE",
      severity: "INFO",
      entity: {
        type: "STUDENT_ASSESSMENT_GRADE",
        id: new mongoose.Types.ObjectId(id),
      },
      changes: {
        before: { "archive.status": false },
        after: { "archive.status": true },
      },
      metadata: {
        userAgent: req.get("user-agent"),
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      description: `Archived student assessment grade ${id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });

    res.status(200).send({
      message: config.SUCCESS.STUDENT_ASSESSMENT_GRADE.ARCHIVE,
      data: archivedGrade,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   Search student assessment grades
 * @route  POST /api/student-assessment-grade/search
 * @access Private
 */
export async function searchStudentAssessmentGrade(req: CustomRequest, res: Response) {
  try {
    const result = await studentAssessmentGradeService.searchStudentAssessmentGrade(req.body);

    if ((req as any).user) {
      await activityLogService.createActivityLog({
        userId: new mongoose.Types.ObjectId((req as any).user.id),
        headers: { "user-agent": req.get("user-agent") },
        ip: req.ip || "0.0.0.0",
        path: req.path,
        method: req.method,
        page: {
          url: req.originalUrl,
          title: "Student Assessment Grade - Search",
        },
        action: "read",
        description: "Searched student assessment grades",
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "student_assessment_grade",
        createdAt: new Date(),
      });
    }

    res.status(200).send(result);
  } catch (error) {
    handleZodError(error, res);
  }
}
