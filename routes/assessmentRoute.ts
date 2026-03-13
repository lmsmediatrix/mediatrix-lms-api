import express, { Request, Response } from "express";
import { API_ENDPOINTS } from "../config/endpointsConfig";
import { AssessmentZodSchema } from "../models/assessmentModel";
import assessmentService from "../services/assessmentService";
import { handleZodError } from "../middleware/zodErrorHandler";
import { ValidationSchemas } from "../helper/validationSchemas";
import { z } from "zod";
import { CustomRequest } from "../type/types";
import { upload } from "../middleware/multer";
import { processAssessmentFormData, processCsvQuestions } from "../helper/formDataHelper";
import activityLogService from "../services/activityLogService";
import auditLogService from "../services/auditLogService";
import mongoose from "mongoose";
import { ACTION, config, USER_ROLES } from "../config/common";
import { validatePermissions } from "../middleware/rabcMiddleware";
import notificationService from "../services/notificationService";
import sectionService from "../services/sectionService";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Assessments
 *   description: Assessment management endpoints for creating, updating, and managing course assessments, quizzes, and exams
 */

/**
 * @swagger
 * /api/assessment/get/all:
 *   get:
 *     summary: Get all assessments
 *     description: Retrieve a list of all assessments with optional filtering, sorting, and pagination
 *     tags: [Assessments]
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
 *         description: List of assessments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 assessment:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Assessment'
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
  API_ENDPOINTS.ASSESSMENT.GET_ALL,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.GET_ALL),
  getAssessments
);

/**
 * @swagger
 * /api/assessment/get/{id}:
 *   get:
 *     summary: Get assessment by ID
 *     description: Retrieve a specific assessment by its unique identifier
 *     tags: [Assessments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Assessment ID
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
 *         description: Assessment retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Assessment'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Assessment not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.ASSESSMENT.GET_BY_ID,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.GET_BY_ID),
  getAssessment
);

/**
 * @swagger
 * /api/assessment/create:
 *   post:
 *     summary: Create a new assessment
 *     description: Create a new assessment with questions, time limits, and grading settings
 *     tags: [Assessments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - section
 *             properties:
 *               title:
 *                 type: string
 *                 description: Assessment title
 *               description:
 *                 type: string
 *                 description: Assessment description
 *               section:
 *                 type: string
 *                 description: Section ID
 *               timeLimit:
 *                 type: integer
 *                 description: Time limit in minutes
 *               attemptsAllowed:
 *                 type: integer
 *                 description: Number of attempts allowed
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: Start date and time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 description: End date and time
 *               questions:
 *                 type: string
 *                 description: JSON string of questions
 *               csvFile:
 *                 type: string
 *                 format: binary
 *                 description: CSV file for bulk question import
 *               isShuffled:
 *                 type: boolean
 *                 description: Whether questions should be shuffled
 *               gradeMethod:
 *                 type: string
 *                 enum: [highest, latest, average]
 *                 description: Method for grading multiple attempts
 *     responses:
 *       200:
 *         description: Assessment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Assessment'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.ASSESSMENT.CREATE,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.CREATE),
  upload.any(),
  createAssessment
);

/**
 * @swagger
 * /api/assessment/update:
 *   put:
 *     summary: Update an assessment
 *     description: Update an existing assessment's details, questions, and settings
 *     tags: [Assessments]
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
 *                 description: Assessment ID
 *               title:
 *                 type: string
 *                 description: Assessment title
 *               description:
 *                 type: string
 *                 description: Assessment description
 *               section:
 *                 type: string
 *                 description: Section ID
 *               timeLimit:
 *                 type: integer
 *                 description: Time limit in minutes
 *               attemptsAllowed:
 *                 type: integer
 *                 description: Number of attempts allowed
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: Start date and time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 description: End date and time
 *               questions:
 *                 type: string
 *                 description: JSON string of questions
 *               csvFile:
 *                 type: string
 *                 format: binary
 *                 description: CSV file for bulk question import
 *               isShuffled:
 *                 type: boolean
 *                 description: Whether questions should be shuffled
 *               gradeMethod:
 *                 type: string
 *                 enum: [highest, latest, average]
 *                 description: Method for grading multiple attempts
 *     responses:
 *       200:
 *         description: Assessment updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Assessment'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Assessment not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.ASSESSMENT.UPDATE,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.UPDATE),
  upload.any(),
  updateAssessment
);

/**
 * @swagger
 * /api/assessment/remove/{id}:
 *   delete:
 *     summary: Delete an assessment
 *     description: Permanently delete an assessment and all its associated data
 *     tags: [Assessments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Assessment ID
 *     responses:
 *       200:
 *         description: Assessment deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Assessment deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Assessment not found
 *       500:
 *         description: Server error
 */
