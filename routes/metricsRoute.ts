import express, { Request, Response } from "express";
import { API_ENDPOINTS } from "../config/endpointsConfig";
import unifiedAuthMiddleware from "../middleware/authMiddleware";
import metricsService from "../services/metricsService";
import { FACET } from "../config/facetConfig";
import { z } from "zod";
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Metrics
 *   description: Metrics and analytics endpoints
 */

/**
 * @swagger
 * /api/metrics/search:
 *   post:
 *     summary: Search metrics data for a specific model
 *     description: Retrieves metrics data for a specified model with optional filtering
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - model
 *               - data
 *             properties:
 *               model:
 *                 type: string
 *                 description: The model to search metrics for (e.g., Student, Organization)
 *                 example: Student
 *               data:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of data facets to retrieve
 *                 example: ["assignmentData", "continueWorking", "comingUp", "announcements", "courses"]
 *               filter:
 *                 type: object
 *                 description: Optional filter criteria
 *                 example:
 *                   studentId: "64a12e4f6ac0c0aafc0a3216"
 *                   organizationId: "64a12e4f6ac0c0aafc0a3215"
 *     responses:
 *       200:
 *         description: Metrics data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   description: The requested metrics data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Failed to retrieve metrics data
 */
router.post(API_ENDPOINTS.METRICS.SEARCH, unifiedAuthMiddleware, searchMetrics);

router.post(
  API_ENDPOINTS.METRICS.GET_ORGANIZATION_DASHBOARD,
  unifiedAuthMiddleware,
  getOrganizationDashboard
);

router.post(
  API_ENDPOINTS.METRICS.GET_PERFORMANCE_DASHBOARD,
  unifiedAuthMiddleware,
  getPerformanceDashboard
);

router.get(
  API_ENDPOINTS.METRICS.GET_STUDENT_PERFORMANCE_DETAILS,
  unifiedAuthMiddleware,
  getStudentPerformanceDetails
);

router.post(
  API_ENDPOINTS.METRICS.CREATE_PERFORMANCE_ACTION_PLAN,
  unifiedAuthMiddleware,
  createPerformanceActionPlan
);

/*
 * Example for calling Student dashboard facet:
 * POST /api/metrics/search
 * Body:
 * {
 *   "model": "Student",
 *   "data": ["assignmentData", "continueWorking", "comingUp", "announcements", "courses"],
 *   "filter": {
 *     "studentId": "64a12e4f6ac0c0aafc0a3216",
 *     "organizationId": "64a12e4f6ac0c0aafc0a3215"
 *   }
 * }
 */

async function searchMetrics(req: Request, res: Response) {
  try {
    const model = req.body.model as keyof ReturnType<typeof FACET>;
    const data = req.body.data as (keyof ReturnType<typeof FACET>[keyof ReturnType<
      typeof FACET
    >])[];
    const results = await metricsService.searchMetrics(model, data, req.body.filter);

    res.status(200).json(results);
  } catch (error) {
    console.error("Error in metrics search:", error);
    res.status(500).json({ error: "Failed to retrieve metrics data" });
  }
}

async function getOrganizationDashboard(req: Request, res: Response) {
  try {
    const data = req.body;

    const organizationId = (req as any).user.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: "Organization ID not found" });
    }

    const [organizationMetrics, courseMetrics, userMetrics, sectionMetrics] = await Promise.all([
      metricsService.searchMetrics("Organization", ["instructorsToAssign", "coursesToAssign"], {
        adminId: (req as any).user.userId,
        organizationId,
      }),
      metricsService.searchMetrics("Course", ["totalCourseCount", "courseCountPerCategory"], {
        organizationId,
      }),
      metricsService.searchMetrics(
        "USER",
        [
          "totalInstructorCount",
          "totalStudentCount",
          "instructorCountPerFaculty",
          "studentCountPerProgram",
        ],
        {
          organizationId,
        }
      ),
      metricsService.searchMetrics("Section", ["totalSectionCount"], { organizationId }),
    ]);

    res.status(200).json({
      filter: data?.filter,
      organizationMetrics: organizationMetrics,
      courseMetrics: courseMetrics[0],
      userMetrics: userMetrics[0],
      sectionMetrics: sectionMetrics[0],
    });
  } catch (error) {
    console.error("Error in getOrganizationDashboard:", error);
    res.status(500).json({ error: "Failed to retrieve organization dashboard data" });
  }
}

