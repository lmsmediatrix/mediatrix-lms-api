import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { Response } from "express";
import { CustomRequest } from "../../type/types";
import instructorService from "../../services/instructorService";
import activityLogService from "../../services/activityLogService";
import auditLogService from "../../services/auditLogService";
import { IInstructor } from "../../models/instructorModel";
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

jest.mock("../../helper/formDataHelper", () => ({
  processInstructorFormData: jest.fn(),
}));

import * as instructorRouteHandlers from "../../routes/instructorRoute";
import { processInstructorFormData } from "../../helper/formDataHelper";

jest.mock("../../services/instructorService");
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

const mockInstructorService = instructorService as jest.Mocked<typeof instructorService>;
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
    path: "/api/instructor/test",
    method: "GET",
    originalUrl: "/api/instructor/test",
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

describe("Instructor Route Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getInstructors", () => {
    test("should get all instructors successfully", async () => {
      const mockInstructors = [
        {
          _id: "instructor1",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          role: "instructor",
          expertise: ["Math", "Physics"],
          faculty: "Science",
          organizationId: "orgId1",
        } as unknown as IInstructor,
        {
          _id: "instructor2",
          firstName: "Jane",
          lastName: "Smith",
          email: "jane.smith@example.com",
          role: "instructor",
          expertise: ["Literature", "History"],
          faculty: "Arts",
          organizationId: "orgId1",
        } as unknown as IInstructor,
      ];

      const mockPagination = {
        totalItems: 2,
        totalPages: 1,
        currentPage: 1,
        pageSize: 10,
      };

      mockInstructorService.getInstructors.mockResolvedValue({
        instructors: mockInstructors,
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

      await instructorRouteHandlers.getInstructors(req, res);

      expect(mockInstructorService.getInstructors).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockInstructors,
        pagination: mockPagination,
        count: 2,
      });
    });
  });

  describe("getInstructor", () => {
    test("should get an instructor by ID successfully", async () => {
      const instructorId = "mockInstructorId";
      const mockInstructor = {
        _id: instructorId,
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        role: "instructor",
        expertise: ["Math", "Physics"],
        faculty: "Science",
        organizationId: "orgId1",
      };

      mockInstructorService.getInstructor.mockResolvedValue(
        mockInstructor as unknown as IInstructor
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: instructorId },
      });

      const res = createMockResponse();

      await instructorRouteHandlers.getInstructor(req, res);

      expect(mockInstructorService.getInstructor).toHaveBeenCalledWith(
        instructorId,
        expect.any(Object)
      );
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockInstructor,
      });
    });

    test("should return 404 when instructor is not found", async () => {
      const instructorId = "nonExistentInstructorId";
      mockInstructorService.getInstructor.mockResolvedValue(null);

      const req = createMockRequest({
        params: { id: instructorId },
      });

      const res = createMockResponse();

      await instructorRouteHandlers.getInstructor(req, res);

      expect(mockInstructorService.getInstructor).toHaveBeenCalledWith(
        instructorId,
        expect.any(Object)
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("createInstructor", () => {
    test("should create an instructor successfully", async () => {
      const mockInstructorData = {
        firstName: "New",
        lastName: "Instructor",
        email: "new.instructor@example.com",
        role: "instructor",
        expertise: ["Programming"],
        faculty: "Computer Science",
        organizationId: "orgId1",
      };

      const mockCreatedInstructor = {
        _id: "newInstructorId",
        ...mockInstructorData,
      };
      (
        processInstructorFormData as jest.MockedFunction<typeof processInstructorFormData>
      ).mockReturnValue({
        processedData: mockInstructorData,
      });

      mockInstructorService.createInstructor.mockResolvedValue(
        mockCreatedInstructor as unknown as IInstructor
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockInstructorData,
      });

      const res = createMockResponse();

      await instructorRouteHandlers.createInstructor(req, res);

      expect(mockInstructorService.createInstructor).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockCreatedInstructor,
      });
    });
  });

  describe("updateInstructor", () => {
    test("should update an instructor successfully", async () => {
      const instructorId = "existingInstructorId";
      const mockUpdateData = {
        _id: instructorId,
        firstName: "Updated",
        lastName: "Instructor",
        expertise: ["Programming", "Database"],
      };

      const mockCurrentInstructor = {
        _id: instructorId,
        firstName: "Current",
        lastName: "Instructor",
        email: "current.instructor@example.com",
        role: "instructor",
        expertise: ["Programming"],
        faculty: "Computer Science",
      };

      const mockUpdatedInstructor = {
        ...mockCurrentInstructor,
        ...mockUpdateData,
      };

      (
        processInstructorFormData as jest.MockedFunction<typeof processInstructorFormData>
      ).mockReturnValue({
        processedData: mockUpdateData,
      });
      mockInstructorService.getInstructor.mockResolvedValue(
        mockCurrentInstructor as unknown as IInstructor
      );
      mockInstructorService.updateInstructor.mockResolvedValue(
        mockUpdatedInstructor as unknown as IInstructor
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockUpdateData,
      });

      const res = createMockResponse();

      await instructorRouteHandlers.updateInstructor(req, res);

      expect(mockInstructorService.getInstructor).toHaveBeenCalled();
      expect(mockInstructorService.updateInstructor).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockUpdatedInstructor,
      });
    });
  });

  describe("deleteInstructor", () => {
    test("should delete an instructor successfully", async () => {
      const instructorId = "instructorToDeleteId";
      const mockInstructor = {
        _id: instructorId,
        firstName: "Delete",
        lastName: "Instructor",
        email: "delete.instructor@example.com",
        faculty: "Computer Science",
      };

      mockInstructorService.getInstructor.mockResolvedValue(
        mockInstructor as unknown as IInstructor
      );
      mockInstructorService.deleteInstructor.mockResolvedValue({} as unknown as any);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: instructorId },
      });

      const res = createMockResponse();

      await instructorRouteHandlers.deleteInstructor(req, res);

      expect(mockInstructorService.getInstructor).toHaveBeenCalledWith(
        instructorId,
        expect.any(Object)
      );
      expect(mockInstructorService.deleteInstructor).toHaveBeenCalledWith(instructorId);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({ message: expect.any(String) });
    });

    test("should return an error when instructor not found", async () => {
      const instructorId = "nonExistentInstructorId";

      mockInstructorService.getInstructor.mockResolvedValue(null);

      const req = createMockRequest({
        params: { id: instructorId },
      });

      const res = createMockResponse();

      await instructorRouteHandlers.deleteInstructor(req, res);

      expect(mockInstructorService.getInstructor).toHaveBeenCalledWith(
        instructorId,
        expect.any(Object)
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith({ message: "Instructor not found" });
      expect(mockInstructorService.deleteInstructor).not.toHaveBeenCalled();
    });
  });

  describe("searchInstructor", () => {
    test("should search instructors successfully", async () => {
      const searchQuery = {
        query: { faculty: "Computer Science" },
      };

      const mockFoundInstructors = [
        {
          _id: "instructor1",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          role: "instructor",
          expertise: ["Programming", "Algorithms"],
          faculty: "Computer Science",
        },
        {
          _id: "instructor2",
          firstName: "Jane",
          lastName: "Smith",
          email: "jane.smith@example.com",
          role: "instructor",
          expertise: ["Database Systems", "Web Development"],
          faculty: "Computer Science",
        },
      ];

      mockInstructorService.searchInstructor.mockResolvedValue(
        mockFoundInstructors as unknown as IInstructor[]
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: searchQuery,
      });

      const res = createMockResponse();

      await instructorRouteHandlers.searchInstructor(req, res);

      expect(mockInstructorService.searchInstructor).toHaveBeenCalledWith(searchQuery);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockFoundInstructors);
    });

    test("should handle empty search results", async () => {
      const searchQuery = {
        query: { faculty: "Non-existent Faculty" },
      };

      mockInstructorService.searchInstructor.mockResolvedValue([]);

      const req = createMockRequest({
        body: searchQuery,
      });

      const res = createMockResponse();

      await instructorRouteHandlers.searchInstructor(req, res);

      expect(mockInstructorService.searchInstructor).toHaveBeenCalledWith(searchQuery);
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
      allowedRoles: string[] = [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]
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
              case "getInstructor":
                requestPayload = { params: { id: "instructorId" } };
                break;
              case "updateInstructor":
                requestPayload = {
                  body: {
                    _id: "instructorId",
                    firstName: "Updated",
                    lastName: "Instructor",
                  },
                };
                break;
              case "deleteInstructor":
                requestPayload = { params: { id: "instructorId" } };
                break;
              case "searchInstructor":
                requestPayload = {
                  body: {
                    query: {
                      faculty: "Computer Science",
                    },
                  },
                };
                break;
              case "archiveInstructor":
                requestPayload = { params: { id: "instructorId" } };
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

    testRoleAccess("getInstructors", ACTION.GET_ALL, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.STUDENT,
    ]);

    testRoleAccess("getInstructor", ACTION.GET_BY_ID, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.STUDENT,
    ]);

    testRoleAccess("createInstructor", ACTION.CREATE, [USER_ROLES.ADMIN]);

    testRoleAccess("updateInstructor", ACTION.UPDATE, [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR]);

    testRoleAccess("deleteInstructor", ACTION.DELETE, [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR]);

    testRoleAccess("searchInstructor", ACTION.SEARCH, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
    ]);

    testRoleAccess("archiveInstructor", ACTION.ARCHIVE, [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]);

    describe("Instructor-specific permissions", () => {
      describe("Self-management permissions", () => {
        const selfManagementMiddleware = validatePermissions(
          [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR],
          ACTION.UPDATE
        );

        test("INSTRUCTOR should be able to update their own profile", () => {
          const instructorId = "instructorId";
          const req = createMockRequest({
            user: {
              id: instructorId,
              email: "instructor@example.com",
              organizationId: "orgId",
              role: USER_ROLES.INSTRUCTOR,
              firstName: "Test",
              lastName: "Instructor",
            },
            body: {
              _id: instructorId,
              firstName: "Updated",
              lastName: "Instructor",
            },
          });
          const res = createMockResponse();
          const next = jest.fn();

          selfManagementMiddleware(req, res, next);

          expect(next).toHaveBeenCalled();
        });

        test("INSTRUCTOR should NOT be able to update another instructor's profile", () => {
          const instructorId = "instructorId";
          const anotherInstructorId = "anotherInstructorId";

          const customMiddleware = (req: any, res: any, next: any) => {
            if (req.user.role === USER_ROLES.INSTRUCTOR && req.body._id !== req.user.id) {
              return res
                .status(403)
                .json({ message: "Instructors can only update their own profiles" });
            }
            next();
          };

          const req = createMockRequest({
            user: {
              id: instructorId,
              email: "instructor@example.com",
              organizationId: "orgId",
              role: USER_ROLES.INSTRUCTOR,
              firstName: "Test",
              lastName: "Instructor",
            },
            body: {
              _id: anotherInstructorId,
              firstName: "Another",
              lastName: "Instructor",
            },
          });
          const res = createMockResponse();
          const next = jest.fn();

          customMiddleware(req, res, next);

          expect(next).not.toHaveBeenCalled();
          expect(res.status).toHaveBeenCalledWith(403);
        });
      });

      describe("Admin management of instructors", () => {
        const adminManagementMiddleware = validatePermissions([USER_ROLES.ADMIN], ACTION.CUSTOM);

        test("ADMIN should have full access to instructor management", () => {
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

          adminManagementMiddleware(req, res, next);

          expect(next).toHaveBeenCalled();
        });

        test("Other roles should NOT have full instructor management access", () => {
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

            adminManagementMiddleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
          });
        });
      });

      describe("Instructor dashboard access", () => {
        const instructorDashboardMiddleware = validatePermissions(
          [USER_ROLES.INSTRUCTOR],
          ACTION.GET_ALL
        );

        test("INSTRUCTOR should have access to their dashboard", () => {
          const req = createMockRequest({
            user: {
              id: "instructorId",
              email: "instructor@example.com",
              organizationId: "orgId",
              role: USER_ROLES.INSTRUCTOR,
              firstName: "Test",
              lastName: "Instructor",
            },
          });
          const res = createMockResponse();
          const next = jest.fn();

          instructorDashboardMiddleware(req, res, next);

          expect(next).toHaveBeenCalled();
        });

        test("Other roles should NOT have access to instructor dashboard", () => {
          const roles = [
            USER_ROLES.SUPERADMIN,
            USER_ROLES.ADMIN,
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

            instructorDashboardMiddleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
          });
        });
      });
    });
  });

  describe("Instructor Zod Validation", () => {
    describe("createInstructor validation", () => {
      test("should validate required fields", async () => {
        const invalidData = {
          firstName: "Test",
          lastName: "Instructor",
          email: "test@example.com",
        };

        mockInstructorService.createInstructor.mockReset();

        (
          processInstructorFormData as jest.MockedFunction<typeof processInstructorFormData>
        ).mockReturnValue({
          error: "Validation error",
          details: [{ field: "required", message: "Missing required fields" }],
        });

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        await instructorRouteHandlers.createInstructor(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(mockInstructorService.createInstructor).not.toHaveBeenCalled();
      });

      test("should validate field formats", async () => {
        const invalidData = {
          firstName: "Test",
          lastName: "Instructor",
          email: "invalid-email",
          expertise: [],
          faculty: "CS",
          experienceYears: -5,
        };

        mockInstructorService.createInstructor.mockReset();

        const handleZodErrorMock = jest.requireMock<{
          handleZodError: (error: unknown, res: Response) => boolean;
        }>("../../middleware/zodErrorHandler").handleZodError;

        (
          processInstructorFormData as jest.MockedFunction<typeof processInstructorFormData>
        ).mockReturnValue({
          processedData: invalidData,
        });

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        await instructorRouteHandlers.createInstructor(req, res);

        expect(mockInstructorService.createInstructor).not.toHaveBeenCalled();
        expect(handleZodErrorMock).toHaveBeenCalled();
      });

      test("should handle missing user information", async () => {
        const validData = {
          firstName: "Valid",
          lastName: "Instructor",
          email: "valid@example.com",
          expertise: ["Programming"],
          faculty: "Computer Science",
        };

        (
          processInstructorFormData as jest.MockedFunction<typeof processInstructorFormData>
        ).mockReturnValue({
          processedData: validData,
        });

        mockInstructorService.createInstructor.mockReset();

        const req = createMockRequest({
          body: validData,
          user: undefined,
        });

        const res = createMockResponse();

        await instructorRouteHandlers.createInstructor(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(mockInstructorService.createInstructor).not.toHaveBeenCalled();
      });
    });

    describe("updateInstructor validation", () => {
      test("should validate that _id is provided", async () => {
        const invalidData = {
          firstName: "Updated",
          lastName: "Name",
          expertise: ["Teaching"],
        };

        mockInstructorService.updateInstructor.mockReset();

        (
          processInstructorFormData as jest.MockedFunction<typeof processInstructorFormData>
        ).mockReturnValue({
          processedData: invalidData,
        });

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        await instructorRouteHandlers.updateInstructor(req, res);

        expect(mockInstructorService.updateInstructor).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
      });

      test("should validate field formats in update", async () => {
        const invalidData = {
          _id: "instructorId",
          faculty: "A",
          experienceYears: -10,
          ratings: { average: 6 },
        };

        mockInstructorService.updateInstructor.mockReset();

        (
          processInstructorFormData as jest.MockedFunction<typeof processInstructorFormData>
        ).mockReturnValue({
          processedData: invalidData,
        });

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        await instructorRouteHandlers.updateInstructor(req, res);

        expect(mockInstructorService.updateInstructor).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe("getInstructor validation", () => {
      test("should validate id parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        const handleZodErrorMock = jest.requireMock<{
          handleZodError: (error: unknown, res: Response) => boolean;
        }>("../../middleware/zodErrorHandler").handleZodError;

        await instructorRouteHandlers.getInstructor(req, res);

        expect(mockInstructorService.getInstructor).not.toHaveBeenCalled();
        expect(handleZodErrorMock).toHaveBeenCalled();
      });
    });

    describe("deleteInstructor validation", () => {
      test("should validate id parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        const handleZodErrorMock = jest.requireMock<{
          handleZodError: (error: unknown, res: Response) => boolean;
        }>("../../middleware/zodErrorHandler").handleZodError;

        await instructorRouteHandlers.deleteInstructor(req, res);

        expect(mockInstructorService.deleteInstructor).not.toHaveBeenCalled();
        expect(handleZodErrorMock).toHaveBeenCalled();
      });
    });

    describe("archiveInstructor validation", () => {
      test("should validate id parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        const handleZodErrorMock = jest.requireMock<{
          handleZodError: (error: unknown, res: Response) => boolean;
        }>("../../middleware/zodErrorHandler").handleZodError;

        await instructorRouteHandlers.archiveInstructor(req, res);

        expect(mockInstructorService.archiveInstructor).not.toHaveBeenCalled();
        expect(handleZodErrorMock).toHaveBeenCalled();
      });

      test("should handle missing user information", async () => {
        const req = createMockRequest({
          params: { id: "validInstructorId" },
          user: undefined,
        });

        const res = createMockResponse();

        await instructorRouteHandlers.archiveInstructor(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          message: "User not authenticated or missing organization",
        });
        expect(mockInstructorService.archiveInstructor).not.toHaveBeenCalled();
      });
    });

    describe("bulkImport validation", () => {
      test("should validate file is uploaded", async () => {
        const req = createMockRequest({
          file: undefined,
        });

        const res = createMockResponse();

        await instructorRouteHandlers.bulkImport(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith({ message: "No CSV file uploaded" });
      });
    });

    describe("instructorDashboard validation", () => {
      test("should validate user authentication", async () => {
        const req = createMockRequest({
          user: undefined,
        });

        const res = createMockResponse();

        await instructorRouteHandlers.instructorDashboard(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.send).toHaveBeenCalledWith({ message: "User not authenticated" });
        expect(mockInstructorService.instructorDashboard).not.toHaveBeenCalled();
      });
    });
  });
});