router.delete(
  API_ENDPOINTS.ASSESSMENT.REMOVE,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.DELETE),
  deleteAssessment
);

/**
 * @swagger
 * /api/assessment/search:
 *   post:
 *     summary: Search assessments with advanced filtering
 *     description: Search and filter assessments using various criteria and parameters
 *     tags: [Assessments]
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
 *                   title:
 *                     type: string
 *                     description: Search by assessment title
 *                   description:
 *                     type: string
 *                     description: Search by assessment description
 *                   section:
 *                     type: string
 *                     description: Filter by section ID
 *                   timeLimit:
 *                     type: integer
 *                     description: Filter by time limit in minutes
 *                   attemptsAllowed:
 *                     type: integer
 *                     description: Filter by number of attempts allowed
 *                   startDate:
 *                     type: object
 *                     description: Date range filter for start date
 *                     properties:
 *                       $gte:
 *                         type: string
 *                         format: date-time
 *                       $lte:
 *                         type: string
 *                         format: date-time
 *                   endDate:
 *                     type: object
 *                     description: Date range filter for end date
 *                     properties:
 *                       $gte:
 *                         type: string
 *                         format: date-time
 *                       $lte:
 *                         type: string
 *                         format: date-time
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
 *                 $ref: '#/components/schemas/Assessment'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.ASSESSMENT.SEARCH,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.SEARCH),
  searchAssessment
);

/**
 * @swagger
 * /api/assessment/submit:
 *   post:
 *     summary: Submit an assessment with answers
 *     description: Submit student answers for an assessment and receive immediate grading
 *     tags: [Assessments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - assessmentId
 *               - answers
 *             properties:
 *               assessmentId:
 *                 type: string
 *                 description: ID of the assessment to submit
 *               answers:
 *                 type: array
 *                 description: Array of answers for each question
 *                 items:
 *                   type: object
 *                   required:
 *                     - questionId
 *                     - answer
 *                   properties:
 *                     questionId:
 *                       type: string
 *                       description: ID of the question being answered
 *                     answer:
 *                       type: string
 *                       description: Student's answer to the question
 *     responses:
 *       200:
 *         description: Assessment submitted successfully
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
 *                   example: Assessment submitted successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     score:
 *                       type: number
 *                       description: Total score achieved
 *                     feedback:
 *                       type: string
 *                       description: Feedback on the submission
 *       400:
 *         description: Invalid input or missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: No attempts remaining
 *       404:
 *         description: Assessment not found
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.ASSESSMENT.SUBMIT_ASSESSMENT,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.CUSTOM),
  submitAssessment
);

/**
 * @swagger
 * /api/assessment/section/{sectionCode}/assessment/{assessmentId}/students:
 *   get:
 *     summary: Get students who have taken or not taken an assessment in a section
 *     description: Retrieve lists of students who have and haven't completed a specific assessment in a section
 *     tags: [Assessments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Section code to filter students
 *       - in: path
 *         name: assessmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Assessment ID to check completion status
 *     responses:
 *       200:
 *         description: Students retrieved successfully
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
 *                   example: Students retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     taken:
 *                       type: array
 *                       description: List of students who have taken the assessment
 *                       items:
 *                         $ref: '#/components/schemas/Student'
 *                     notTaken:
 *                       type: array
 *                       description: List of students who have not taken the assessment
 *                       items:
 *                         $ref: '#/components/schemas/Student'
 *       400:
 *         description: Invalid input or missing required parameters
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Section or assessment not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.ASSESSMENT.GET_SECTION_ASSESSMENT_STUDENTS,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.CUSTOM),
  getSectionAssessmentStudents
);

/**
 * @swagger
 * /api/assessment/{assessmentNo}/student/{studentId}:
 *   get:
 *     summary: Get student assessment result by student ID and assessment number
 *     description: Retrieve detailed results and feedback for a specific student's assessment attempt
 *     tags: [Assessments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assessmentNo
 *         required: true
 *         schema:
 *           type: string
 *         description: Assessment number to retrieve
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Student ID to get results for
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [quiz, exam, assignment]
 *         description: Type of assessment
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Section code for filtering
 *     responses:
 *       200:
 *         description: Student assessment result retrieved successfully
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
 *                   example: Student assessment result retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     score:
 *                       type: number
 *                       description: Total score achieved
 *                     feedback:
 *                       type: string
 *                       description: Feedback on the assessment
 *                     answers:
 *                       type: array
 *                       description: Detailed answers and scoring
 *                       items:
 *                         type: object
 *                         properties:
 *                           questionId:
 *                             type: string
 *                             description: ID of the question
 *                           answer:
 *                             type: string
 *                             description: Student's answer
 *                           correct:
 *                             type: boolean
 *                             description: Whether the answer was correct
 *       400:
 *         description: Invalid input or missing required parameters
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Assessment or student not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.ASSESSMENT.GET_STUDENT_ASSESSMENT_RESULT,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.CUSTOM),
  getStudentAssessmentResult
);

/**
 * @swagger
 * /api/assessment/student/{studentId}/result/{assessmentId}:
 *   put:
 *     summary: Update student assessment result scores
 *     description: Update or modify the scores and feedback for a student's assessment submission
 *     tags: [Assessments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Student ID to update results for
 *       - in: path
 *         name: assessmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Assessment ID to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - answers
 *             properties:
 *               answers:
 *                 type: array
 *                 description: Array of graded answers
 *                 items:
 *                   type: object
 *                   required:
 *                     - questionId
 *                     - pointsEarned
 *                     - isCorrect
 *                   properties:
 *                     questionId:
 *                       type: string
 *                       description: ID of the question
 *                     pointsEarned:
 *                       type: number
 *                       description: Points earned for this answer
 *                     isCorrect:
 *                       type: boolean
 *                       description: Whether the answer is correct
 *     responses:
 *       200:
 *         description: Student assessment result updated successfully
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
 *                   example: Student assessment result updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalScore:
 *                       type: number
 *                       description: Updated total score
 *                     feedback:
 *                       type: string
 *                       description: Updated feedback
 *       400:
 *         description: Invalid input or missing required fields
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Assessment result not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.ASSESSMENT.UPDATE_STUDENT_RESULT,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.CUSTOM),
  updateStudentAssessmentResult
);

/**
 * @swagger
 * /api/assessment/archive/{id}:
 *   put:
 *     summary: Archive an assessment (soft delete)
 *     description: Archive an assessment while preserving its data and history
 *     tags: [Assessments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Assessment ID to archive
 *     responses:
 *       200:
 *         description: Assessment archived successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Assessment archived successfully
 *                 data:
 *                   $ref: '#/components/schemas/Assessment'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Assessment not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.ASSESSMENT.ARCHIVE,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.ARCHIVE),
  archiveAssessment
);

export default router;

/*
 * @desc   get all assessment
 * @route  GET /api/assessment/get/all
 * @access Private
 */
