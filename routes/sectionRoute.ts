import express, { Request, Response } from "express";
import { API_ENDPOINTS } from "../config/endpointsConfig";
import { SectionZodSchema } from "../models/sectionModel";
import { handleZodError } from "../middleware/zodErrorHandler";
import { ValidationSchemas } from "../helper/validationSchemas";
import sectionService from "../services/sectionService";
import { z } from "zod";
import { CustomRequest } from "../type/types";
import { ACTION, config, USER_ROLES } from "../config/common";
import { validatePermissions } from "../middleware/rabcMiddleware";
import auditLogService from "../services/auditLogService";
import mongoose from "mongoose";
import activityLogService from "../services/activityLogService";
import { upload } from "../middleware/multer";
import { Readable } from "stream";
import { parse } from "csv-parse";
import userService from "../services/userService";
import notificationService from "../services/notificationService";
import { sendCSVResponse } from "../utils/csvUtils/csvResponse";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Sections
 *   description: Section management endpoints for handling course sections, student enrollments, attendance, and related operations
 */

/**
 * @swagger
 * /api/section/get/all:
 *   get:
 *     summary: Get all sections with filtering and pagination
 *     description: Retrieve a list of all sections with support for filtering, sorting, pagination, and field selection
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: object
 *         description: Query parameters for filtering sections (e.g., name, code, status)
 *       - in: query
 *         name: queryArray
 *         schema:
 *           type: array
 *         description: Array of query parameters for complex filtering
 *       - in: query
 *         name: populateArray
 *         schema:
 *           type: string
 *         description: Fields to populate (e.g., students, instructor, modules)
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
 *         description: List of sections retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Sections retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Section'
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
  API_ENDPOINTS.SECTION.GET_ALL,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN],
    ACTION.GET_ALL
  ),
  getSections
);

/**
 * @swagger
 * /api/section/get/{id}:
 *   get:
 *     summary: Get section by ID
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Section ID
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
 *         description: Section retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Section'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Section not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.SECTION.GET_BY_ID,
  validatePermissions(
    [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN],
    ACTION.GET_BY_ID
  ),
  getSection
);

/**
 * @swagger
 * /api/section/create:
 *   post:
 *     summary: Create a new section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Section'
 *     responses:
 *       200:
 *         description: Section created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Section'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.SECTION.CREATE,
  validatePermissions([USER_ROLES.ADMIN], ACTION.CREATE),
  createSection
);

/**
 * @swagger
 * /api/section/update:
 *   put:
 *     summary: Update a section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/Section'
 *               - type: object
 *                 required:
 *                   - _id
 *                 properties:
 *                   _id:
 *                     type: string
 *                     description: Section ID
 *     responses:
 *       200:
 *         description: Section updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Section'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Section not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.SECTION.UPDATE,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR], ACTION.UPDATE),
  updateSection
);

/**
 * @swagger
 * /api/section/remove/{id}:
 *   delete:
 *     summary: Delete a section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Section ID
 *     responses:
 *       200:
 *         description: Section deleted successfully
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
 *         description: Section not found
 *       500:
 *         description: Server error
 */
router.delete(
  API_ENDPOINTS.SECTION.REMOVE,
  validatePermissions([USER_ROLES.ADMIN], ACTION.DELETE),
  deleteSection
);

/**
 * @swagger
 * /api/section/search:
 *   post:
 *     summary: Search sections
 *     tags: [Sections]
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
 *         description: List of sections matching search criteria
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Section'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.SECTION.SEARCH,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.SEARCH),
  searchSection
);

/**
 * @swagger
 * /api/section/attendance:
 *   post:
 *     summary: Mark attendance for a section
 *     tags: [Sections]
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
 *             properties:
 *               sectionId:
 *                 type: string
 *                 description: Section ID
 *               remarks:
 *                 type: string
 *                 description: Optional remarks for attendance
 *     responses:
 *       200:
 *         description: Attendance marked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.SECTION.MARK_ATTENDANCE,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR], ACTION.CUSTOM),
  markAttendance
);

/**
 * @swagger
 * /api/section/{sectionCode}/attendance:
 *   get:
 *     summary: Get attendance for a section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Section code
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for attendance records (YYYY-MM-DD)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for attendance records (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Section attendance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                 totalEnrolled:
 *                   type: integer
 *       400:
 *         description: Invalid date format
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to view this section's attendance
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.SECTION.SECTION_ATTENDANCE,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.CUSTOM),
  getSectionAttendance
);

/**
 * @swagger
 * /api/section/{sectionCode}/assessment:
 *   get:
 *     summary: Get pending assessments for a student in a section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Section code
 *     responses:
 *       200:
 *         description: Pending assessments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     newAssessmentCount:
 *                       type: integer
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to view this section's assessments
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.SECTION.SECTION_ASSESSMENT,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.CUSTOM),
  getSectionAssessment
);

/**
 * @swagger
 * /api/section/bulk-add-students:
 *   post:
 *     summary: Bulk add students to a section
 *     tags: [Sections]
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
 *                 description: CSV file containing student email addresses
 *     responses:
 *       200:
 *         description: Students added to section successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 processStats:
 *                   type: object
 *                   properties:
 *                     totalProcessed:
 *                       type: integer
 *                     totalSuccess:
 *                       type: integer
 *                     totalErrors:
 *                       type: integer
 *                 results:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: array
 *                     errors:
 *                       type: array
 *       400:
 *         description: Invalid input or file format
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No matching students found
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.SECTION.BULK_ADD_STUDENTS,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR], ACTION.CUSTOM),
  upload.single("file"),
  bulkAddStudents
);

/**
 * @swagger
 * /api/section/archive/{id}:
 *   put:
 *     summary: Archive a section (soft delete)
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Section ID to archive
 *     responses:
 *       200:
 *         description: Section archived successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Section archived successfully
 *                 data:
 *                   $ref: '#/components/schemas/Section'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Section not found
 *       500:
 *         description: Server error
 */
