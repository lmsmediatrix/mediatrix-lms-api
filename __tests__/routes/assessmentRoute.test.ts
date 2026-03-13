import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { Response } from "express";
import { CustomRequest } from "../../type/types";

jest.mock("mongoose", () => {
  return {
    connection: {
      readyState: 1,
      once: jest.fn(),
    },
    Types: {
      ObjectId: jest.fn().mockImplementation((id) => id || "mockedObjectId"),
    },
  };
});

jest.mock("../../middleware/zodErrorHandler", () => {
  return {
    handleZodError: jest.fn((_error, res: any) => {
      res.status(400).json({ error: "Test error" });
    }),
  };
});

jest.mock("../../utils/logger", () => {
  return {
    default: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
    uploadLogs: jest.fn(),
  };
});

jest.mock("../../middleware/rabcMiddleware", () => {
  return {
    validatePermissions: jest.fn().mockImplementation((...args: any[]) => {
      const _roles = args[0] as string[];

      return (req: any, res: any, next: any) => {
        if (!req.user) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        if (!req.user.role || !_roles.includes(req.user.role)) {
          return res.status(403).json({ message: "Not authorized" });
        }

        next();
      };
    }),
  };
});

jest.mock("../../helper/formDataHelper", () => ({
  processAssessmentFormData: jest.fn(),
  processCsvQuestions: jest.fn(),
}));

import * as assessmentRouteHandlers from "../../routes/assessmentRoute";
import assessmentService from "../../services/assessmentService";
import activityLogService from "../../services/activityLogService";
import auditLogService from "../../services/auditLogService";
import { IAssessment } from "../../models/assessmentModel";
import { processAssessmentFormData } from "../../helper/formDataHelper";
import { USER_ROLES, ACTION } from "../../config/common";
import { validatePermissions } from "../../middleware/rabcMiddleware";

jest.mock("../../services/assessmentService");
jest.mock("../../services/activityLogService");
jest.mock("../../services/auditLogService");

jest.mock("mongoose", () => {
  const originalModule = jest.requireActual("mongoose") as object;
  return {
    ...originalModule,
    Types: {
      ObjectId: jest.fn().mockImplementation((id) => id || "mockedObjectId"),
    },
  };
});

const mockAssessmentService = assessmentService as jest.Mocked<typeof assessmentService>;
const mockActivityLogService = activityLogService as jest.Mocked<typeof activityLogService>;
const mockAuditLogService = auditLogService as jest.Mocked<typeof auditLogService>;
const mockProcessAssessmentFormData = processAssessmentFormData as jest.MockedFunction<
  typeof processAssessmentFormData
>;

interface MockUser {
  id: string;
  email: string;
  organizationId: string;
  role: string;
  firstName?: string;
  lastName?: string;
}

const createMockRequest = (overrides: Partial<CustomRequest> = {}): CustomRequest => {
  return {
    user: {
      id: "mockUserId",
      email: "test@example.com",
      organizationId: "mockOrgId",
      role: "admin",
      firstName: "Test",
      lastName: "User",
    } as MockUser,
    params: {},
    query: {},
    body: {},
    path: "/api/assessment/test",
    method: "GET",
    originalUrl: "/api/assessment/test",
    ip: "127.0.0.1",
    get: jest.fn().mockReturnValue("test-user-agent"),
    files: [],
    ...overrides,
  } as unknown as CustomRequest;
};

const createMockResponse = (): Response => {
  const res = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
};