export async function getAssessments(req: Request, res: Response) {
  try {
    let processedSelect: string[] = [];
    const selectQueryParam = req.query.select;

    if (typeof selectQueryParam === "string") {
      if (selectQueryParam.includes(",")) {
        processedSelect = selectQueryParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      } else {
        processedSelect = selectQueryParam
          .split(/\s+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
    } else if (Array.isArray(selectQueryParam)) {
      processedSelect = selectQueryParam.map((s) => String(s).trim()).filter(Boolean);
    }

    const params = ValidationSchemas.getQueriesParams.parse({
      query: req.query.query || {},
      queryArray: req.query.queryArray,
      queryArrayType: req.query.queryArrayType,
      populateArray: req.query.populateArray ? JSON.parse(req.query.populateArray as string) : [],
      sort: req.query.sort,
      limit: req.query.limit,
      skip: req.query.skip,
      select: processedSelect,
      lean: req.query.lean,
      count: req.query.count === "true",
      document: req.query.document === "true",
      pagination: req.query.pagination === "true",
    });

    const { assessment, pagination, count } = await assessmentService.getAssessments(params);

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
          title: "",
        },
        action: "read",
        description: `Retrieved ${Array.isArray(assessment) ? assessment.length : 0} assessments${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "assessment",
        createdAt: new Date(),
      });
    }

    res.status(200).send({ assessment, pagination, count });
  } catch (error) {
    handleZodError(error, res);
  }
}

/*
 * @desc   get assessment by id
 * @route  GET /api/assessment/get/:id
 * @access Private
 */
export async function getAssessment(req: Request, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    let processedSelect: string[] = [];
    const selectQueryParam = req.query.select;

    if (typeof selectQueryParam === "string") {
      if (selectQueryParam.includes(",")) {
        processedSelect = selectQueryParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      } else {
        processedSelect = selectQueryParam
          .split(/\s+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
    } else if (Array.isArray(selectQueryParam)) {
      processedSelect = selectQueryParam.map((s) => String(s).trim()).filter(Boolean);
    }

    const params = ValidationSchemas.getQueryParams.parse({
      populateArray: req.query.populateArray ? JSON.parse(req.query.populateArray as string) : [],
      select: processedSelect,
      lean: req.query.lean,
    });
    if ((req as any).user && (req as any).user.role === "student") {
      params.studentId = (req as any).user.id;
    }
    const userRole = (req as any).user?.role;
    const assessment = await assessmentService.getAssessment(id, params, userRole);
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
          title: "",
        },
        action: "read",
        description: `Viewed assessment: ${assessment?.title || id}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "assessment",
        createdAt: new Date(),
      });
    }
    res.status(200).send(assessment);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function createAssessment(req: CustomRequest, res: Response) {
  try {
    const user = req.user;
    const csvFile =
      req.files && Array.isArray(req.files)
        ? req.files.find((file) => file.fieldname === "csvFile")
        : null;

    if (csvFile) {
      const processResult = processCsvQuestions(csvFile.buffer);

      if (processResult.error || !processResult.processedQuestions) {
        return res.status(400).json({
          success: false,
          message: processResult.error || "Failed to process CSV file",
          details: processResult.details,
        });
      }
      if (!req.body.questions) {
        req.body.questions = [];
      } else if (typeof req.body.questions === "string") {
        try {
          req.body.questions = JSON.parse(req.body.questions);
        } catch (e) {
          req.body.questions = [];
        }
      }
      req.body.questions = [
        ...(Array.isArray(req.body.questions) ? req.body.questions : []),
        ...processResult.processedQuestions,
      ];
    }
    if ("questions" in req.body) {
      if (typeof req.body.questions === "string") {
        try {
          req.body.questions = JSON.parse(req.body.questions);
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: "Invalid JSON format for questions",
          });
        }
      }
    }
    const files: { [fieldname: string]: Express.Multer.File[] } = {};
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach((file) => {
        const fieldName = file.fieldname;
        if (!files[fieldName]) {
          files[fieldName] = [];
        }
        files[fieldName].push(file);
      });
    }
    const processed = processAssessmentFormData(req.body);

    if (processed.error) {
      return res.status(400).json({
        success: false,
        message: processed.error,
        details: processed.details,
      });
    }

    if (processed.processedData && processed.processedData.isShuffled === true) {
      processed.processedData.totalPoints = null;
    }

    if (
      !processed.processedData ||
      !processed.processedData.questions ||
      processed.processedData.questions.length === 0
    ) {
      console.error("Form data processing error:", processed.error, processed.details);
    }

    try {
      const validatedData = AssessmentZodSchema.partial()
        .extend({ path: z.string().optional() })
        .parse(processed.processedData);
      const validatedDataWithPath = {
        ...validatedData,
        path:
          validatedData.path ||
          (typeof req.body.organizationId === "string"
            ? `${req.body.organizationId}/sections/${req.body.section}/`
            : "ORGA"),
      };
      const newAssessment = await assessmentService.createAssessment(
        validatedDataWithPath,
        user,
        files
      );

      res.status(200).send(newAssessment);
      const sectionId = validatedDataWithPath.section?.toString();
      if (!sectionId) {
        console.error("No section ID found in validated data");
        return res.status(400).json({
          success: false,
          message: "Section ID is required for notification",
        });
      }
      const section = await sectionService.getSection(sectionId, {
        select: "_id instructor students name code",
        populateArray: [
          { path: "instructor", select: "_id firstName lastName" },
          { path: "students", select: "_id firstName lastName" },
        ],
        query: {
          organizationId: validatedDataWithPath.organizationId?.toString(),
        },
      });
      if (section && section.instructor && section.students && section.students.length > 0) {
        await notificationService.sendNotification({
          query: { _id: { $in: section.students.map((student: any) => student._id) } },
          sectionId: section._id.toString(),
          notification: {
            category: "ASSESSMENT",
            source: section.instructor._id,
            recipients: {
              read: [],
              unread: section.students.map((student) => ({
                user: new mongoose.Types.ObjectId(student._id),
                date: null,
              })),
            },
            metadata: (_params: any) => ({
              path: `/student/sections/${section.code}?tab=assessments&id=${newAssessment._id}`,
              assessment: {
                title: newAssessment.title,
              },
            }),
          },
          template: {
            title: ({ section: _section }) => `A new assessment has been added to ${_section.name}`,
            description: ({ sender }) =>
              `${sender.firstName} has added a new assessment: "${newAssessment.title}"`,
          },
          type: "student",
        });
      }

      if (user) {
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
            title: "",
          },
          action: "create",
          description: `Created new assessment: ${newAssessment.title || "Untitled"}`,
          organizationId: new mongoose.Types.ObjectId(user.organizationId),
          entityType: "assessment",
          createdAt: new Date(),
        });

        await auditLogService.createAuditLog({
          user: new mongoose.Types.ObjectId(user.id),
          type: "CREATE",
          severity: "INFO",
          entity: {
            type: "ASSESSMENT",
            id: newAssessment._id,
          },
          changes: {
            before: {},
            after: validatedDataWithPath,
          },
          metadata: {
            userAgent: req.get("user-agent"),
            ip: req.ip,
            path: req.path,
            method: req.method,
          },
          description: `Created new assessment: ${newAssessment.title || "Untitled"}`,
          organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        });
      }
    } catch (zodError) {
      return handleZodError(zodError, res);
    }
  } catch (error) {
    if (error instanceof Error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
    handleZodError(error, res);
  }
}