router.put(
  API_ENDPOINTS.SECTION.ARCHIVE,
  validatePermissions(
    [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN, USER_ROLES.INSTRUCTOR],
    ACTION.ARCHIVE
  ),
  archiveSection
);

/**
 * @swagger
 * /api/section/{sectionCode}/announcement:
 *   get:
 *     summary: Get announcements for a section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Section code
 *       - in: query
 *         name: userType
 *         schema:
 *           type: string
 *           enum: [student, instructor]
 *         description: Filter announcements based on user type. Future announcements are excluded for students.
 *       - in: query
 *         name: count
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Whether to include total count in response
 *       - in: query
 *         name: document
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Whether to include document data in response
 *       - in: query
 *         name: newAnnouncementsCount
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Whether to include count of today's announcements
 *     responses:
 *       200:
 *         description: Section announcements retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 current:
 *                   type: array
 *                   description: Today's announcements
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       textBody:
 *                         type: string
 *                       publishDate:
 *                         type: string
 *                         format: date-time
 *                 future:
 *                   type: array
 *                   description: Future announcements (only for instructors)
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       textBody:
 *                         type: string
 *                       publishDate:
 *                         type: string
 *                         format: date-time
 *                 past:
 *                   type: array
 *                   description: Past announcements
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       textBody:
 *                         type: string
 *                       publishDate:
 *                         type: string
 *                         format: date-time
 *                 count:
 *                   type: integer
 *                 todayAnnouncementsCount:
 *                   type: integer
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to view this section's announcements
 *       404:
 *         description: Section not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.SECTION.SECTION_ANNOUNCEMENT,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.CUSTOM),
  getSectionAnnouncement
);

/**
 * @swagger
 * /api/section/{sectionCode}/grades:
 *   get:
 *     summary: Get student grades for a section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Section code
 *     responses:
 *       200:
 *         description: Student grades retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Section not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.SECTION.SECTION_STUDENT_GRADES,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.CUSTOM),
  getStudentGrades
);

/**
 * @swagger
 * /api/section/{sectionCode}/analytics:
 *   get:
 *     summary: Get analytics for student grades in a section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Section code
 *     responses:
 *       200:
 *         description: Grade analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalStudentsEnrolled:
 *                       type: number
 *                     averageFinalGrade:
 *                       type: number
 *                     topGradesPercent:
 *                       type: number
 *                     gradeData:
 *                       type: array
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to view this section's analytics
 *       404:
 *         description: Section not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.SECTION.SECTION_STUDENT_GRADES_ANALYTICS,
  validatePermissions([USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.GET_ALL),
  getSectionStudentGradesAnalytics
);

router.post(
  API_ENDPOINTS.SECTION.EXPORT,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR], ACTION.CUSTOM),
  exportSection
);

/**
 * @swagger
 * /api/section/{sectionCode}/student/remove/{studentId}:
 *   delete:
 *     summary: Remove a student from a section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Section code
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Student ID to remove
 *     responses:
 *       200:
 *         description: Student removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Section'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Section or student not found
 *       500:
 *         description: Server error
 */
router.delete(
  API_ENDPOINTS.SECTION.REMOVE_STUDENT_IN_SECTION,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR], ACTION.DELETE),
  removeStudentFromSection
);

router.post(
  API_ENDPOINTS.SECTION.HELPER_CODE,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR], ACTION.CUSTOM),
  generateSectionCode
);

/**
 * @swagger
 * /api/section/attendance/update:
 *   post:
 *     summary: Update or create attendance status for a student
 *     tags: [Sections]
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
 *               - userId
 *               - status
 *               - date
 *             properties:
 *               sectionId:
 *                 type: string
 *                 description: ID of the section
 *               userId:
 *                 type: string
 *                 description: ID of the user (student) whose attendance to update
 *               status:
 *                 type: string
 *                 enum: ["present", "absent", "late", "excused"]
 *                 description: Attendance status
 *               date:
 *                 type: string
 *                 format: date-time
 *                 description: Date for the attendance record (YYYY-MM-DD)
 *               remarks:
 *                 type: string
 *                 description: Optional remarks for the attendance
 *     responses:
 *       200:
 *         description: Attendance status updated or created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     previousStatus:
 *                       type: string
 *                       nullable: true
 *                     updatedStatus:
 *                       type: string
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Section not found
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.SECTION.UPDATE_ATTENDANCE,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR], ACTION.UPDATE),
  updateAttendanceStatus
);

/**
 * @swagger
 * /api/section/{sectionCode}/module:
 *   get:
 *     summary: Get modules and lessons for a section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Section code
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of items to skip
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of modules per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: -createdAt
 *         description: Sort criteria (e.g. -createdAt, title)
 *     responses:
 *       200:
 *         description: Section modules retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 modules:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           title:
 *                             type: string
 *                           lessons:
 *                             type: array
 *                     pagination:
 *                       type: object
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to view this section's modules
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.SECTION.SECTION_MODULE,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.CUSTOM),
  getSectionModules
);

/**
 * @swagger
 * /api/section/{sectionCode}/students:
 *   get:
 *     summary: Get students enrolled in a section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Section code
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of items to skip
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: "lastName"
 *         description: Field to sort by (prefix with - for descending order)
 *     responses:
 *       200:
 *         description: Students retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 students:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           firstName:
 *                             type: string
 *                           lastName:
 *                             type: string
 *                           email:
 *                             type: string
 *                           avatar:
 *                             type: string
 *                           program:
 *                             type: string
 *                     pagination:
 *                       type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - User doesn't have access to this section
 *       404:
 *         description: Section not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.SECTION.SECTION_STUDENT,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.CUSTOM),
  getSectionStudents
);

/**
 * @swagger
 * /api/section/{sectionCode}/student/export:
 *   get:
 *     summary: Export students from a section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Section code
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of items to skip
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Maximum number of items to return (0 means no limit)
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: "lastName"
 *         description: Field to sort by (prefix with - for descending order)
 *     responses:
 *       200:
 *         description: Students exported successfully as CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - User doesn't have access to this section
 *       404:
 *         description: Section not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.SECTION.SECTION_STUDENT_EXPORT,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR, USER_ROLES.STUDENT], ACTION.CUSTOM),
  exportSectionStudents
);

/**
 * @swagger
 * /api/section/export/grades/{sectionCode}:
 *   get:
 *     summary: Export section student grades
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Section code
 *     responses:
 *       200:
 *         description: CSV file containing section grades
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Section not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.SECTION.SECTION_STUDENT_GRADES_EXPORT,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR, USER_ROLES.STUDENT], ACTION.CUSTOM),
  exportSectionStudentGrades
);

/**
 * @swagger
 * /api/section/{sectionCode}/grade/system:
 *   get:
 *     summary: Get the grade system for a section
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Section code
 *     responses:
 *       200:
 *         description: Grade system retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 gradeSystem:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Section not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.SECTION.SECTION_GRADE_SYSTEM,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.CUSTOM),
  getSectionGradeSystem
);

/**
 * @swagger
 * /api/section/{sectionCode}/students:
 *   post:
 *     summary: Add students to a section by section code
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Section code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - studentIds
 *             properties:
 *               studentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of student IDs to add
 *     responses:
 *       200:
 *         description: Students added to section successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Section'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Section not found
 *       500:
 *         description: Server error
 */