describe("Assessment Route Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockAssessmentService.createAssessment.mockImplementation((data) => {
      return Promise.resolve({
        _id: "mockAssessmentId",
        organizationId: "mockOrgId",
        section: "mockSectionId",
        title: "Mock Assessment",
        type: "quiz",
        numberOfItems: 1,
        totalPoints: 10,
        ...data,
      } as IAssessment);
    });

    mockAssessmentService.updateAssessment.mockImplementation((data) => {
      return Promise.resolve({
        _id: "mockAssessmentId",
        organizationId: "mockOrgId",
        section: "mockSectionId",
        title: "Mock Assessment",
        type: "quiz",
        numberOfItems: 1,
        totalPoints: 10,
        ...data,
      } as IAssessment);
    });

    mockActivityLogService.createActivityLog.mockResolvedValue({} as any);
    mockAuditLogService.createAuditLog.mockResolvedValue({} as any);

    mockProcessAssessmentFormData.mockReturnValue({
      processedData: {},
      error: undefined,
      details: undefined,
    });
  });

  describe("getAssessments", () => {
    test("should get all assessments successfully", async () => {
      const mockAssessments = [
        {
          _id: "assessment1",
          title: "Assessment 1",
          description: "Test assessment 1",
          type: "quiz",
          questions: [{ questionText: "Question 1", type: "multiple_choice", points: 10 }],
        } as unknown as IAssessment,
        {
          _id: "assessment2",
          title: "Assessment 2",
          description: "Test assessment 2",
          type: "exam",
          questions: [{ questionText: "Question 1", type: "multiple_choice", points: 10 }],
        } as unknown as IAssessment,
      ];

      const mockPagination = {
        totalItems: 2,
        totalPages: 1,
        currentPage: 1,
        pageSize: 10,
      };

      mockAssessmentService.getAssessments.mockResolvedValue({
        assessment: mockAssessments,
        pagination: mockPagination,
        count: 2,
      });

      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        query: {
          limit: "10",
          page: "1",
          pagination: "true",
          count: "true",
          populateArray: JSON.stringify([{ path: "section", select: "name" }]),
        },
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.getAssessments(req, res);

      expect(mockAssessmentService.getAssessments).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        assessment: mockAssessments,
        pagination: mockPagination,
        count: 2,
      });
    });

    test("should handle error when getting assessments", async () => {
      const error = new Error("Test error");
      mockAssessmentService.getAssessments.mockRejectedValue(error);

      const req = createMockRequest();
      const res = createMockResponse();

      await assessmentRouteHandlers.getAssessments(req, res);

      expect(mockAssessmentService.getAssessments).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(200);
    });
  });

  describe("getAssessment", () => {
    test("should get an assessment by ID successfully", async () => {
      const assessmentId = "mockAssessmentId";
      const mockAssessment = {
        _id: assessmentId,
        title: "Test Assessment",
        description: "This is a test assessment",
        type: "quiz",
        questions: [{ questionText: "Test question", type: "multiple_choice", points: 10 }],
      };

      mockAssessmentService.getAssessment.mockResolvedValue(
        mockAssessment as unknown as IAssessment
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: assessmentId },
        query: {
          populateArray: JSON.stringify([{ path: "section", select: "name" }]),
        },
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.getAssessment(req, res);

      expect(mockAssessmentService.getAssessment).toHaveBeenCalledWith(
        assessmentId,
        expect.any(Object)
      );
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockAssessment);
    });

    test("should handle additional params for student role", async () => {
      const assessmentId = "mockAssessmentId";
      const studentId = "mockStudentId";
      const mockAssessment = {
        _id: assessmentId,
        title: "Test Assessment",
        description: "Student view of assessment",
        type: "quiz",
        questions: [{ questionText: "Test question", type: "multiple_choice", points: 10 }],
      };

      mockAssessmentService.getAssessment.mockResolvedValue(
        mockAssessment as unknown as IAssessment
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: assessmentId },
        user: {
          id: studentId,
          email: "student@example.com",
          organizationId: "mockOrgId",
          role: USER_ROLES.STUDENT,
          firstName: "",
          lastName: "",
        },
        query: {
          populateArray: JSON.stringify([{ path: "section", select: "name" }]),
        },
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.getAssessment(req, res);

      expect(mockAssessmentService.getAssessment).toHaveBeenCalledWith(
        assessmentId,
        expect.objectContaining({
          studentId: studentId,
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
  describe("deleteAssessment", () => {
    test("should delete an assessment successfully", async () => {
      const assessmentId = "assessmentToDeleteId";
      const mockAssessment = {
        _id: assessmentId,
        title: "Assessment to Delete",
        description: "This assessment will be deleted",
      };

      mockAssessmentService.deleteAssessment.mockResolvedValue(
        mockAssessment as unknown as IAssessment
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: assessmentId },
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.deleteAssessment(req, res);

      expect(mockAssessmentService.deleteAssessment).toHaveBeenCalledWith(assessmentId);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockAssessment);
    });

    test("should handle error when deleting assessment", async () => {
      const error = new Error("Test error");
      mockAssessmentService.deleteAssessment.mockRejectedValue(error);

      const req = createMockRequest({
        params: { id: "nonExistentId" },
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.deleteAssessment(req, res);

      expect(mockAssessmentService.deleteAssessment).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(200);
    });
  });

  describe("searchAssessment", () => {
    test("should search assessments successfully", async () => {
      const searchQuery = { query: { title: "Quiz" } };
      const mockSearchResults = [
        {
          _id: "assessment1",
          title: "Quiz 1",
          description: "First quiz",
          type: "quiz",
        },
        {
          _id: "assessment2",
          title: "Quiz 2",
          description: "Second quiz",
          type: "quiz",
        },
      ];

      mockAssessmentService.searchAssessment.mockResolvedValue(
        mockSearchResults as unknown as IAssessment[]
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: searchQuery,
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.searchAssessment(req, res);

      expect(mockAssessmentService.searchAssessment).toHaveBeenCalledWith(searchQuery);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockSearchResults);
    });

    test("should handle error when searching assessments", async () => {
      const error = new Error("Test error");
      mockAssessmentService.searchAssessment.mockRejectedValue(error);

      const req = createMockRequest({
        body: { query: { title: "Quiz" } },
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.searchAssessment(req, res);

      expect(mockAssessmentService.searchAssessment).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(200);
    });
  });

  describe("submitAssessment", () => {
    test("should submit an assessment successfully", async () => {
      const assessmentId = "mockAssessmentId";
      const studentId = "mockStudentId";
      const mockSubmissionData = {
        assessmentId,
        answers: [
          { questionId: "q1", answer: "Option A" },
          { questionId: "q2", answer: "True" },
        ],
      };

      const mockSubmissionResult = {
        score: 80,
        totalPoints: 100,
        passed: true,
        feedback: "Good job!",
      };

      mockAssessmentService.submitAssessment.mockResolvedValue(mockSubmissionResult);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        user: {
          id: studentId,
          email: "student@example.com",
          organizationId: "mockOrgId",
          role: USER_ROLES.STUDENT,
          firstName: "",
          lastName: "",
        },
        body: mockSubmissionData,
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.submitAssessment(req, res);

      expect(mockAssessmentService.submitAssessment).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockSubmissionData,
          studentId,
        })
      );
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "Assessment submitted successfully",
        data: mockSubmissionResult,
      });
    });

    test("should handle attempts exceeded error", async () => {
      mockAssessmentService.submitAssessment.mockRejectedValue(new Error("No attempts remaining"));

      const req = createMockRequest({
        user: {
          id: "studentId",
          role: USER_ROLES.STUDENT,
          email: "",
          firstName: "",
          lastName: "",
          organizationId: "",
        },
        body: {
          assessmentId: "assessmentId",
          answers: [],
        },
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.submitAssessment(req, res);

      expect(mockAssessmentService.submitAssessment).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: "ATTEMPTS_EXCEEDED",
        })
      );
    });
  });

  describe("getSectionAssessmentStudents", () => {
    test("should get students for a section and assessment successfully", async () => {
      const sectionCode = "SECTION001";
      const assessmentId = "mockAssessmentId";

      const mockStudentData = {
        taken: [
          { _id: "student1", name: "Student 1", email: "student1@example.com" },
          { _id: "student2", name: "Student 2", email: "student2@example.com" },
        ],
        notTaken: [{ _id: "student3", name: "Student 3", email: "student3@example.com" }],
      };

      mockAssessmentService.getSectionAssessmentStudents.mockResolvedValue(mockStudentData);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { sectionCode, assessmentId },
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.getSectionAssessmentStudents(req, res);

      expect(mockAssessmentService.getSectionAssessmentStudents).toHaveBeenCalledWith(
        sectionCode,
        assessmentId
      );
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Students retrieved successfully",
        data: mockStudentData,
      });
    });

    test("should validate required parameters", async () => {
      const req = createMockRequest({
        params: { sectionCode: "", assessmentId: "" },
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.getSectionAssessmentStudents(req, res);

      expect(mockAssessmentService.getSectionAssessmentStudents).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Section ID and Assessment ID are required",
        })
      );
    });
  });

  describe("getStudentAssessmentResult", () => {
    test("should get a student assessment result successfully", async () => {
      const studentId = "mockStudentId";
      const assessmentNo = "1";
      const assessmentType = "quiz";
      const sectionCode = "SECTION001";

      const mockResult = {
        score: 85,
        totalPoints: 100,
        passed: true,
        answers: [
          { questionId: "q1", answer: "Option A", correct: true },
          { questionId: "q2", answer: "Option B", correct: false },
        ],
      };

      mockAssessmentService.getStudentAssessmentResult.mockResolvedValue(mockResult);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { studentId, assessmentNo },
        query: { type: assessmentType, code: sectionCode },
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.getStudentAssessmentResult(req, res);

      expect(mockAssessmentService.getStudentAssessmentResult).toHaveBeenCalledWith(
        studentId,
        assessmentNo,
        assessmentType,
        sectionCode
      );
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Student assessment result retrieved successfully",
        data: mockResult,
      });
    });

    test("should validate required parameters", async () => {
      const req = createMockRequest({
        params: { studentId: "student1", assessmentNo: "1" },
        query: { type: "" },
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.getStudentAssessmentResult(req, res);

      expect(mockAssessmentService.getStudentAssessmentResult).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("updateStudentAssessmentResult", () => {
    test("should update a student assessment result successfully", async () => {
      const studentId = "mockStudentId";
      const assessmentId = "mockAssessmentId";
      const mockUpdateData = {
        answers: [
          { questionId: "q1", pointsEarned: 8, isCorrect: true },
          { questionId: "q2", pointsEarned: 4, isCorrect: false },
        ],
      };

      const mockUpdatedResult = {
        score: 12,
        totalPoints: 20,
        passed: true,
      };

      mockAssessmentService.updateStudentAssessmentResult.mockResolvedValue(mockUpdatedResult);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { studentId, assessmentId },
        body: mockUpdateData,
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.updateStudentAssessmentResult(req, res);

      expect(mockAssessmentService.updateStudentAssessmentResult).toHaveBeenCalledWith(
        studentId,
        assessmentId,
        mockUpdateData.answers
      );
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Student assessment result updated successfully",
        data: mockUpdatedResult,
      });
    });

    test("should validate required parameters", async () => {
      const req = createMockRequest({
        params: { studentId: "student1", assessmentId: "assessment1" },
        body: { answers: [] },
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.updateStudentAssessmentResult(req, res);

      expect(mockAssessmentService.updateStudentAssessmentResult).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("archiveAssessment", () => {
    test("should archive an assessment successfully", async () => {
      const assessmentId = "assessmentToArchiveId";
      const mockAssessment = {
        _id: assessmentId,
        title: "Assessment to Archive",
        description: "This assessment will be archived",
        archive: {
          status: true,
          date: new Date(),
        },
      };

      mockAssessmentService.archiveAssessment.mockResolvedValue(
        mockAssessment as unknown as IAssessment
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: assessmentId },
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.archiveAssessment(req, res);

      expect(mockAssessmentService.archiveAssessment).toHaveBeenCalledWith(assessmentId);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Assessment archived successfully",
        data: mockAssessment,
      });
    });

    test("should return 404 when assessment to archive is not found", async () => {
      mockAssessmentService.archiveAssessment.mockResolvedValue(null);

      const req = createMockRequest({
        params: { id: "nonExistentId" },
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.archiveAssessment(req, res);

      expect(mockAssessmentService.archiveAssessment).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Assessment not found" });
    });

    test("should handle error when user is not authenticated", async () => {
      const req = createMockRequest({
        params: { id: "assessmentId" },
        user: undefined,
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.archiveAssessment(req, res);

      expect(mockAssessmentService.archiveAssessment).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test("should require appropriate role for archiving assessments", async () => {
      const middleware = validatePermissions(
        [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN, USER_ROLES.INSTRUCTOR],
        ACTION.ARCHIVE
      );

      const instructorReq = createMockRequest({
        user: {
          id: "instructorId",
          email: "instructor@example.com",
          organizationId: "orgId",
          role: USER_ROLES.INSTRUCTOR,
          firstName: "",
          lastName: "",
        },
        params: { id: "assessmentId" },
      });

      const studentReq = createMockRequest({
        user: {
          id: "studentId",
          email: "student@example.com",
          organizationId: "orgId",
          role: USER_ROLES.STUDENT,
          firstName: "",
          lastName: "",
        },
        params: { id: "assessmentId" },
      });

      const res = createMockResponse();
      const next = jest.fn();

      middleware(instructorReq, res, next);
      expect(next).toHaveBeenCalled();
      next.mockClear();

      middleware(studentReq, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe("Role-Based Access Control", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const testRoleAccess = (
      endpoint: string,
      action: string,
      allowedRoles: string[] = [
        USER_ROLES.ADMIN,
        USER_ROLES.SUPERADMIN,
        USER_ROLES.INSTRUCTOR,
        USER_ROLES.STUDENT,
        USER_ROLES.EMPLOYEE,
        USER_ROLES.USER,
        USER_ROLES.VIEW,
      ]
    ) => {
      describe(`${endpoint} endpoint permissions`, () => {
        test.each(allowedRoles)(`should allow %s role to access ${endpoint}`, (role) => {
          const mockValidatePermissions = validatePermissions as jest.MockedFunction<
            typeof validatePermissions
          >;
          mockValidatePermissions.mockClear();

          validatePermissions([role], action);

          expect(mockValidatePermissions).toHaveBeenCalledWith([role], action);
        });

        const deniedRoles = Object.values(USER_ROLES).filter(
          (role) => !allowedRoles.includes(role)
        );

        if (deniedRoles.length > 0) {
          test.each(deniedRoles)(`should deny %s role from accessing ${endpoint}`, (role) => {
            const req = createMockRequest({
              user: {
                id: "mockUserId",
                email: "test@example.com",
                organizationId: "mockOrgId",
                role,
                firstName: "",
                lastName: "",
              },
            });
            const res = createMockResponse();
            const next = jest.fn();

            const middleware = validatePermissions(allowedRoles, action);
            middleware(req, res, next);

            if (!allowedRoles.includes(role)) {
              expect(res.status).toHaveBeenCalledWith(403);
              expect(next).not.toHaveBeenCalled();
            } else {
              expect(next).toHaveBeenCalled();
            }
          });
        } else {
          test(`allows all roles to access ${endpoint}`, () => {
            const userRolesArray = Object.values(USER_ROLES);
            expect(allowedRoles.length).toEqual(userRolesArray.length);
            userRolesArray.forEach((role) => {
              expect(allowedRoles).toContain(role);
            });
          });
        }
      });
    };

    testRoleAccess("getAssessments", ACTION.GET_ALL);

    testRoleAccess("getAssessment", ACTION.GET_BY_ID);

    testRoleAccess("createAssessment", ACTION.CREATE, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
    ]);

    testRoleAccess("updateAssessment", ACTION.UPDATE, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
    ]);

    testRoleAccess("deleteAssessment", ACTION.DELETE, [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]);

    testRoleAccess("searchAssessment", ACTION.SEARCH);

    testRoleAccess("submitAssessment", ACTION.CUSTOM, [USER_ROLES.STUDENT]);

    testRoleAccess("updateStudentAssessmentResult", ACTION.CUSTOM, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
    ]);

    testRoleAccess("archiveAssessment", ACTION.ARCHIVE, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
    ]);
  });
});

describe("Assessment Zod Validation", () => {
  describe("createAssessment validation", () => {
    test("should validate required fields", async () => {
      const invalidData = {
        type: "quiz",
      };

      mockProcessAssessmentFormData.mockReturnValue({
        processedData: invalidData,
        error: undefined,
        details: undefined,
      });

      mockAssessmentService.createAssessment.mockImplementation(() => {
        const error = new Error("Validation error");
        error.name = "ZodError";
        throw error;
      });

      const req = createMockRequest({
        body: invalidData,
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.createAssessment(req, res);

      expect(res.status).not.toHaveBeenCalledWith(200);
    });

    test("should validate field formats and values", async () => {
      const invalidData = {
        title: "a".repeat(101),
        description: "a".repeat(501),
        type: "invalid_type",
        totalPoints: 1001,
        numberOfItems: 1001,
        section: "mockSectionId",
        startDate: "invalid-date",
        endDate: "invalid-date",
      };

      mockProcessAssessmentFormData.mockReturnValue({
        processedData: invalidData,
        error: undefined,
        details: undefined,
      });

      mockAssessmentService.createAssessment.mockImplementation(() => {
        const error = new Error("Validation error");
        error.name = "ZodError";
        throw error;
      });

      const req = createMockRequest({
        body: invalidData,
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.createAssessment(req, res);

      expect(res.status).not.toHaveBeenCalledWith(200);
    });

    test("should validate question structure", async () => {
      const invalidQuestionsData = {
        title: "Test Assessment",
        section: "mockSectionId",
        type: "quiz",
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        questions: [
          {
            questionText: "Test question",
          },
        ],
      };

      mockProcessAssessmentFormData.mockReturnValue({
        processedData: invalidQuestionsData,
        error: undefined,
        details: undefined,
      });

      mockAssessmentService.createAssessment.mockImplementation(() => {
        const error = new Error("Validation error");
        error.name = "ZodError";
        throw error;
      });

      const req = createMockRequest({
        body: {
          title: "Test Assessment",
          section: "mockSectionId",
          type: "quiz",
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000).toISOString(),
          questions: JSON.stringify([
            {
              questionText: "Test question",
            },
          ]),
        },
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.createAssessment(req, res);

      expect(res.status).not.toHaveBeenCalledWith(200);
    });
  });

  describe("updateAssessment validation", () => {
    test("should validate that _id is provided", async () => {
      const invalidData = {
        title: "Updated Assessment",
        description: "Updated description",
      };

      mockProcessAssessmentFormData.mockReturnValue({
        processedData: invalidData,
        error: undefined,
        details: undefined,
      });

      const req = createMockRequest({
        body: invalidData,
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.updateAssessment(req, res);

      expect(res.status).not.toHaveBeenCalledWith(200);
      expect(mockAssessmentService.updateAssessment).not.toHaveBeenCalled();
    });

    test("should validate date formats", async () => {
      const invalidData = {
        _id: "assessmentId",
        startDate: "invalid-date",
        endDate: "invalid-date",
      };

      mockProcessAssessmentFormData.mockReturnValue({
        processedData: invalidData,
        error: undefined,
        details: undefined,
      });

      mockAssessmentService.updateAssessment.mockImplementation(() => {
        const error = new Error("Validation error");
        error.name = "ZodError";
        throw error;
      });

      const req = createMockRequest({
        body: invalidData,
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.updateAssessment(req, res);

      expect(res.status).not.toHaveBeenCalledWith(200);
    });
  });

  describe("getAssessment validation", () => {
    test("should validate id parameter", async () => {
      const req = createMockRequest({
        params: {},
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.getAssessment(req, res);

      expect(res.status).not.toHaveBeenCalledWith(200);
      expect(mockAssessmentService.getAssessment).not.toHaveBeenCalled();
    });
  });

  describe("deleteAssessment validation", () => {
    test("should validate id parameter", async () => {
      const req = createMockRequest({
        params: {},
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.deleteAssessment(req, res);

      expect(res.status).not.toHaveBeenCalledWith(200);
      expect(mockAssessmentService.deleteAssessment).not.toHaveBeenCalled();
    });
  });

  describe("archiveAssessment validation", () => {
    test("should validate id parameter", async () => {
      const req = createMockRequest({
        params: {},
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.archiveAssessment(req, res);

      expect(res.status).not.toHaveBeenCalledWith(200);
      expect(mockAssessmentService.archiveAssessment).not.toHaveBeenCalled();
    });
  });

  describe("searchAssessment validation", () => {
    test("should validate search query format", async () => {
      const invalidQuery = {
        invalidField: "test",
      };

      mockAssessmentService.searchAssessment.mockImplementation(() => {
        const error = new Error("Validation error");
        error.name = "ZodError";
        throw error;
      });

      const req = createMockRequest({
        body: invalidQuery,
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.searchAssessment(req, res);

      expect(res.status).not.toHaveBeenCalledWith(200);
    });
  });

  describe("submitAssessment validation", () => {
    test("should validate required assessment ID and answers", async () => {
      const invalidData = {};

      mockAssessmentService.submitAssessment.mockImplementation(() => {
        throw new Error("Validation should have failed before reaching service call");
      });

      const req = createMockRequest({
        body: invalidData,
        user: {
          id: "studentId",
          email: "student@example.com",
          organizationId: "mockOrgId",
          role: USER_ROLES.STUDENT,
          firstName: "",
          lastName: "",
        },
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.submitAssessment(req, res);

      expect(res.status).not.toHaveBeenCalledWith(200);
    });

    test("should validate answer format", async () => {
      const invalidData = {
        assessmentId: "mockAssessmentId",
        answers: "not-an-array",
      };

      mockAssessmentService.submitAssessment.mockImplementation(() => {
        throw new Error("Validation should have failed before reaching service call");
      });

      const req = createMockRequest({
        body: invalidData,
        user: {
          id: "studentId",
          email: "student@example.com",
          organizationId: "mockOrgId",
          role: USER_ROLES.STUDENT,
          firstName: "",
          lastName: "",
        },
      });

      const res = createMockResponse();

      await assessmentRouteHandlers.submitAssessment(req, res);

      expect(res.status).not.toHaveBeenCalledWith(200);
    });
  });
});