export async function updateAssessment(req: Request, res: Response) {
  try {
    const files: { [fieldname: string]: Express.Multer.File[] } = {};
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach((file) => {
        const fieldName = file.fieldname;
        if (!files[fieldName]) {
          files[fieldName] = [];
        }
        files[fieldName].push(file);
      });
    }
    const processed = processAssessmentFormData(req.body);

    if (processed.error) {
      console.error("Form data processing error:", processed.error, processed.details);
      return res.status(400).json({
        success: false,
        message: processed.error,
        details: processed.details,
      });
    }

    if (!processed.processedData) {
      return res.status(400).json({
        success: false,
        message: "Failed to process assessment data",
      });
    }
    processed.processedData._id = req.body._id;
    if (processed.processedData.timeLimit) {
      processed.processedData.timeLimit = Number(processed.processedData.timeLimit);
    }
    if (processed.processedData.attemptsAllowed) {
      processed.processedData.attemptsAllowed = Number(processed.processedData.attemptsAllowed);
    }
    if (processed.processedData.startDate) {
      processed.processedData.startDate = new Date(processed.processedData.startDate);
    }
    if (processed.processedData.endDate) {
      processed.processedData.endDate = new Date(processed.processedData.endDate);
    }
    const validatedData = AssessmentZodSchema.partial()
      .extend({ _id: z.string().min(1), path: z.string().optional() })
      .parse(processed.processedData);

    // Get existing assessment to track changes
    const existingAssessment = await assessmentService.getAssessment(validatedData._id as string, {
      select: "title description startDate endDate questions timeLimit gradeMethod attemptsAllowed",
      lean: true,
    });

    const updateAssessment = await assessmentService.updateAssessment(validatedData, files);

    // Get section details for notification
    if (updateAssessment && updateAssessment.section) {
      // Track which fields were updated
      const updatedFields: string[] = [];
      if (existingAssessment) {
        if (existingAssessment.title !== updateAssessment.title) updatedFields.push("Title");
        if (existingAssessment.description !== updateAssessment.description)
          updatedFields.push("Description");
        if (String(existingAssessment.startDate) !== String(updateAssessment.startDate))
          updatedFields.push("Start Date");
        if (String(existingAssessment.endDate) !== String(updateAssessment.endDate))
          updatedFields.push("End Date");
        if (
          JSON.stringify(existingAssessment.questions) !==
          JSON.stringify(updateAssessment.questions)
        )
          updatedFields.push("Questions");
        if (existingAssessment.timeLimit !== updateAssessment.timeLimit)
          updatedFields.push("Time Limit");
        if (existingAssessment.gradeMethod !== updateAssessment.gradeMethod)
          updatedFields.push("Grading Method");
        if (existingAssessment.attemptsAllowed !== updateAssessment.attemptsAllowed)
          updatedFields.push("Number of Attempts");
      }

      const section = await sectionService.getSection(updateAssessment.section.toString(), {
        select: "_id instructor students name code",
        populateArray: [
          { path: "instructor", select: "_id firstName lastName" },
          { path: "students", select: "_id firstName lastName" },
        ],
        query: {
          organizationId: validatedData.organizationId?.toString(),
        },
      });

      if (section && section.instructor && section.students && section.students.length > 0) {
        await notificationService.sendNotification({
          query: { _id: { $in: section.students.map((student: any) => student._id) } },
          sectionId: section._id.toString(),
          notification: {
            category: "ASSESSMENT",
            source: section.instructor._id,
            recipients: {
              read: [],
              unread: section.students.map((student) => ({
                user: new mongoose.Types.ObjectId(student._id),
                date: null,
              })),
            },
            metadata: () => ({
              path: `/student/sections/${section.code}?tab=assessments&id=${updateAssessment._id}`,
              assessment: {
                title: updateAssessment.title,
              },
              updatedFields,
            }),
          },
          template: {
            title: ({ section: _section }) => `An assessment has been updated in ${_section.name}`,
            description: ({ sender }) =>
              `${sender.firstName} has updated the assessment: "${updateAssessment.title}"${
                updatedFields.length > 0 ? `Updated: ${updatedFields.join(", ")}` : ""
              }`,
          },
          type: "student",
        });
      }
    }

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
          title: "",
        },
        action: "update",
        description: `Updated assessment: ${updateAssessment?.title || validatedData._id}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "assessment",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId((req as any).user.id),
        type: "UPDATE",
        severity: "INFO",
        entity: {
          type: "ASSESSMENT",
          id: new mongoose.Types.ObjectId(validatedData._id),
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
        description: `Updated assessment: ${updateAssessment?.title || validatedData._id}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });
    }

    res.status(200).send(updateAssessment);
  } catch (error) {
    console.error("Error in updateAssessment:", error);
    handleZodError(error, res);
  }
}