async function getPerformanceDashboard(req: Request, res: Response) {
  try {
    const user = (req as any).user as
      | {
          id: string;
          role: string;
          organizationId: string;
        }
      | undefined;

    if (!user || !user.organizationId) {
      return res.status(401).json({ error: "Organization ID not found" });
    }

    const normalizedRole = user.role.toLowerCase();
    if (normalizedRole !== "admin" && normalizedRole !== "instructor") {
      return res
        .status(403)
        .json({ error: "Only admins and instructors can view performance dashboard data" });
    }

    const sectionCodeValue = (req.body?.filter as { sectionCode?: string } | undefined)
      ?.sectionCode;
    const sectionCode =
      typeof sectionCodeValue === "string" && sectionCodeValue.trim().length > 0
        ? sectionCodeValue.trim()
        : undefined;

    const result = await metricsService.getPerformanceDashboard({
      organizationId: user.organizationId,
      userId: user.id,
      role: normalizedRole,
      sectionCode,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in getPerformanceDashboard:", error);
    return res.status(500).json({ error: "Failed to retrieve performance dashboard data" });
  }
}

async function getStudentPerformanceDetails(req: Request, res: Response) {
  try {
    const user = (req as any).user as
      | { id: string; role: string; organizationId: string }
      | undefined;

    if (!user || !user.organizationId) {
      return res.status(401).json({ error: "Organization ID not found" });
    }

    const normalizedRole = user.role.toLowerCase();
    if (normalizedRole !== "admin" && normalizedRole !== "instructor") {
      return res
        .status(403)
        .json({ error: "Only admins and instructors can view student performance details" });
    }

    const { studentId } = req.params;
    if (!studentId) {
      return res.status(400).json({ error: "Student ID is required" });
    }

    const result = await metricsService.getStudentPerformanceDetails({
      organizationId: user.organizationId,
      studentId,
      requestingUserId: user.id,
      role: normalizedRole,
    });

    if (!result) {
      return res.status(404).json({ error: "Student not found" });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in getStudentPerformanceDetails:", error);
    return res.status(500).json({ error: "Failed to retrieve student performance details" });
  }
}

const createPerformanceActionPlanSchema = z.object({
  studentId: z.string().trim().min(1),
  sectionCode: z.string().trim().optional(),
  title: z.string().trim().min(1).optional(),
  summary: z.string().trim().optional(),
  riskLevel: z.enum(["Critical", "Moderate", "Low"]).optional(),
});

async function createPerformanceActionPlan(req: Request, res: Response) {
  try {
    const user = (req as any).user as
      | {
          id: string;
          role: string;
          organizationId: string;
        }
      | undefined;

    if (!user || !user.organizationId) {
      return res.status(401).json({ error: "Organization ID not found" });
    }

    const normalizedRole = user.role.toLowerCase();
    if (normalizedRole !== "admin" && normalizedRole !== "instructor") {
      return res
        .status(403)
        .json({ error: "Only admins and instructors can create performance action plans" });
    }

    const body = createPerformanceActionPlanSchema.parse(req.body ?? {});
    const result = await metricsService.createPerformanceActionPlan({
      organizationId: user.organizationId,
      studentId: body.studentId,
      createdBy: user.id,
      createdByRole: normalizedRole,
      sectionCode: body.sectionCode,
      title: body.title,
      summary: body.summary,
      riskLevel: body.riskLevel,
    });

    return res.status(200).json({
      message: "Performance action plan created successfully",
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request payload",
        details: error.issues,
      });
    }

    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }

    console.error("Error in createPerformanceActionPlan:", error);
    return res.status(500).json({ error: "Failed to create performance action plan" });
  }
}

export default router;