router.post(
  API_ENDPOINTS.SECTION.ADD_STUDENTS_TO_SECTION_BY_CODE,
  validatePermissions([USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR], ACTION.UPDATE),
  addStudentsToSectionByCode
);

/**
 * @swagger
 * /api/section/{sectionCode}/schedule:
 *   get:
 *     summary: Get section schedule
 *     description: Retrieve schedule data for a specific section based on user role and section context
 *     tags: [Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Section code
 *       - in: query
 *         name: role
 *         required: true
 *         schema:
 *           type: string
 *           enum: [student, instructor, admin, superadmin]
 *         description: User role
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to get schedule for
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for schedule events (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for schedule events (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Section schedule data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Section schedule data retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     sectionInfo:
 *                       type: object
 *                       properties:
 *                         code:
 *                           type: string
 *                         name:
 *                           type: string
 *                         instructor:
 *                           type: string
 *                     events:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           title:
 *                             type: string
 *                           date:
 *                             type: string
 *                             format: date
 *                           time:
 *                             type: string
 *                           type:
 *                             type: string
 *                           description:
 *                             type: string
 *                           location:
 *                             type: string
 *                           attendees:
 *                             type: array
 *                             items:
 *                               type: string
 *       400:
 *         description: Missing required parameters or invalid date format
 *       401:
 *         description: Unauthorized - User not authenticated
 *       403:
 *         description: Forbidden - User doesn't have access to this section
 *       404:
 *         description: Section not found
 *       500:
 *         description: Server error
 */
router.get(
  API_ENDPOINTS.SECTION.SECTION_SCHEDULE,
  validatePermissions([USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN], ACTION.CUSTOM),
  getSectionSchedule
);