export async function deleteAssessment(req: Request, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });
    const deleteAssessment = await assessmentService.deleteAssessment(id);

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
          title: "",
        },
        action: "delete",
        description: `Deleted assessment: ${deleteAssessment?.title || id}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "assessment",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId((req as any).user.id),
        type: "DELETE",
        severity: "INFO",
        entity: {
          type: "ASSESSMENT",
          id: new mongoose.Types.ObjectId(id),
        },
        changes: {
          before: {},
          after: {},
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Deleted assessment: ${deleteAssessment?.title || id}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });
    }

    res.status(200).send(deleteAssessment);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function searchAssessment(req: Request, res: Response) {
  try {
    const searchAssessment = await assessmentService.searchAssessment(req.body);

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
          title: "",
        },
        action: "search",
        description: `Assessment search performed${Object.keys(req.body).length ? ` with criteria: custom filter` : ""} (found ${searchAssessment?.length || 0} results)`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "assessment",
        createdAt: new Date(),
      });
    }

    res.status(200).send(searchAssessment);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function submitAssessment(req: CustomRequest, res: Response) {
  try {
    const studentId = req.user?.id;

    const answers =
      req.body.answers?.map((answer: any) => ({
        ...answer,
        questionId: isNaN(Number(answer.questionId))
          ? answer.questionId
          : Number(answer.questionId),
      })) || [];

    const submissionData = {
      ...req.body,
      studentId,
      answers,
    };

    try {
      const result = await assessmentService.submitAssessment(submissionData);
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
            title: "",
          },
          action: "submit",
          description: `Submitted assessment: ${submissionData.assessmentId}`,
          organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
          entityType: "assessment",
          createdAt: new Date(),
        });

        await auditLogService.createAuditLog({
          user: new mongoose.Types.ObjectId(req.user.id),
          type: "SUBMIT",
          severity: "INFO",
          entity: {
            type: "ASSESSMENT",
            id: submissionData.assessmentId,
          },
          changes: {
            before: {},
            after: submissionData,
          },
          metadata: {
            userAgent: req.get("user-agent"),
            ip: req.ip,
            path: req.path,
            method: req.method,
          },
          description: `Submitted assessment: ${submissionData.assessmentId}`,
          organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        });
      }

      res.status(200).send({
        success: true,
        message: "Assessment submitted successfully",
        data: result,
      });
    } catch (error) {
      // Check for attempts exceeded error
      if (error instanceof Error && error.message.includes("No attempts remaining")) {
        return res.status(403).json({
          success: false,
          message: error.message,
          code: "ATTEMPTS_EXCEEDED",
        });
      }
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
    handleZodError(error, res);
  }
}

export async function getSectionAssessmentStudents(req: Request, res: Response) {
  try {
    const { sectionCode, assessmentId } = req.params;

    if (!sectionCode || !assessmentId) {
      return res.status(400).json({
        success: false,
        message: "Section ID and Assessment ID are required",
      });
    }

    const result = await assessmentService.getSectionAssessmentStudents(sectionCode, assessmentId);

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
          title: "",
        },
        action: "read",
        description: `Retrieved students for assessment: ${assessmentId} in section: ${sectionCode}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "assessment",
        createdAt: new Date(),
      });
    }

    res.status(200).json({
      success: true,
      message: "Students retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in getSectionAssessmentStudents:", error);

    if (error instanceof Error) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    handleZodError(error, res);
  }
}

