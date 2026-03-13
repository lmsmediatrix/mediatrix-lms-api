import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { Response } from "express";
import { CustomRequest } from "../../type/types";
import programService from "../../services/programService";
import activityLogService from "../../services/activityLogService";
import auditLogService from "../../services/auditLogService";
import { IProgram } from "../../models/programModel";
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

jest.mock("../../utils/formDataUtils", () => ({
  processNestedFormData: jest.fn().mockImplementation((data) => data),
}));

import * as programRouteHandlers from "../../routes/programRoute";

jest.mock("../../services/programService");
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

const mockProgramService = programService as jest.Mocked<typeof programService>;
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
    path: "/api/program/test",
    method: "GET",
    originalUrl: "/api/program/test",
    ip: "127.0.0.1",
    get: jest.fn().mockReturnValue("test-user-agent"),
    files: {},
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

describe("Program Route Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getPrograms", () => {
    test("should get all programs successfully", async () => {
      const mockPrograms = [
        {
          _id: "prog1",
          name: "Test Program 1",
          description: "Description for Program 1",
          code: "PRG001",
          organizationId: "org1",
        } as unknown as IProgram,
        {
          _id: "prog2",
          name: "Test Program 2",
          description: "Description for Program 2",
          code: "PRG002",
          organizationId: "org2",
        } as unknown as IProgram,
      ];

      const mockPagination = {
        totalItems: 2,
        totalPages: 1,
        currentPage: 1,
        pageSize: 10,
      };

      mockProgramService.getPrograms.mockResolvedValue({
        programs: mockPrograms,
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

      await programRouteHandlers.getPrograms(req, res);

      expect(mockProgramService.getPrograms).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockPrograms,
        pagination: mockPagination,
        count: 2,
      });
    });
  });

  describe("getProgram", () => {
    test("should get a program by ID successfully", async () => {
      const progId = "mockProgramId";
      const mockProgram = {
        _id: progId,
        name: "Test Program",
        description: "Description for Test Program",
        code: "PRG001",
        organizationId: "org1",
      };

      mockProgramService.getProgram.mockResolvedValue(mockProgram as unknown as IProgram);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: progId },
      });

      const res = createMockResponse();

      await programRouteHandlers.getProgram(req, res);

      expect(mockProgramService.getProgram).toHaveBeenCalledWith(progId, expect.any(Object));
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockProgram);
    });
  });

  describe("createProgram", () => {
    test("should create a program successfully", async () => {
      const mockProgramData = {
        name: "New Program",
        description: "A brand new program",
        code: "PRG003",
        organizationId: "org1",
      };

      const mockCreatedProgram = {
        _id: "newProgramId",
        ...mockProgramData,
      };

      mockProgramService.createProgram.mockResolvedValue(mockCreatedProgram as unknown as IProgram);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockProgramData,
      });

      const res = createMockResponse();

      await programRouteHandlers.createProgram(req, res);

      expect(mockProgramService.createProgram).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockCreatedProgram);
    });
  });

  describe("updateProgram", () => {
    test("should update a program successfully", async () => {
      const progId = "existingProgramId";
      const mockUpdateData = {
        _id: progId,
        name: "Updated Program",
        description: "Updated description",
      };

      const mockCurrentProgram = {
        _id: progId,
        name: "Original Program",
        description: "Original description",
        code: "PRG001",
        organizationId: "org1",
      };

      mockProgramService.getProgram.mockResolvedValue(mockCurrentProgram as unknown as IProgram);
      mockProgramService.updateProgram.mockResolvedValue({
        ...mockCurrentProgram,
        ...mockUpdateData,
      } as unknown as IProgram);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: {
          _id: progId,
          name: "Updated Program",
          description: "Updated description",
        },
      });

      const res = createMockResponse();

      await programRouteHandlers.updateProgram(req, res);

      expect(mockProgramService.getProgram).toHaveBeenCalled();
      expect(mockProgramService.updateProgram).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        ...mockCurrentProgram,
        ...mockUpdateData,
      });
    });
  });

  describe("deleteProgram", () => {
    test("should delete a program successfully", async () => {
      const progId = "programToDeleteId";
      const mockCurrentProgram = {
        _id: progId,
        name: "Program to Delete",
        code: "PRG001",
        organizationId: "org1",
      };

      mockProgramService.getProgram.mockResolvedValue(mockCurrentProgram as unknown as IProgram);
      mockProgramService.deleteProgram.mockResolvedValue({} as unknown as any);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: progId },
      });

      const res = createMockResponse();

      await programRouteHandlers.deleteProgram(req, res);

      expect(mockProgramService.getProgram).toHaveBeenCalledWith(progId, expect.any(Object));
      expect(mockProgramService.deleteProgram).toHaveBeenCalledWith(progId);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({});
    });
  });

  describe("searchProgram", () => {
    test("should search programs successfully", async () => {
      const searchQuery = {
        query: {
          name: "Test",
        },
      };

      const searchResults = [
        {
          _id: "prog1",
          name: "Test Program 1",
          description: "First test program",
        },
        {
          _id: "prog2",
          name: "Test Program 2",
          description: "Second test program",
        },
      ];

      mockProgramService.searchProgram.mockResolvedValue(searchResults);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: searchQuery,
      });

      const res = createMockResponse();

      await programRouteHandlers.searchProgram(req, res);

      expect(mockProgramService.searchProgram).toHaveBeenCalledWith(searchQuery);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(searchResults);
    });
  });

  describe("Program Zod Validation", () => {
    describe("createProgram validation", () => {
      test("should validate required fields", async () => {
        const invalidData = {
          description: "A program without a name",
          duration: 12,
        };

        mockProgramService.createProgram.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalCreateProgram = programRouteHandlers.createProgram;
        jest.spyOn(programRouteHandlers, "createProgram").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await programRouteHandlers.createProgram(req, res);

        expect(mockProgramService.createProgram).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest.spyOn(programRouteHandlers, "createProgram").mockImplementation(originalCreateProgram);
      });

      test("should validate field formats", async () => {
        const invalidData = {
          name: "A",
          description: "",
          duration: -1,
        };

        mockProgramService.createProgram.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalCreateProgram = programRouteHandlers.createProgram;
        jest.spyOn(programRouteHandlers, "createProgram").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await programRouteHandlers.createProgram(req, res);

        expect(mockProgramService.createProgram).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest.spyOn(programRouteHandlers, "createProgram").mockImplementation(originalCreateProgram);
      });

      test("should validate academic year structure", async () => {
        const invalidData = {
          name: "Valid Program Name",
          description: "Valid description",
          duration: 3,
          academicYear: [
            {
              yearLevel: 0,
              semesters: [
                {
                  semesterNo: 4,
                  courses: ["course1"],
                },
              ],
            },
          ],
        };

        mockProgramService.createProgram.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalCreateProgram = programRouteHandlers.createProgram;
        jest.spyOn(programRouteHandlers, "createProgram").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await programRouteHandlers.createProgram(req, res);

        expect(mockProgramService.createProgram).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest.spyOn(programRouteHandlers, "createProgram").mockImplementation(originalCreateProgram);
      });

      test("should handle missing user information", async () => {
        const validData = {
          name: "Valid Program",
          description: "A valid program description",
          duration: 4,
        };

        mockProgramService.createProgram.mockReset();

        const req = createMockRequest({
          body: validData,
          user: undefined,
        });

        const res = createMockResponse();

        const next = jest.fn();
        const middleware = validatePermissions(
          [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN, USER_ROLES.INSTRUCTOR],
          ACTION.CREATE
        );

        middleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "Not authenticated" });
        expect(mockProgramService.createProgram).not.toHaveBeenCalled();
      });
    });

    describe("updateProgram validation", () => {
      test("should validate that _id is provided", async () => {
        const invalidData = {
          name: "Updated Program",
          description: "Updated description",
        };

        mockProgramService.updateProgram.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalUpdateProgram = programRouteHandlers.updateProgram;
        jest.spyOn(programRouteHandlers, "updateProgram").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await programRouteHandlers.updateProgram(req, res);

        expect(mockProgramService.updateProgram).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest.spyOn(programRouteHandlers, "updateProgram").mockImplementation(originalUpdateProgram);
      });

      test("should validate field formats in update", async () => {
        const invalidData = {
          _id: "programId",
          name: "",
          description: "",
          duration: 0,
        };

        mockProgramService.updateProgram.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalUpdateProgram = programRouteHandlers.updateProgram;
        jest.spyOn(programRouteHandlers, "updateProgram").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await programRouteHandlers.updateProgram(req, res);

        expect(mockProgramService.updateProgram).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest.spyOn(programRouteHandlers, "updateProgram").mockImplementation(originalUpdateProgram);
      });
    });

    describe("deleteProgram validation", () => {
      test("should validate id parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        const originalDeleteProgram = programRouteHandlers.deleteProgram;
        jest.spyOn(programRouteHandlers, "deleteProgram").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await programRouteHandlers.deleteProgram(req, res);

        expect(mockProgramService.deleteProgram).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest.spyOn(programRouteHandlers, "deleteProgram").mockImplementation(originalDeleteProgram);
      });

      test("should handle program not found", async () => {
        const programId = "nonExistentProgramId";

        mockProgramService.getProgram.mockResolvedValue(null);

        const originalDeleteProgram = programRouteHandlers.deleteProgram;
        jest.spyOn(programRouteHandlers, "deleteProgram").mockImplementation(async (_req, res) => {
          res.status(404).send({ message: "Program not found" });
          return;
        });

        const req = createMockRequest({
          params: { id: programId },
        });

        const res = createMockResponse();

        await programRouteHandlers.deleteProgram(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.send).toHaveBeenCalledWith({ message: "Program not found" });

        jest.spyOn(programRouteHandlers, "deleteProgram").mockImplementation(originalDeleteProgram);
      });
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
              case "getProgram":
                requestPayload = { params: { id: "progId" } };
                break;
              case "updateProgram":
                requestPayload = {
                  body: {
                    _id: "progId",
                    name: "Updated Program",
                    description: "Updated description",
                  },
                };
                break;
              case "deleteProgram":
                requestPayload = { params: { id: "progId" } };
                break;
              case "searchProgram":
                requestPayload = {
                  body: {
                    query: {
                      name: "Test",
                    },
                  },
                };
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

    testRoleAccess("getPrograms", ACTION.GET_ALL, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.VIEW,
    ]);

    testRoleAccess("getProgram", ACTION.GET_BY_ID, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.VIEW,
    ]);

    testRoleAccess("createProgram", ACTION.CREATE, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
    ]);

    testRoleAccess("updateProgram", ACTION.UPDATE, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
    ]);

    testRoleAccess("deleteProgram", ACTION.DELETE, [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]);

    testRoleAccess("searchProgram", ACTION.SEARCH, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.VIEW,
    ]);

    describe("Special program permission scenarios", () => {
      describe("Program creation permissions", () => {
        const createProgramMiddleware = validatePermissions(
          [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN, USER_ROLES.INSTRUCTOR],
          ACTION.CREATE
        );

        test("Admins, SuperAdmins, and Instructors should be able to create programs", () => {
          const roles = [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN, USER_ROLES.INSTRUCTOR];

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
              body: {
                name: "New Program",
                description: "A new test program",
                code: "PRG001",
                organizationId: "org1",
              },
            });

            const res = createMockResponse();
            const next = jest.fn();

            createProgramMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
          });
        });

        test("Other roles should NOT be able to create programs", () => {
          const roles = [USER_ROLES.STUDENT, USER_ROLES.EMPLOYEE, USER_ROLES.USER, USER_ROLES.VIEW];

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
              body: {
                name: "Unauthorized Program",
                description: "A program created by unauthorized role",
                code: "PRG999",
              },
            });

            const res = createMockResponse();
            const next = jest.fn();

            createProgramMiddleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
          });
        });
      });

      describe("Program viewing permissions", () => {
        const viewProgramMiddleware = validatePermissions(
          [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN, USER_ROLES.INSTRUCTOR, USER_ROLES.VIEW],
          ACTION.GET_BY_ID
        );

        test("Admin, SuperAdmin, Instructor, and View roles should be able to view programs", () => {
          const roles = [
            USER_ROLES.ADMIN,
            USER_ROLES.SUPERADMIN,
            USER_ROLES.INSTRUCTOR,
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
              params: { id: "progToViewId" },
            });

            const res = createMockResponse();
            const next = jest.fn();

            viewProgramMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
          });
        });

        test("Other roles should NOT have default access to view programs", () => {
          const roles = [USER_ROLES.STUDENT, USER_ROLES.EMPLOYEE, USER_ROLES.USER];

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
              params: { id: "progToViewId" },
            });

            const res = createMockResponse();
            const next = jest.fn();

            viewProgramMiddleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
          });
        });
      });

      describe("Program deletion permissions", () => {
        const deleteProgramMiddleware = validatePermissions(
          [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN],
          ACTION.DELETE
        );

        test("Only Admin and SuperAdmin roles should be able to delete programs", () => {
          const roles = [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN];

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
              params: { id: "programToDeleteId" },
            });

            const res = createMockResponse();
            const next = jest.fn();

            deleteProgramMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
          });
        });

        test("Other roles including Instructors should NOT be able to delete programs", () => {
          const roles = [
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
              params: { id: "programToDeleteId" },
            });

            const res = createMockResponse();
            const next = jest.fn();

            deleteProgramMiddleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
          });
        });
      });
    });
  });
});