export async function getSections(req: CustomRequest, res: Response) {
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

    if (!params.query) params.query = {};
    if (!req.user || !req.user.organizationId) {
      throw new Error("User not authenticated or missing organization");
    }
    params.query.organizationId = req.user.organizationId;

    const { sections, pagination, count } = await sectionService.getSections(params);
    res
      .status(200)
      .send({ message: config.SUCCESS.SECTION.GET_ALL, data: sections, pagination, count });

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
          title: "Section Management - View All Sections",
        },
        action: "read",
        description: `Retrieved ${sections.length} sections${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "section",
        createdAt: new Date(),
      });
    }
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getSection(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });
    const params = ValidationSchemas.getQueryParams.parse({
      populateArray: req.query.populateArray ? JSON.parse(req.query.populateArray as string) : [],
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

    const section = await sectionService.getSection(id, dbParams);

    if (!section) {
      return res.status(404).send({ message: "Section not found" });
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
          title: "Section Management - View Section Details",
        },
        action: "read",
        description: `Viewed section details for ${section.code}${Array.isArray(params.select) && params.select.length ? ` with fields: ${params.select.join(", ")}` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "section",
        createdAt: new Date(),
      });
    }

    res.status(200).send({ message: config.SUCCESS.SECTION.GET_BY_ID, data: section });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function createSection(req: CustomRequest, res: Response) {
  try {
    const user = req.user;
    if (!user) throw new Error("User not found");

    const validatedData = SectionZodSchema.partial().parse(req.body);
    const newSection = await sectionService.createSection(validatedData, user);
    res.status(200).send({ message: config.SUCCESS.SECTION.CREATE, data: newSection });

    await notificationService.sendNotification({
      query: { _id: new mongoose.Types.ObjectId(newSection.instructor.toString()) },
      sectionId: newSection._id.toString(),
      notification: {
        category: "SECTION",
        source: new mongoose.Types.ObjectId(user.id),
        recipients: {
          read: [],
          unread: [
            {
              user: new mongoose.Types.ObjectId(newSection.instructor),
              date: null,
            },
          ],
        },
        metadata: (_params: any) => ({
          path: `/instructor/sections/${newSection.code}`,
          section: {
            name: newSection.name,
            code: newSection.code,
          },
        }),
      },
      template: {
        title: () =>
          `You have been assigned to a new section: ${newSection.name || "Unnamed Section"}`,
        description: () => {
          const sectionName = newSection.name || "Unnamed Section";
          const sectionCode = newSection.code || "No Code";
          return `You are now the instructor for section "${sectionName}" (code: ${sectionCode})`;
        },
      },
      type: "instructor",
    });

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
          title: "Section Management - Create New Section",
        },
        action: "create",
        description: `Created new section: ${newSection.code} (${newSection.name})`,
        organizationId: new mongoose.Types.ObjectId(user.organizationId),
        entityType: "section",
        createdAt: new Date(),
      });
    }

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(user.id),
      type: "CREATE",
      severity: "INFO",
      entity: {
        type: "SECTION",
        id: newSection._id,
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
      description: `Created new section ${newSection.code} (${newSection.name})`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function updateSection(req: CustomRequest, res: Response) {
  try {
    if (!req.user) throw new Error("User not found");

    const validatedData = SectionZodSchema.partial()
      .extend({
        _id: z.string().min(1).optional(),
        code: z.string().min(5).optional(),
      })
      .refine((data) => data._id || data.code, "Either section ID or code is required")
      .parse(req.body);

    const fieldsToSelect = Object.keys(req.body).filter((key) => key !== "_id");

    const sectionId = validatedData._id;
    if (!sectionId) {
      throw new Error("Section ID is required");
    }
    const currentSection = await sectionService.getSection(sectionId, {
      query: { organizationId: req.user.organizationId },
      select: fieldsToSelect,
    });

    const updatedSection = await sectionService.updateSection(validatedData);

    if (!updatedSection) {
      throw new Error("Failed to update section");
    }
    if (updatedSection && updatedSection.instructor && req.user && req.user.id) {
      const instructorChanged =
        validatedData.instructor &&
        currentSection?.instructor?.toString() !== validatedData.instructor.toString();
      if (instructorChanged) {
        await notificationService.sendNotification({
          query: { _id: new mongoose.Types.ObjectId(updatedSection.instructor.toString()) },
          sectionId: updatedSection._id.toString(),
          notification: {
            category: "SECTION",
            source: new mongoose.Types.ObjectId(req.user.id),
            recipients: {
              read: [],
              unread: [
                {
                  user: new mongoose.Types.ObjectId(updatedSection.instructor),
                  date: null,
                },
              ],
            },
            metadata: (_params: any) => ({
              path: `/instructor/sections/${updatedSection.code}`,
              section: {
                name: updatedSection.name || "Unnamed Section",
                code: updatedSection.code || "No Code",
              },
            }),
          },
          template: {
            title: () =>
              `You have been assigned to a new section: ${updatedSection.name || "Unnamed Section"}`,
            description: () => {
              const sectionName = updatedSection.name || "Unnamed Section";
              const sectionCode = updatedSection.code || "No Code";
              return `You are now the instructor for section "${sectionName}" (code: ${sectionCode})`;
            },
          },
          type: "instructor",
        });
      } else if (updatedSection.instructor) {
        await notificationService.sendNotification({
          query: { _id: new mongoose.Types.ObjectId(updatedSection.instructor.toString()) },
          sectionId: updatedSection._id.toString(),
          notification: {
            category: "SECTION",
            source: new mongoose.Types.ObjectId(req.user.id),
            recipients: {
              read: [],
              unread: [
                {
                  user: new mongoose.Types.ObjectId(updatedSection.instructor),
                  date: null,
                },
              ],
            },
            metadata: (_params: any) => ({
              path: `/instructor/sections/${updatedSection.code}`,
              section: {
                name: updatedSection.name || "Unnamed Section",
                code: updatedSection.code || "No Code",
              },
            }),
          },
          template: {
            title: () => `Section "${updatedSection.name || "Unnamed Section"}" has been updated`,
            description: () => {
              const sectionName = updatedSection.name || "Unnamed Section";
              const sectionCode = updatedSection.code || "No Code";
              return `Details for section "${sectionName}" (code: ${sectionCode}) have been updated. Please review the section for the latest information.`;
            },
          },
          type: "instructor",
        });
      }

      if (updatedSection.students?.length) {
        await notificationService.sendNotification({
          query: {
            _id: {
              $in: updatedSection.students.map(
                (student: any) => new mongoose.Types.ObjectId(student)
              ),
            },
          },
          sectionId: updatedSection._id.toString(),
          notification: {
            category: "SECTION",
            source: new mongoose.Types.ObjectId(req.user.id),
            recipients: {
              read: [],
              unread: updatedSection.students.map((student) => ({
                user: new mongoose.Types.ObjectId(student),
                date: null,
              })),
            },
            metadata: (_params: any) => ({
              path: `/student/sections/${updatedSection.code}`,
              section: {
                name: updatedSection.name || "Unnamed Section",
                code: updatedSection.code || "No Code",
              },
            }),
          },
          template: instructorChanged
            ? {
                title: () =>
                  `The status of ${updatedSection.name || "Unnamed Section"} has been changed`,
                description: () => {
                  const sectionName = updatedSection.name || "Unnamed Section";
                  const sectionCode = updatedSection.code || "No Code";
                  let instructorInfo = "a new instructor";
                  if (validatedData.instructor) {
                    instructorInfo = `instructor ID ${validatedData.instructor}`;
                  }

                  return `The instructor for section "${sectionName}" (code: ${sectionCode}) has been changed to ${instructorInfo}. Please note this important update.`;
                },
              }
            : {
                title: () =>
                  `Section "${updatedSection.name || "Unnamed Section"}" has been updated`,
                description: () => {
                  const sectionName = updatedSection.name || "Unnamed Section";
                  const sectionCode = updatedSection.code || "No Code";

                  return (
                    `Details for section "${sectionName}" (code: ${sectionCode}) have been updated.` +
                    "Please review the section for the latest information."
                  );
                },
              },
          type: "student",
        });
      }
    }

    if (req.user) {
      const updatedFields = fieldsToSelect.join(", ");

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
          title: "Section Management - Update Section",
        },
        action: "update",
        description: `Updated section ${updatedSection.code} with fields: ${updatedFields}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "section",
        createdAt: new Date(),
      });
    }

    res.status(200).send({ message: config.SUCCESS.SECTION.UPDATE, data: updatedSection });

    const before: Record<string, any> = {};
    const after: Record<string, any> = {};

    fieldsToSelect.forEach((field) => {
      if ((currentSection as any)?.[field] !== (updatedSection as any)?.[field]) {
        before[field] = (currentSection as any)?.[field];
        after[field] = (updatedSection as any)?.[field];
      }
    });

    const changes = Object.keys(after).map((field) => {
      const oldValue = before[field] || "not set";
      const newValue = after[field] || "not set";
      return `${field}: ${oldValue} → ${newValue}`;
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(req.user.id),
      type: "UPDATE",
      severity: "INFO",
      entity: {
        type: "SECTION",
        id: updatedSection._id,
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
      description:
        changes.length > 0
          ? `Updated section ${updatedSection.code} - Changed: ${changes.join(", ")}`
          : `Updated section ${updatedSection.code} - No fields changed`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function deleteSection(req: CustomRequest, res: Response) {
  try {
    if (!req.user) throw new Error("User not found");

    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    const currentSection = await sectionService.getSection(id, {
      query: { organizationId: req.user.organizationId },
      select: ["sectionCode", "name"],
    });

    if (!currentSection) {
      throw new Error("Section not found");
    }

    await sectionService.deleteSection(id);

    res.status(200).send({ message: config.SUCCESS.SECTION.DELETE });
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
          title: "Section Management - Delete Section",
        },
        action: "remove",
        description: `Deleted section: ${currentSection.code} (${currentSection.name})`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "section",
        createdAt: new Date(),
      });
    }

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(req.user.id),
      type: "DELETE",
      severity: "INFO",
      entity: {
        type: "SECTION",
        id: new mongoose.Types.ObjectId(id),
      },
      changes: {
        before: currentSection,
        after: {},
      },
      metadata: {
        userAgent: req.get("user-agent"),
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      description: `Deleted section ${currentSection.code} (${currentSection.name})`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });
  } catch (error) {
    console.error("Error in deleteSection:", error);
    handleZodError(error, res);
  }
}

export async function searchSection(req: Request, res: Response) {
  try {
    const requestBody = { ...req.body };
    if ((req as any).user && (req as any).user.id) {
      requestBody.currentUserId = (req as any).user.id;
    }

    const searchResult = await sectionService.searchSection(requestBody);

    res.status(200).send(searchResult);
    if ((req as any).user) {
      const selectFields = Array.isArray(req.body.select) ? req.body.select.join(" ") : "";
      const fieldsPart = selectFields ? ` with fields: ${selectFields}` : "";
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
          title: "Section Management - Search Sections",
        },
        action: "read",
        description: `Searched sections${fieldsPart} (found ${Array.isArray(searchResult) ? searchResult.length : 0} results)`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "section",
        createdAt: new Date(),
      });
    }
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function markAttendance(req: CustomRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { sectionId, remarks } = z
      .object({
        sectionId: z.string().min(1, "Section ID is required"),
        remarks: z.string().optional(),
      })
      .parse(req.body);

    const result = await sectionService.markAttendance(sectionId, req.user, remarks);

    res.status(200).json({ message: "Attendance marked successfully", data: result });
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
          title: "Section Management - Mark Attendance",
        },
        action: "create",
        description: `Marked attendance for section ${sectionId}${
          remarks ? ` with remarks: ${remarks}` : ""
        }`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "section",
        createdAt: new Date(),
      });
    }
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getSectionAttendance(req: CustomRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const validationSchema = z.object({
      sectionCode: z.string().min(1, "Section code is required"),
      from: z.string().optional(),
      to: z.string().optional(),
    });
    const { sectionCode } = validationSchema.partial().parse(req.params);

    const fromDate = req.query.from as string | undefined;
    const toDate = req.query.to as string | undefined;

    if (!sectionCode) {
      return res.status(400).json({ message: "Section code is required" });
    }

    if (fromDate) {
      const date = new Date(fromDate);
      if (isNaN(date.getTime())) {
        return res.status(400).json({
          message: "Invalid 'from' date format. Please use YYYY-MM-DD format.",
        });
      }
    }

    if (toDate) {
      const date = new Date(toDate);
      if (isNaN(date.getTime())) {
        return res.status(400).json({
          message: "Invalid 'to' date format. Please use YYYY-MM-DD format.",
        });
      }
    }

    const result = await sectionService.getSectionAttendance(
      sectionCode,
      fromDate,
      toDate,
      req.user
    );
    res.status(200).json({
      message: "Section attendance retrieved successfully",
      data: result.data,
      totalEnrolled: result.totalEnrolled,
    });

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
          title: "Section Management - View Attendance Records",
        },
        action: "read",
        description: `Retrieved attendance for section ${sectionCode}${
          fromDate ? ` from ${fromDate}` : ""
        }${toDate ? ` to ${toDate}` : ""}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "section",
        createdAt: new Date(),
      });
    }
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function bulkAddStudents(req: CustomRequest, res: Response) {
  try {
    const sectionCode = req.params.sectionCode;
    const errors = [];
    if (!sectionCode) errors.push("Section code is required");
    if (!req.user?.organizationId) errors.push("Unauthorized - Missing user or organization");
    if (!req.file) errors.push("No file uploaded");
    if (req.file && !req.file.mimetype.includes("csv")) errors.push("Only CSV files are allowed");

    if (errors.length > 0) {
      return res.status(errors.includes("Unauthorized") ? 401 : 400).json({
        message: errors.join(". "),
      });
    }

    const stream = Readable.from(req.file!.buffer.toString("utf-8"));
    const emails: string[] = [];
    const parser = stream.pipe(parse({ columns: true, trim: true }));

    for await (const record of parser) {
      if (record["Email"]) {
        emails.push(record["Email"].trim());
      }
    }

    if (emails.length === 0) {
      return res.status(400).json({ message: "No valid email addresses found in CSV" });
    }

    const users = await userService.searchUser({
      match: {
        email: { $in: emails },
        organizationId: req.user?.organizationId,
      },
      sort: "-createdAt",
      select: "email studentId firstName lastName",
      skip: 0,
      limit: emails.length,
      lean: true,
    });

    if (!users || users.length === 0) {
      return res.status(404).json({ message: "No matching students found" });
    }

    const userIdMap = new Map();
    users.forEach((user: any) => {
      userIdMap.set(user.email, user._id.toString());
    });

    const notFoundEmails = emails.filter((email) => !userIdMap.has(email));

    const userIds = emails
      .filter((email) => userIdMap.has(email))
      .map((email) => userIdMap.get(email));

    const result = await sectionService.bulkAddStudents(sectionCode, userIds);

    if (!result || !result.section) {
      return res.status(500).json({ message: "Failed to add students to section" });
    }

    const notFoundErrors = notFoundEmails.map((email) => {
      const originalIndex = emails.findIndex((e) => e === email);
      return {
        id: email,
        message: "Email not found in the system",
        row: originalIndex + 1,
      };
    });

    const allErrors = [...result.results.errors, ...notFoundErrors];
    const errorList = allErrors.map((err) => ({
      errorMessage: err.message,
      errorCode: err.message.includes("already exists") ? 11000 : 404,
      row: err.row,
    }));

    const response = {
      message: `Successfully added ${result.results.success.length} students (${errorList.length} failed)`,
      result: {
        successCount: result.results.success.length,
        successList: result.results.success,
        errorCount: errorList.length,
        errorList,
      },
    };

    res.status(200).json(response);
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
          title: "Section Management - Bulk Add Students",
        },
        action: "create",
        description: `Bulk added students to section ${sectionCode}. Successfully added ${response.result.successCount} students, ${response.result.errorCount} errors`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "section",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId(req.user.id),
        type: "UPDATE",
        severity: "INFO",
        entity: {
          type: "SECTION",
          id: result.section._id,
        },
        changes: {
          before: {
            studentCount: result.section.students.length - userIds.length,
          },
          after: {
            newStudentCount: result.section.students.length,
          },
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Bulk added ${response.result.successCount} students to section ${sectionCode}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      });
    }
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function archiveSection(req: CustomRequest, res: Response) {
  try {
    const { id } = ValidationSchemas.idParam.parse({ id: req.params.id });

    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ message: "User not authenticated or missing organization" });
    }

    const archivedSection = await sectionService.archiveSection(id);

    if (!archivedSection) {
      return res.status(404).json({ message: "section not found" });
    }
    res.status(200).json({
      message: config.SUCCESS.SECTION.ARCHIVE,
      data: archivedSection,
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
        title: "Section Management - Archive Section",
      },
      action: "archive",
      description: `Archived section with ID: ${id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      entityType: "section",
      createdAt: new Date(),
    });

    await auditLogService.createAuditLog({
      user: new mongoose.Types.ObjectId(req.user.id),
      type: "UPDATE",
      severity: "INFO",
      entity: {
        type: "SECTION",
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
      description: `Archived section with ID ${id}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getSectionAssessment(req: CustomRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const validationSchema = z.object({
      sectionCode: z.string().min(1, "Section code is required"),
    });

    const { sectionCode } = validationSchema.parse(req.params);

    if (!sectionCode) {
      return res.status(400).json({ message: "Section code is required" });
    }

    const params: any = {
      skip: req.query.skip ? parseInt(req.query.skip as string) : 0,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      sort: req.query.sort as string,
      count: req.query.count === "true",
      pagination: req.query.pagination === "true",
      document: req.query.document === "true",
      pendingAssessment: req.query.pendingAssessment === "true",
      assessmentId: req.query.assessmentId === "true",
    };

    const result = await sectionService.getSectionAssessment(sectionCode, req.user, params);
    res.status(200).json({
      message: "Section assessments retrieved successfully",
      data: result,
    });
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
          title: "Section Management - View Assessments",
        },
        action: "read",
        description: `Retrieved pending assessments for section ${sectionCode}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "section",
        createdAt: new Date(),
      });
    }
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getStudentGrades(req: CustomRequest, res: Response) {
  try {
    const { sectionCode } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "User not authenticated",
        status: "error",
      });
    }

    const result = await sectionService.getStudentGrades(sectionCode, userId);

    return res.status(200).json(result);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getSectionStudentGradesAnalytics(req: CustomRequest, res: Response) {
  try {
    const { sectionCode } = req.params;
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        message: "User not authenticated",
        status: "error",
      });
    }

    const result = await sectionService.getSectionStudentGradesAnalytics(sectionCode, user);

    return res.status(200).json({
      message: "Section grade analytics retrieved successfully",
      status: "success",
      data: result,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function exportSection(req: CustomRequest, res: Response) {
  try {
    const requestBody = { ...req.body };
    if (req.user && req.user.id) {
      requestBody.currentUserId = req.user.id;
    }
    let filename = "sections";
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
    const csv = await sectionService.exportSection(requestBody, organizationId);
    sendCSVResponse(res, csv, filename);
  } catch (error) {
    console.error("Error exporting section data:", error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "An unexpected error occurred",
      status: "error",
      details: error instanceof Error ? error.stack : String(error),
    });
  }
}

export async function removeStudentFromSection(req: CustomRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const validationSchema = z.object({
      sectionCode: z.string().min(1, "Section code is required"),
      studentId: z.string().min(1, "Student ID is required"),
    });

    const { sectionCode, studentId } = validationSchema.parse(req.params);

    const result = await sectionService.removeStudentFromSection(sectionCode, studentId, req.user);
    res.status(200).json({
      message: config.SUCCESS.SECTION.REMOVE_STUDENT,
      data: result,
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
          title: "Section Management - Remove Student",
        },
        action: "remove",
        description: `Removed student (${studentId}) from section (${sectionCode})`,
        organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
        entityType: "section",
        createdAt: new Date(),
      });
    }
    if (req.user) {
      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId(req.user.id),
        type: "UPDATE",
        severity: "INFO",
        entity: {
          type: "SECTION",
          id: result._id,
        },
        changes: {
          before: { totalStudent: result.totalStudent + 1 },
          after: { totalStudent: result.totalStudent },
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Removed student (${studentId}) from section (${sectionCode})`,
        organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
      });
    }
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function generateSectionCode(req: CustomRequest, res: Response) {
  try {
    const name = req.body.name;
    const code = req.body.code;
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        message: "User not authenticated or missing organization",
        status: "error",
      });
    }
    const generatedCode = await sectionService.generateCode(name, code, organizationId);

    res.status(200).send({ message: config.SUCCESS.SECTION.GENERATE_CODE, code: generatedCode });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function updateAttendanceStatus(req: CustomRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const validationSchema = z.object({
      sectionCode: z.string().min(1, "Section code is required"),
      userId: z.string().min(1, "User ID is required"),
      status: z.enum(config.ENUM.ATTENDANCE.STATUS, {
        errorMap: () => ({ message: "Invalid attendance status" }),
      }),
      date: z.string().transform((val) => new Date(val)),
      remarks: z.string().optional(),
    });

    const { sectionCode, userId, status, date, remarks } = validationSchema.parse(req.body);

    const result = await sectionService.updateAttendanceStatus(
      sectionCode,
      userId,
      status,
      date,
      remarks,
      req.user
    );
    res.status(200).json({
      message: "Attendance status updated successfully",
      data: result,
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
          title: "Section Management - Update Attendance Status",
        },
        action: "update",
        description: result.previousStatus
          ? `Updated attendance status for user ${userId} to ${status}${remarks ? ` with remarks: ${remarks}` : ""}`
          : `Created new attendance record for user ${userId} with status ${status}${remarks ? ` and remarks: ${remarks}` : ""}`,
        organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
        entityType: "section",
        createdAt: new Date(),
      });
    }

    if (req.user) {
      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId(req.user.id),
        type: "UPDATE",
        severity: "INFO",
        entity: {
          type: "ATTENDANCE",
          id: new mongoose.Types.ObjectId(userId),
        },
        changes: {
          before: { status: result.previousStatus || "none" },
          after: { status, date: date.toISOString(), remarks },
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: result.previousStatus
          ? `Updated attendance status from ${result.previousStatus} to ${status}`
          : `Created new attendance record with status ${status}`,
        organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
      });
    }
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getSectionAnnouncement(req: CustomRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { sectionCode } = req.params;

    if (!sectionCode) {
      return res.status(400).json({ message: "Section code is required" });
    }

    const userType = (req.query.type as string) || "";

    const params = ValidationSchemas.getQueriesParams.parse({
      select: Array.isArray(req.query.select)
        ? req.query.select
        : [req.query.select].filter(Boolean),
      lean: req.query.lean,
      count: req.query.count === "true",
      document: req.query.document === "true",
    });
    const newAnnouncementsCount = req.query.newAnnouncementsCount === "true";

    const {
      count,
      todayAnnouncementsCount,
      currentAnnouncement,
      futureAnnouncement,
      pastAnnouncement,
    } = await sectionService.getSectionAnnouncements(
      sectionCode,
      params,
      req.user,
      newAnnouncementsCount,
      userType
    );

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
          title: "Section Management - View Announcements",
        },
        action: "read",
        description: `Retrieved announcements for section ${sectionCode}`,
        organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
        entityType: "section",
        createdAt: new Date(),
      });
    }
    const responseData = {
      message: "Section announcements retrieved successfully",
      currentAnnouncement: currentAnnouncement,
      ...(userType?.toLowerCase() === "student" ? {} : { futureAnnouncement: futureAnnouncement }),
      pastAnnouncement: pastAnnouncement,
      count,
      ...(newAnnouncementsCount && { todayAnnouncementsCount }),
    };

    res.status(200).json(responseData);
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getSectionModules(req: CustomRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const validationSchema = z.object({
      sectionCode: z.string().min(1, "Section code is required"),
    });

    const { sectionCode } = validationSchema.parse(req.params);

    const skip = parseInt(req.query.skip as string) || 0;
    const limit = parseInt(req.query.limit as string) || 10;
    const sort = (req.query.sort as string) || "-createdAt";
    const result = await sectionService.getSectionModules(sectionCode, skip, limit, sort, req.user);

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
          title: "Section Management - View Modules",
        },
        action: "read",
        description: `Retrieved modules for section ${sectionCode}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "section",
        createdAt: new Date(),
      });
    }

    res.status(200).json({
      message: "Section modules retrieved successfully",
      ...result,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getSectionGradeSystem(req: CustomRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const validationSchema = z.object({
      sectionCode: z.string().min(1, "Section code is required"),
    });

    const { sectionCode } = validationSchema.parse(req.params);
    const result = await sectionService.getSectionGradeSystem(sectionCode);

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
          title: "Section Management - View Grade System",
        },
        action: "read",
        description: `Retrieved modules for section ${sectionCode}`,
        organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
        entityType: "section",
        createdAt: new Date(),
      });
    }

    res.status(200).json({
      message: "Section modules retrieved successfully",
      data: result,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getSectionStudents(req: CustomRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const validationSchema = z.object({
      sectionCode: z.string().min(1, "Section code is required"),
    });

    const { sectionCode } = validationSchema.parse(req.params);

    const skip = parseInt(req.query.skip as string) || 0;
    const limit = parseInt(req.query.limit as string) || 10;
    const sort = (req.query.sort as string) || "lastName";
    const count = req.query.count === "true";
    const pagination = req.query.pagination === "true";
    const document = req.query.document === "true";

    const result = await sectionService.getSectionStudents(
      sectionCode,
      skip,
      limit,
      sort,
      req.user,
      count,
      pagination,
      document
    );

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
          title: "Section Management - View Students",
        },
        action: "read",
        description: `Retrieved students for section ${sectionCode}`,
        organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
        entityType: "section",
        createdAt: new Date(),
      });
    }

    res.status(200).json({
      message: "Section students retrieved successfully",
      data: result,
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function exportSectionStudents(req: CustomRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { sectionCode } = req.params;
    const skip = parseInt(req.query.skip as string) || 0;
    const limit = parseInt(req.query.limit as string) || 0;
    const sort = (req.query.sort as string) || "lastName";

    const csvData = await sectionService.exportSectionStudents(
      sectionCode,
      req.user,
      skip,
      limit,
      sort
    );

    sendCSVResponse(res, csvData, `section-${sectionCode}-students`);

    if (req.user) {
      await activityLogService.createActivityLog({
        userId: new mongoose.Types.ObjectId(req.user.id),
        headers: {
          "user-agent": req.get("user-agent") || "",
        },
        ip: req.ip || "0.0.0.0",
        path: req.path,
        method: req.method,
        page: {
          url: req.originalUrl,
          title: "Section Management - Export Students",
        },
        action: "export",
        description: `Exported students list for section ${sectionCode}${limit > 0 ? ` (limited to ${limit} students)` : ""}`,
        organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
        entityType: "section",
        createdAt: new Date(),
      });
    }
  } catch (error: any) {
    handleZodError(error, res);
  }
}

async function exportSectionStudentGrades(req: CustomRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { sectionCode } = req.params;
    const csvContent = await sectionService.exportSectionStudentGrades(sectionCode, req.user);

    sendCSVResponse(res, csvContent, `section-${sectionCode}-grades`);

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
        title: "Section Management - Export Grades",
      },
      action: "export",
      description: `Exported grades for section ${sectionCode}`,
      organizationId: new mongoose.Types.ObjectId((req as any).user.organizationId || null),
      entityType: "section",
      createdAt: new Date(),
    });
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function addStudentsToSectionByCode(req: CustomRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { sectionCode } = req.params;
    const { studentIds } = z
      .object({
        studentIds: z
          .array(
            z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
              message: "Invalid ObjectId in studentIds array",
            })
          )
          .min(1, "studentIds array cannot be empty"),
      })
      .parse(req.body);

    const currentSection = await sectionService.getSectionByCode(sectionCode, {
      organizationId: req.user.organizationId,
    });
    if (!currentSection) {
      return res.status(404).json({ message: "Section not found" });
    }

    const updatedSection = await sectionService.addStudentsToSectionByCode(
      sectionCode,
      studentIds.map((id) => new mongoose.Types.ObjectId(id)),
      req.user
    );

    res.status(200).json({
      message: "Students added to section successfully",
      data: updatedSection,
    });

    if (req.user) {
      const studentIdsString = studentIds.join(", ");
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
          title: "Section Management - Add Students",
        },
        action: "update",
        description: `Added students (${studentIdsString}) to section (${sectionCode})`,
        organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
        entityType: "section",
        createdAt: new Date(),
      });

      await auditLogService.createAuditLog({
        user: new mongoose.Types.ObjectId(req.user.id),
        type: "UPDATE",
        severity: "INFO",
        entity: {
          type: "SECTION",
          id: updatedSection?._id,
        },
        changes: {
          before: { students: currentSection.students },
          after: { students: updatedSection?.students },
        },
        metadata: {
          userAgent: req.get("user-agent"),
          ip: req.ip,
          path: req.path,
          method: req.method,
        },
        description: `Added students (${studentIdsString}) to section (${sectionCode})`,
        organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
      });
    }
  } catch (error) {
    handleZodError(error, res);
  }
}

export async function getSectionSchedule(req: CustomRequest, res: Response) {
  try {
    const { id: userId } = req.user as any;
    const { type = "week", startDate, endDate } = req.query;

    // Validate date parameters if provided
    if (startDate && typeof startDate === "string") {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        return res.status(400).json({
          message: "Invalid startDate format. Please use YYYY-MM-DD format.",
        });
      }
    }

    if (endDate && typeof endDate === "string") {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return res.status(400).json({
          message: "Invalid endDate format. Please use YYYY-MM-DD format.",
        });
      }
    }

    // Validate that if one date is provided, both should be provided
    if ((startDate && !endDate) || (!startDate && endDate)) {
      return res.status(400).json({
        message: "Both startDate and endDate must be provided together.",
      });
    }

    const data = await sectionService.getSectionSchedule(
      userId,
      type as string,
      startDate as string,
      endDate as string
    );

    res.status(200).json({
      message: "Schedule data retrieved successfully",
      data: data,
    });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : "Server error" });
  }
}

export default router;