/*
 * @desc   Get student assessment result by student ID and assessment number
 * @route  GET /api/assessment/:assessmentNo/student/:studentId?type=quiz
 * @access Private
 */
export async function getStudentAssessmentResult(req: Request, res: Response) {
  try {
    const { studentId, assessmentNo } = req.params;
    const { type, code } = req.query;
    if (!studentId || !assessmentNo) {
      return res.status(400).json({
        success: false,
        message: "Student ID and Assessment No are required",
      });
    }

    if (!type || typeof type !== "string") {
      return res.status(400).json({
        success: false,
        message: "Assessment type is required as a query parameter",
      });
    }
    const result = await assessmentService.getStudentAssessmentResult(
      studentId,
      assessmentNo,
      type,
      code as string
    );

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
          title: "",
        },
        action: "read",
        description: `Retrieved assessment result for: ${assessmentNo} (student: ${studentId})`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "assessment",
        createdAt: new Date(),
      });
    }

    res.status(200).json({
      success: true,
      message: "Student assessment result retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in getStudentAssessmentResult:", error);

    if (error instanceof Error) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    handleZodError(error, res);
  }
}

/*
 * @desc   Update student assessment result by student ID and assessment ID
 * @route  PUT /api/assessment/student/:studentId/result/:assessmentId
 * @access Private
 */
