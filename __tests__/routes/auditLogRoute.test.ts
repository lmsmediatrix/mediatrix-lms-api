import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { Response } from "express";
import { CustomRequest } from "../../type/types";
import auditLogService from "../../services/auditLogService";
import { IAuditLog } from "../../models/auditLogModel";
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

import * as auditLogRouteHandlers from "../../routes/auditLogRoute";

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
    path: "/api/audit-log/test",
    method: "GET",
    originalUrl: "/api/audit-log/test",
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

describe("Audit Log Route Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAuditLogs", () => {
    test("should get all audit logs successfully", async () => {
      const mockAuditLogs = [
        {
          _id: "auditLog1",
          user: "userId1",
          type: "CREATE",
          severity: "INFO",
          entity: { type: "USER", id: "entityId1" },
          timestamp: new Date(),
        } as unknown as IAuditLog,
        {
          _id: "auditLog2",
          user: "userId2",
          type: "UPDATE",
          severity: "INFO",
          entity: { type: "COURSE", id: "entityId2" },
          timestamp: new Date(),
        } as unknown as IAuditLog,
      ];

      const mockPagination = {
        totalItems: 2,
        totalPages: 1,
        currentPage: 1,
        pageSize: 10,
      };

      mockAuditLogService.getAuditLogs.mockResolvedValue({
        auditLogs: mockAuditLogs,
        pagination: mockPagination,
        count: 2,
      });

      const req = createMockRequest({
        query: {
          limit: "10",
          page: "1",
          pagination: "true",
          count: "true",
        },
      });

      const res = createMockResponse();

      await auditLogRouteHandlers.getAuditLogs(req, res);

      expect(mockAuditLogService.getAuditLogs).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        auditLogs: mockAuditLogs,
        pagination: mockPagination,
        count: 2,
      });
    });
  });

  describe("getAuditLog", () => {
    test("should get an audit log by ID successfully", async () => {
      const auditLogId = "mockAuditLogId";
      const mockAuditLog = {
        _id: auditLogId,
        user: "userId1",
        type: "CREATE",
        severity: "INFO",
        entity: { type: "USER", id: "entityId1" },
        timestamp: new Date(),
      };

      mockAuditLogService.getAuditLog.mockResolvedValue(mockAuditLog as unknown as IAuditLog);

      const req = createMockRequest({
        params: { id: auditLogId },
      });

      const res = createMockResponse();

      await auditLogRouteHandlers.getAuditLog(req, res);

      expect(mockAuditLogService.getAuditLog).toHaveBeenCalledWith(auditLogId, expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockAuditLog);
    });

    test("should return 404 when audit log is not found", async () => {
      const auditLogId = "nonExistentAuditLogId";
      mockAuditLogService.getAuditLog.mockResolvedValue(null);

      const req = createMockRequest({
        params: { id: auditLogId },
      });

      const res = createMockResponse();

      await auditLogRouteHandlers.getAuditLog(req, res);

      expect(mockAuditLogService.getAuditLog).toHaveBeenCalledWith(auditLogId, expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("createAuditLog", () => {
    test("should create an audit log successfully", async () => {
      const mockAuditLogData = {
        user: "userId1",
        type: "CREATE",
        severity: "INFO",
        entity: { type: "USER", id: "entityId1" },
      };

      const mockCreatedAuditLog = {
        _id: "newAuditLogId",
        ...mockAuditLogData,
        timestamp: new Date(),
      };

      mockAuditLogService.createAuditLog.mockResolvedValue(
        mockCreatedAuditLog as unknown as IAuditLog
      );

      const req = createMockRequest({
        body: mockAuditLogData,
      });

      const res = createMockResponse();

      await auditLogRouteHandlers.createAuditLog(req, res);

      expect(mockAuditLogService.createAuditLog).toHaveBeenCalledWith(mockAuditLogData);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send).toHaveBeenCalledWith(mockCreatedAuditLog);
    });
  });

  describe("updateAuditLog", () => {
    test("should update an audit log successfully", async () => {
      const auditLogId = "existingAuditLogId";
      const mockUpdateData = {
        _id: auditLogId,
        severity: "WARNING",
        description: "Updated audit log description",
      };

      const mockUpdatedAuditLog = {
        _id: auditLogId,
        user: "userId1",
        type: "UPDATE",
        severity: "WARNING",
        entity: { type: "USER", id: "entityId1" },
        description: "Updated audit log description",
        timestamp: new Date(),
      };

      mockAuditLogService.updateAuditLog.mockResolvedValue(
        mockUpdatedAuditLog as unknown as IAuditLog
      );

      const req = createMockRequest({
        body: mockUpdateData,
      });

      const res = createMockResponse();

      await auditLogRouteHandlers.updateAuditLog(req, res);

      expect(mockAuditLogService.updateAuditLog).toHaveBeenCalledWith(mockUpdateData);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockUpdatedAuditLog);
    });

    test("should return 404 when audit log to update is not found", async () => {
      const auditLogId = "nonExistentAuditLogId";
      const mockUpdateData = {
        _id: auditLogId,
        severity: "WARNING",
      };

      mockAuditLogService.updateAuditLog.mockResolvedValue(null);

      const req = createMockRequest({
        body: mockUpdateData,
      });

      const res = createMockResponse();

      await auditLogRouteHandlers.updateAuditLog(req, res);

      expect(mockAuditLogService.updateAuditLog).toHaveBeenCalledWith(mockUpdateData);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("deleteAuditLog", () => {
    test("should delete an audit log successfully", async () => {
      const auditLogId = "existingAuditLogId";

      const mockDeletedAuditLog = {
        _id: auditLogId,
        user: "userId1",
        type: "DELETE",
        severity: "INFO",
        entity: { type: "USER", id: "entityId1" },
        timestamp: new Date(),
      };

      mockAuditLogService.deleteAuditLog.mockResolvedValue(
        mockDeletedAuditLog as unknown as IAuditLog
      );

      const req = createMockRequest({
        params: { id: auditLogId },
      });

      const res = createMockResponse();

      await auditLogRouteHandlers.deleteAuditLog(req, res);

      expect(mockAuditLogService.deleteAuditLog).toHaveBeenCalledWith(auditLogId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({ message: "Audit log deleted successfully" });
    });

    test("should return 404 when audit log to delete is not found", async () => {
      const auditLogId = "nonExistentAuditLogId";

      mockAuditLogService.deleteAuditLog.mockResolvedValue(null);

      const req = createMockRequest({
        params: { id: auditLogId },
      });

      const res = createMockResponse();

      await auditLogRouteHandlers.deleteAuditLog(req, res);

      expect(mockAuditLogService.deleteAuditLog).toHaveBeenCalledWith(auditLogId);
      expect(res.status).toHaveBeenCalledWith(404);
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
              case "getAuditLog":
                requestPayload = { params: { id: "auditLogId" } };
                break;
              case "createAuditLog":
                requestPayload = {
                  body: {
                    user: "userId",
                    type: "CREATE",
                    severity: "INFO",
                    entity: { type: "USER", id: "entityId" },
                  },
                };
                break;
              case "updateAuditLog":
                requestPayload = {
                  body: {
                    _id: "auditLogId",
                    type: "UPDATE",
                  },
                };
                break;
              case "deleteAuditLog":
                requestPayload = { params: { id: "auditLogId" } };
                break;
              case "searchAuditLog":
                requestPayload = { body: { query: { type: "CREATE" } } };
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

    testRoleAccess("getAuditLogs", ACTION.GET_ALL, [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]);

    testRoleAccess("getAuditLog", ACTION.GET_BY_ID, [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]);

    testRoleAccess("createAuditLog", ACTION.CREATE, [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]);

    testRoleAccess("updateAuditLog", ACTION.UPDATE, [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]);

    testRoleAccess("deleteAuditLog", ACTION.DELETE, [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]);

    testRoleAccess("searchAuditLog", ACTION.SEARCH, [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]);

    describe("Admin-only Security Operations", () => {
      describe("Audit log security", () => {
        test("Should restrict all audit log operations to admin and superadmin only", () => {
          const sensitiveRoles = [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN];

          const nonSensitiveRoles = [
            USER_ROLES.INSTRUCTOR,
            USER_ROLES.STUDENT,
            USER_ROLES.EMPLOYEE,
            USER_ROLES.USER,
            USER_ROLES.VIEW,
          ];

          const adminOnlyMiddleware = validatePermissions(sensitiveRoles, ACTION.CUSTOM);

          sensitiveRoles.forEach((role) => {
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
            expect(next).toHaveBeenCalled();
          });

          nonSensitiveRoles.forEach((role) => {
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

      describe("Super Admin vs Admin permissions", () => {
        test("Both super admin and admin should have equal access to audit logs", () => {
          const middleware = validatePermissions(
            [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN],
            ACTION.CUSTOM
          );

          const adminReq = createMockRequest({
            user: {
              id: "adminId",
              email: "admin@example.com",
              organizationId: "orgId",
              role: USER_ROLES.ADMIN,
              firstName: "",
              lastName: "",
            },
          });

          const superAdminReq = createMockRequest({
            user: {
              id: "superAdminId",
              email: "superadmin@example.com",
              organizationId: "orgId",
              role: USER_ROLES.SUPERADMIN,
              firstName: "",
              lastName: "",
            },
          });

          const res = createMockResponse();
          const next = jest.fn();

          middleware(adminReq, res, next);
          expect(next).toHaveBeenCalled();
          next.mockClear();

          middleware(superAdminReq, res, next);
          expect(next).toHaveBeenCalled();
        });
      });
    });
  });

  describe("Audit Log Zod Validation", () => {
    describe("createAuditLog validation", () => {
      test("should validate required fields", async () => {
        const invalidData = {
          description: "Invalid audit log",
        };

        const mockZodError = new Error("Validation error");
        mockZodError.name = "ZodError";

        mockAuditLogService.createAuditLog.mockImplementation(() => {
          throw new Error("Service should not be called due to validation failure");
        });

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        await auditLogRouteHandlers.createAuditLog(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      test("should validate entity structure", async () => {
        const invalidData = {
          user: "userId",
          type: "CREATE",
          entity: {
            type: "USER",
          },
          severity: "INFO",
        };

        const mockZodError = new Error("Validation error");
        mockZodError.name = "ZodError";

        mockAuditLogService.createAuditLog.mockImplementation(() => {
          throw new Error("Service should not be called due to validation failure");
        });

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

        await auditLogRouteHandlers.createAuditLog(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      test("should validate enum values", async () => {
        const invalidData = {
          user: "userId",
          type: "INVALID_TYPE",
          entity: {
            type: "INVALID_ENTITY",
            id: "entityId",
          },
          severity: "INVALID_SEVERITY",
        };

        const mockZodError = new Error("Validation error");
        mockZodError.name = "ZodError";

        mockAuditLogService.createAuditLog.mockImplementation(() => {
          throw new Error("Service should not be called due to validation failure");
        });

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

        await auditLogRouteHandlers.createAuditLog(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe("updateAuditLog validation", () => {
      test("should validate that _id is provided", async () => {
        const invalidData = {
          type: "UPDATE",
          description: "Updated audit log",
        };

        const mockZodError = new Error("Validation error");
        mockZodError.name = "ZodError";

        mockAuditLogService.updateAuditLog.mockImplementation(() => {
          throw new Error("Service should not be called due to validation failure");
        });

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

        await auditLogRouteHandlers.updateAuditLog(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe("getAuditLog validation", () => {
      test("should validate id parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        await auditLogRouteHandlers.getAuditLog(req, res);

        expect(res.status).not.toHaveBeenCalledWith(200);
        expect(mockAuditLogService.getAuditLog).not.toHaveBeenCalled();
      });

      test("should validate id format", async () => {
        const req = createMockRequest({
          params: { id: "" },
        });

        const res = createMockResponse();

        await auditLogRouteHandlers.getAuditLog(req, res);

        expect(res.status).not.toHaveBeenCalledWith(200);
        expect(mockAuditLogService.getAuditLog).not.toHaveBeenCalled();
      });
    });

    describe("deleteAuditLog validation", () => {
      test("should validate id parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        await auditLogRouteHandlers.deleteAuditLog(req, res);

        expect(res.status).not.toHaveBeenCalledWith(200);
        expect(mockAuditLogService.deleteAuditLog).not.toHaveBeenCalled();
      });

      test("should validate id format", async () => {
        const req = createMockRequest({
          params: { id: "" },
        });

        const res = createMockResponse();

        await auditLogRouteHandlers.deleteAuditLog(req, res);

        expect(res.status).not.toHaveBeenCalledWith(200);
        expect(mockAuditLogService.deleteAuditLog).not.toHaveBeenCalled();
      });
    });

    describe("searchAuditLog validation", () => {
      test("should validate search query format", async () => {
        const invalidQuery = {
          invalidField: "test",
        };

        mockAuditLogService.searchAuditLog.mockImplementation(() => {
          throw new Error("Validation error");
        });

        const req = createMockRequest({
          body: invalidQuery,
        });

        const res = createMockResponse();

        await auditLogRouteHandlers.searchAuditLog(req, res);

        expect(res.status).not.toHaveBeenCalledWith(200);
      });

      test("should validate date range format in query", async () => {
        const invalidQuery = {
          query: {
            timestamp: {
              $gte: "invalid-date",
              $lte: "invalid-date",
            },
          },
        };

        mockAuditLogService.searchAuditLog.mockImplementation(() => {
          throw new Error("Validation error");
        });

        const req = createMockRequest({
          body: invalidQuery,
        });

        const res = createMockResponse();

        await auditLogRouteHandlers.searchAuditLog(req, res);

        expect(res.status).not.toHaveBeenCalledWith(200);
      });
    });
  });
});
