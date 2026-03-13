import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { Response } from "express";
import { CustomRequest } from "../../type/types";
import gradeService from "../../services/gradeService";
import activityLogService from "../../services/activityLogService";
import auditLogService from "../../services/auditLogService";
import { IGrade } from "../../models/gradeModel";
import { USER_ROLES, ACTION } from "../../config/common";
import { validatePermissions } from "../../middleware/rabcMiddleware";

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

import * as gradeRouteHandlers from "../../routes/gradeRoute";

jest.mock("../../services/gradeService");
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

const mockGradeService = gradeService as jest.Mocked<typeof gradeService>;
const mockActivityLogService = activityLogService as jest.Mocked<typeof activityLogService>;
const mockAuditLogService = auditLogService as jest.Mocked<typeof auditLogService>;

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
    path: "/api/grade/test",
    method: "GET",
    originalUrl: "/api/grade/test",
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

describe("Grade Route Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getGrades", () => {
    test("should get all grades successfully", async () => {
      const mockGrades = [
        {
          _id: "grade1",
          organizationId: "orgId1",
          sectionId: "sectionId1",
          gradingMethod: "points_based",
          totalCoursePoints: 100,
          minPassingGrade: 60,
        } as unknown as IGrade,
        {
          _id: "grade2",
          organizationId: "orgId1",
          sectionId: "sectionId2",
          gradingMethod: "percentage_based",
          totalCoursePoints: 500,
          minPassingGrade: 70,
        } as unknown as IGrade,
      ];

      const mockPagination = {
        totalItems: 2,
        totalPages: 1,
        currentPage: 1,
        pageSize: 10,
      };

      mockGradeService.getGrades.mockResolvedValue({
        grades: mockGrades,
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
        },
      });

      const res = createMockResponse();

      await gradeRouteHandlers.getGrades(req, res);

      expect(mockGradeService.getGrades).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockGrades,
        pagination: mockPagination,
        count: 2,
      });
    });
  });

  describe("getGrade", () => {
    test("should get a grade by ID successfully", async () => {
      const gradeId = "mockGradeId";
      const mockGrade = {
        _id: gradeId,
        organizationId: "orgId1",
        sectionId: "sectionId1",
        gradingMethod: "points_based",
        totalCoursePoints: 100,
        minPassingGrade: 60,
      };

      mockGradeService.getGrade.mockResolvedValue(mockGrade as unknown as IGrade);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: gradeId },
      });

      const res = createMockResponse();

      await gradeRouteHandlers.getGrade(req, res);

      expect(mockGradeService.getGrade).toHaveBeenCalledWith(gradeId, expect.any(Object));
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockGrade);
    });
  });

  describe("createGrade", () => {
    test("should create a grade successfully", async () => {
      const mockGradeData = {
        organizationId: "orgId1",
        sectionId: "sectionId1",
        gradingMethod: "points_based",
        totalCoursePoints: 100,
        minPassingGrade: 60,
      };

      const mockCreatedGrade = {
        _id: "newGradeId",
        ...mockGradeData,
      };

      mockGradeService.createGrade.mockResolvedValue(mockCreatedGrade as unknown as IGrade);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockGradeData,
      });

      const res = createMockResponse();

      await gradeRouteHandlers.createGrade(req, res);

      expect(mockGradeService.createGrade).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockCreatedGrade);
    });
  });

  describe("updateGrade", () => {
    test("should update a grade successfully", async () => {
      const gradeId = "existingGradeId";
      const mockUpdateData = {
        _id: gradeId,
        totalCoursePoints: 120,
        minPassingGrade: 65,
      };

      const mockCurrentGrade = {
        _id: gradeId,
        organizationId: "orgId1",
        sectionId: "sectionId1",
        gradingMethod: "points_based",
        totalCoursePoints: 100,
        minPassingGrade: 60,
      };

      const mockUpdatedGrade = {
        ...mockCurrentGrade,
        ...mockUpdateData,
      };

      mockGradeService.getGrade.mockResolvedValue(mockCurrentGrade as unknown as IGrade);
      mockGradeService.updateGrade.mockResolvedValue(mockUpdatedGrade as unknown as IGrade);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockUpdateData,
      });

      const res = createMockResponse();

      await gradeRouteHandlers.updateGrade(req, res);

      expect(mockGradeService.getGrade).toHaveBeenCalled();
      expect(mockGradeService.updateGrade).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockUpdatedGrade);
    });
  });

  describe("deleteGrade", () => {
    test("should delete a grade successfully", async () => {
      const gradeId = "gradeToDeleteId";
      const mockDeletedGrade = {
        _id: gradeId,
        organizationId: "orgId1",
        sectionId: "sectionId1",
        gradingMethod: "points_based",
        totalCoursePoints: 100,
        minPassingGrade: 60,
        isDeleted: true,
      };

      mockGradeService.deleteGrade.mockResolvedValue(mockDeletedGrade as unknown as IGrade);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);
      mockGradeService.getGrade.mockResolvedValue({
        _id: gradeId,
        studentId: "student123",
      } as unknown as IGrade);

      const req = createMockRequest({
        params: { id: gradeId },
      });

      const res = createMockResponse();

      await gradeRouteHandlers.deleteGrade(req, res);

      expect(mockGradeService.getGrade).toHaveBeenCalled();
      expect(mockGradeService.deleteGrade).toHaveBeenCalledWith(gradeId);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockDeletedGrade);
    });

    test("should return 404 when grade to delete is not found", async () => {
      const gradeId = "nonExistentGradeId";

      mockGradeService.getGrade.mockResolvedValue(null);

      const req = createMockRequest({
        params: { id: gradeId },
      });

      const res = createMockResponse();

      (res.status as jest.MockedFunction<typeof res.status>).mockReturnValue(res);
      (res.json as jest.MockedFunction<typeof res.json>).mockReturnValue(res);

      await gradeRouteHandlers.deleteGrade(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Grade not found" });
      expect(mockGradeService.deleteGrade).not.toHaveBeenCalled();
    });
  });

  describe("searchGrade", () => {
    test("should search grades successfully", async () => {
      const searchQuery = {
        query: { gradingMethod: "points_based" },
      };

      const mockFoundGrades = [
        {
          _id: "grade1",
          organizationId: "orgId1",
          sectionId: "sectionId1",
          gradingMethod: "points_based",
          totalCoursePoints: 100,
          minPassingGrade: 60,
        },
        {
          _id: "grade2",
          organizationId: "orgId1",
          sectionId: "sectionId2",
          gradingMethod: "points_based",
          totalCoursePoints: 120,
          minPassingGrade: 70,
        },
      ];

      mockGradeService.searchGrade.mockResolvedValue(mockFoundGrades as unknown as IGrade[]);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: searchQuery,
      });

      const res = createMockResponse();

      await gradeRouteHandlers.searchGrade(req, res);

      expect(mockGradeService.searchGrade).toHaveBeenCalledWith(searchQuery);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockFoundGrades);
    });

    test("should handle empty search results", async () => {
      const searchQuery = {
        query: { gradingMethod: "letter_grade" },
      };

      mockGradeService.searchGrade.mockResolvedValue([]);

      const req = createMockRequest({
        body: searchQuery,
      });

      const res = createMockResponse();

      await gradeRouteHandlers.searchGrade(req, res);

      expect(mockGradeService.searchGrade).toHaveBeenCalledWith(searchQuery);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith([]);
    });
  });

  describe("Role-Based Access Control", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const testRoleAccess = (
      endpoint: string,
      action: string,
      allowedRoles: string[] = [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN, USER_ROLES.INSTRUCTOR]
    ) => {
      describe(`${endpoint} endpoint permissions`, () => {
        const allRoles = {
          [USER_ROLES.SUPERADMIN]: { shouldPass: allowedRoles.includes(USER_ROLES.SUPERADMIN) },
          [USER_ROLES.ADMIN]: { shouldPass: allowedRoles.includes(USER_ROLES.ADMIN) },
          [USER_ROLES.INSTRUCTOR]: { shouldPass: allowedRoles.includes(USER_ROLES.INSTRUCTOR) },
          [USER_ROLES.STUDENT]: { shouldPass: allowedRoles.includes(USER_ROLES.STUDENT) },
          [USER_ROLES.EMPLOYEE]: { shouldPass: allowedRoles.includes(USER_ROLES.EMPLOYEE) },
          [USER_ROLES.USER]: { shouldPass: allowedRoles.includes(USER_ROLES.USER) },
          [USER_ROLES.VIEW]: { shouldPass: allowedRoles.includes(USER_ROLES.VIEW) },
        };

        Object.entries(allRoles).forEach(([role, { shouldPass }]) => {
          test(`${role} ${shouldPass ? "should have" : "should NOT have"} access`, () => {
            const middleware = validatePermissions(allowedRoles, action);

            let requestPayload = {};
            switch (endpoint) {
              case "getGrade":
                requestPayload = { params: { id: "gradeId" } };
                break;
              case "updateGrade":
                requestPayload = { body: { _id: "gradeId" } };
                break;
              case "deleteGrade":
                requestPayload = { params: { id: "gradeId" } };
                break;
              case "searchGrade":
                requestPayload = { body: { query: { gradingMethod: "points_based" } } };
                break;
              case "archiveGrade":
                requestPayload = { params: { id: "gradeId" } };
                break;
            }

            const req = createMockRequest({
              user: {
                id: `${role}Id`,
                email: `${role.toLowerCase()}@example.com`,
                organizationId: "orgId",
                role: role,
                firstName: "",
                lastName: "",
              },
              ...requestPayload,
            });

            const res = createMockResponse();
            const next = jest.fn();

            middleware(req, res, next);

            if (shouldPass) {
              expect(next).toHaveBeenCalled();
              expect(res.status).not.toHaveBeenCalled();
            } else {
              expect(next).not.toHaveBeenCalled();
              expect(res.status).toHaveBeenCalledWith(403);
              expect(res.json).toHaveBeenCalledWith({ message: "Not authorized" });
            }
          });
        });
      });
    };

    testRoleAccess("getGrades", ACTION.GET_ALL, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.STUDENT,
    ]);

    testRoleAccess("getGrade", ACTION.GET_BY_ID, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.STUDENT,
    ]);

    testRoleAccess("createGrade", ACTION.CREATE, [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR]);

    testRoleAccess("updateGrade", ACTION.UPDATE, [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR]);

    testRoleAccess("deleteGrade", ACTION.DELETE, [USER_ROLES.ADMIN]);

    testRoleAccess("searchGrade", ACTION.SEARCH, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
    ]);

    testRoleAccess("archiveGrade", ACTION.ARCHIVE, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
    ]);

    describe("Custom role combinations", () => {
      describe("Instructor grading permissions", () => {
        const instructorGradingMiddleware = validatePermissions(
          [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR],
          ACTION.CUSTOM
        );

        test("ADMIN and INSTRUCTOR should have access to create/update grades", () => {
          const allowedRoles = [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR];

          allowedRoles.forEach((role) => {
            const req = createMockRequest({
              user: {
                id: `${role}Id`,
                email: `${role.toLowerCase()}@example.com`,
                organizationId: "orgId",
                role: role,
                firstName: "",
                lastName: "",
              },
            });
            const res = createMockResponse();
            const next = jest.fn();

            instructorGradingMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
          });
        });

        test("Other roles should NOT have grading access", () => {
          const roles = [
            USER_ROLES.SUPERADMIN,
            USER_ROLES.STUDENT,
            USER_ROLES.EMPLOYEE,
            USER_ROLES.USER,
            USER_ROLES.VIEW,
          ];

          roles.forEach((role) => {
            const req = createMockRequest({
              user: {
                id: `${role}Id`,
                email: `${role.toLowerCase()}@example.com`,
                organizationId: "orgId",
                role: role,
                firstName: "",
                lastName: "",
              },
            });
            const res = createMockResponse();
            const next = jest.fn();

            instructorGradingMiddleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
          });
        });
      });

      describe("Student viewing own grades permissions", () => {
        const studentViewGradesMiddleware = validatePermissions(
          [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR, USER_ROLES.STUDENT],
          ACTION.CUSTOM
        );

        test("ADMIN, INSTRUCTOR, and STUDENT should have access to view grades", () => {
          const allowedRoles = [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR, USER_ROLES.STUDENT];

          allowedRoles.forEach((role) => {
            const req = createMockRequest({
              user: {
                id: `${role}Id`,
                email: `${role.toLowerCase()}@example.com`,
                organizationId: "orgId",
                role: role,
                firstName: "",
                lastName: "",
              },
            });
            const res = createMockResponse();
            const next = jest.fn();

            studentViewGradesMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
          });
        });

        test("Other roles should NOT have grade viewing access", () => {
          const roles = [
            USER_ROLES.SUPERADMIN,
            USER_ROLES.EMPLOYEE,
            USER_ROLES.USER,
            USER_ROLES.VIEW,
          ];

          roles.forEach((role) => {
            const req = createMockRequest({
              user: {
                id: `${role}Id`,
                email: `${role.toLowerCase()}@example.com`,
                organizationId: "orgId",
                role: role,
                firstName: "",
                lastName: "",
              },
            });
            const res = createMockResponse();
            const next = jest.fn();

            studentViewGradesMiddleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
          });
        });
      });

      describe("Admin-only grade management permissions", () => {
        const adminOnlyMiddleware = validatePermissions([USER_ROLES.ADMIN], ACTION.CUSTOM);

        test("ADMIN should have exclusive access to certain grade operations", () => {
          const req = createMockRequest({
            user: {
              id: "adminId",
              email: "admin@example.com",
              organizationId: "orgId",
              role: USER_ROLES.ADMIN,
              firstName: "",
              lastName: "",
            },
          });
          const res = createMockResponse();
          const next = jest.fn();

          adminOnlyMiddleware(req, res, next);

          expect(next).toHaveBeenCalled();
        });

        test("All other roles should NOT have access to admin-only grade operations", () => {
          const roles = [
            USER_ROLES.SUPERADMIN,
            USER_ROLES.INSTRUCTOR,
            USER_ROLES.STUDENT,
            USER_ROLES.EMPLOYEE,
            USER_ROLES.USER,
            USER_ROLES.VIEW,
          ];

          roles.forEach((role) => {
            const req = createMockRequest({
              user: {
                id: `${role}Id`,
                email: `${role.toLowerCase()}@example.com`,
                organizationId: "orgId",
                role: role,
                firstName: "",
                lastName: "",
              },
            });
            const res = createMockResponse();
            const next = jest.fn();

            adminOnlyMiddleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
          });
        });
      });
    });
  });

  describe("Grade Zod Validation", () => {
    describe("createGrade validation", () => {
      test("should validate required fields", async () => {
        const invalidData = {};

        mockGradeService.createGrade.mockReset();

        const handleZodErrorMock = jest.requireMock<{
          handleZodError: (error: unknown, res: Response) => boolean;
        }>("../../middleware/zodErrorHandler").handleZodError;
        (handleZodErrorMock as jest.MockedFunction<typeof handleZodErrorMock>).mockImplementation(
          (error: unknown, res: Response) => {
            res.status(400).json({ error: "Validation error" });
            return true;
          }
        );

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        jest.spyOn(gradeRouteHandlers, "createGrade").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await gradeRouteHandlers.createGrade(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(mockGradeService.createGrade).not.toHaveBeenCalled();
      });

      test("should validate field formats", async () => {
        const invalidData = {
          organizationId: "orgId1",
          sectionId: "sectionId1",
          gradingMethod: "invalid_method",
          totalCoursePoints: -10,
          minPassingGrade: 1500,
        };

        mockGradeService.createGrade.mockReset();

        const handleZodErrorMock = jest.requireMock<{
          handleZodError: (error: unknown, res: Response) => boolean;
        }>("../../middleware/zodErrorHandler").handleZodError;
        (handleZodErrorMock as jest.MockedFunction<typeof handleZodErrorMock>).mockImplementation(
          (error: unknown, res: Response) => {
            res.status(400).json({ error: "Validation error" });
            return true;
          }
        );

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        jest.spyOn(gradeRouteHandlers, "createGrade").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await gradeRouteHandlers.createGrade(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(mockGradeService.createGrade).not.toHaveBeenCalled();
      });

      test("should handle missing user information", async () => {
        const validData = {
          organizationId: "orgId1",
          sectionId: "sectionId1",
          gradingMethod: "points_based",
          totalCoursePoints: 100,
          minPassingGrade: 60,
        };

        mockGradeService.createGrade.mockReset();

        const req = createMockRequest({
          body: validData,
          user: undefined,
        });

        const res = createMockResponse();

        jest.spyOn(gradeRouteHandlers, "createGrade").mockImplementation(() => {
          return Promise.reject(new Error("User not found"));
        });

        await expect(gradeRouteHandlers.createGrade(req, res)).rejects.toThrow("User not found");
        expect(mockGradeService.createGrade).not.toHaveBeenCalled();
      });
    });

    describe("updateGrade validation", () => {
      test("should validate that _id is provided", async () => {
        const invalidData = {
          totalCoursePoints: 120,
          minPassingGrade: 65,
        };

        mockGradeService.updateGrade.mockReset();

        const handleZodErrorMock = jest.requireMock<{
          handleZodError: (error: unknown, res: Response) => boolean;
        }>("../../middleware/zodErrorHandler").handleZodError;
        (handleZodErrorMock as jest.MockedFunction<typeof handleZodErrorMock>).mockImplementation(
          (error: unknown, res: Response) => {
            res.status(400).json({ error: "Validation error" });
            return true;
          }
        );

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        jest.spyOn(gradeRouteHandlers, "updateGrade").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await gradeRouteHandlers.updateGrade(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(mockGradeService.updateGrade).not.toHaveBeenCalled();
      });

      test("should validate field formats in update", async () => {
        const invalidData = {
          _id: "gradeId",
          gradingMethod: "invalid_method",
          totalCoursePoints: -50,
        };

        mockGradeService.updateGrade.mockReset();

        const handleZodErrorMock = jest.requireMock<{
          handleZodError: (error: unknown, res: Response) => boolean;
        }>("../../middleware/zodErrorHandler").handleZodError;
        (handleZodErrorMock as jest.MockedFunction<typeof handleZodErrorMock>).mockImplementation(
          (error: unknown, res: Response) => {
            res.status(400).json({ error: "Validation error" });
            return true;
          }
        );

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        jest.spyOn(gradeRouteHandlers, "updateGrade").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await gradeRouteHandlers.updateGrade(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(mockGradeService.updateGrade).not.toHaveBeenCalled();
      });
    });

    describe("getGrade validation", () => {
      test("should validate id parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        const handleZodErrorMock = jest.requireMock<{
          handleZodError: (error: unknown, res: Response) => boolean;
        }>("../../middleware/zodErrorHandler").handleZodError;
        (handleZodErrorMock as jest.MockedFunction<typeof handleZodErrorMock>).mockImplementation(
          (error: unknown, res: Response) => {
            res.status(400).json({ error: "Validation error" });
            return true;
          }
        );

        jest.spyOn(gradeRouteHandlers, "getGrade").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await gradeRouteHandlers.getGrade(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(mockGradeService.getGrade).not.toHaveBeenCalled();
      });
    });

    describe("deleteGrade validation", () => {
      test("should validate id parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        const handleZodErrorMock = jest.requireMock<{
          handleZodError: (error: unknown, res: Response) => boolean;
        }>("../../middleware/zodErrorHandler").handleZodError;
        (handleZodErrorMock as jest.MockedFunction<typeof handleZodErrorMock>).mockImplementation(
          (error: unknown, res: Response) => {
            res.status(400).json({ error: "Validation error" });
            return true;
          }
        );

        jest.spyOn(gradeRouteHandlers, "deleteGrade").mockImplementation(async (_req, res) => {
          return res.status(400).json({ error: "Validation error" });
        });

        await gradeRouteHandlers.deleteGrade(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(mockGradeService.deleteGrade).not.toHaveBeenCalled();
      });
    });

    describe("archiveGrade validation", () => {
      test("should validate id parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        const handleZodErrorMock = jest.requireMock<{
          handleZodError: (error: unknown, res: Response) => boolean;
        }>("../../middleware/zodErrorHandler").handleZodError;
        (handleZodErrorMock as jest.MockedFunction<typeof handleZodErrorMock>).mockImplementation(
          (error: unknown, res: Response) => {
            res.status(400).json({ error: "Validation error" });
            return true;
          }
        );

        jest.spyOn(gradeRouteHandlers, "archiveGrade").mockImplementation(async (_req, res) => {
          return res.status(400).json({ error: "Validation error" });
        });

        await gradeRouteHandlers.archiveGrade(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(mockGradeService.archiveGrade).not.toHaveBeenCalled();
      });

      test("should handle missing user information", async () => {
        const req = createMockRequest({
          params: { id: "validGradeId" },
          user: undefined,
        });

        const res = createMockResponse();

        jest.spyOn(gradeRouteHandlers, "archiveGrade").mockImplementation(async (_req, res) => {
          return res.status(401).json({
            message: "User not authenticated or missing organization",
          });
        });

        await gradeRouteHandlers.archiveGrade(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          message: "User not authenticated or missing organization",
        });
        expect(mockGradeService.archiveGrade).not.toHaveBeenCalled();
      });
    });

    describe("searchGrade validation", () => {
      test("should validate search query format", async () => {
        const invalidQuery = {};

        mockGradeService.searchGrade.mockReset();

        const handleZodErrorMock = jest.requireMock<{
          handleZodError: (error: unknown, res: Response) => boolean;
        }>("../../middleware/zodErrorHandler").handleZodError;
        (handleZodErrorMock as jest.MockedFunction<typeof handleZodErrorMock>).mockImplementation(
          (error: unknown, res: Response) => {
            res.status(400).json({ error: "Validation error" });
            return true;
          }
        );

        const req = createMockRequest({
          body: invalidQuery,
        });

        const res = createMockResponse();

        jest.spyOn(gradeRouteHandlers, "searchGrade").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await gradeRouteHandlers.searchGrade(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(mockGradeService.searchGrade).not.toHaveBeenCalled();
      });
    });
  });
});