export async function updateStudentAssessmentResult(req: Request, res: Response) {
  try {
    const { studentId, assessmentId } = req.params;
    const { answers } = req.body;

    if (!studentId || !assessmentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID and Assessment ID are required",
      });
    }

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Answers array is required and cannot be empty",
      });
    }

    const result = await assessmentService.updateStudentAssessmentResult(
      studentId,
      assessmentId,
      answers
    );

    const assessment = (await assessmentService.getAssessment(assessmentId, {
      select: "_id title section",
      populateArray: [
        {
          path: "section",
          select: "_id instructor code",
          populate: {
            path: "instructor",
            select: "_id firstName lastName",
          },
        },
      ],
      lean: true,
    })) as any;

    if (assessment?.section?.instructor && assessment?.section?.code) {
      const instructor = assessment.section.instructor;
      const instructorName =
        instructor.firstName && instructor.lastName
          ? `${instructor.firstName} ${instructor.lastName}`
          : "Your instructor";

      await notificationService.createNotification({
        recipients: {
          read: [],
          unread: [
            {
              user: new mongoose.Types.ObjectId(studentId),
              date: null,
            },
          ],
        },
        source: instructor._id,
        category: "ASSESSMENT",
        title: `Your assessment has been graded by ${instructorName}.`,
        description: `Your ${assessment.title} has been graded. Your score is ${result.totalScore} points.`,
        metadata: {
          path: `/student/sections/${assessment.section.code}?tab=assessments&id=${assessment._id}`,
          assessment: {
            title: assessment.title,
            score: result.totalScore,
          },
        },
      });
    }

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
          title: "Update Student Assessment Result",
        },
        action: "update",
        description: `Updated assessment result for: ${assessmentId} (student: ${studentId})`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "assessment",
        createdAt: new Date(),
      });
    }

    res.status(200).json({
      success: true,
      message: "Student assessment result updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in updateStudentAssessmentResult:", error);

    if (error instanceof Error) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    handleZodError(error, res);
  }
}

export async function archiveAssessment(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "User not authenticated or missing organization" });
    }

    const archivedAssessment = await assessmentService.archiveAssessment(id);

    if (!archivedAssessment) {
      return res.status(404).json({ message: "Assessment not found" });
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
        title: "Archive Assessment",
      },
      action: "archive",
      description: `Archived assessment: ${archivedAssessment.title || id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      entityType: "assessment",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(req.user.id),
      type: "UPDATE",
      severity: "INFO",
      entity: {
        type: "ANNOUNCEMENT",
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
      description: `Archived assessment: ${archivedAssessment.title || id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });

    res.status(200).json({
      message: config.SUCCESS.ASSESSMENT.ARCHIVE,
      data: archivedAssessment,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}
