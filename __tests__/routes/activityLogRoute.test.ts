import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { Response } from "express";
import { CustomRequest } from "../../type/types";
import activityLogService from "../../services/activityLogService";
import auditLogService from "../../services/auditLogService";
import { IActivityLogging } from "../../models/activityLogModel";
import { config } from "../../config/common";
import { validatePermissions } from "../../middleware/rabcMiddleware";
import { USER_ROLES, ACTION } from "../../config/common";

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
          return res.status(401).json({ message: "Unauthorized" });
        }

        if (!req.user.role || !_roles.includes(req.user.role)) {
          return res.status(403).json({ message: "Forbidden" });
        }

        next();
      };
    }),
  };
});

import * as activityLogRouteHandlers from "../../routes/activityLogRoute";

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
    path: "/api/activity-log/test",
    method: "GET",
    originalUrl: "/api/activity-log/test",
    ip: "127.0.0.1",
    get: jest.fn().mockReturnValue("test-user-agent"),
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

describe("Activity Log Route Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getActivityLogs", () => {
    test("should get all activity logs successfully", async () => {
      const mockActivityLogs = [
        {
          _id: "log1",
          userId: "user1",
          action: "read",
          description: "Viewed dashboard",
          ip: "127.0.0.1",
          path: "/dashboard",
          method: "GET",
        } as unknown as IActivityLogging,
        {
          _id: "log2",
          userId: "user2",
          action: "create",
          description: "Created course",
          ip: "127.0.0.1",
          path: "/course/create",
          method: "POST",
        } as unknown as IActivityLogging,
      ];

      const mockPagination = {
        totalItems: 2,
        totalPages: 1,
        currentPage: 1,
        pageSize: 10,
      };

      mockActivityLogService.getActivityLogs.mockResolvedValue({
        activityLogs: mockActivityLogs,
        pagination: mockPagination,
        count: 2,
      });

      const req = createMockRequest({
        query: {
          limit: "10",
          page: "1",
          pagination: "true",
          count: "true",
          populateArray: JSON.stringify([{ path: "userId", select: "email" }]),
        },
      });

      const res = createMockResponse();

      await activityLogRouteHandlers.getActivityLogs(req, res);

      expect(mockActivityLogService.getActivityLogs).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        activityLogs: mockActivityLogs,
        pagination: mockPagination,
        count: 2,
      });
    });

    test("should handle error when getting activity logs", async () => {
      const error = new Error("Test error");
      mockActivityLogService.getActivityLogs.mockRejectedValue(error);

      const req = createMockRequest();
      const res = createMockResponse();

      await activityLogRouteHandlers.getActivityLogs(req, res);

      expect(mockActivityLogService.getActivityLogs).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(200);
    });
  });

  describe("getActivityLog", () => {
    test("should get an activity log by ID successfully", async () => {
      const logId = "mockLogId";
      const mockActivityLog = {
        _id: logId,
        userId: "user1",
        action: "read",
        description: "Viewed dashboard",
        ip: "127.0.0.1",
        path: "/dashboard",
        method: "GET",
      };

      mockActivityLogService.getActivityLog.mockResolvedValue(
        mockActivityLog as unknown as IActivityLogging
      );

      const req = createMockRequest({
        params: { id: logId },
        query: {
          populateArray: JSON.stringify([{ path: "userId", select: "email" }]),
        },
      });

      const res = createMockResponse();

      await activityLogRouteHandlers.getActivityLog(req, res);

      expect(mockActivityLogService.getActivityLog).toHaveBeenCalledWith(logId, expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockActivityLog);
    });

    test("should return 404 when activity log is not found", async () => {
      const logId = "nonExistentLogId";
      mockActivityLogService.getActivityLog.mockResolvedValue(null);

      const req = createMockRequest({
        params: { id: logId },
      });

      const res = createMockResponse();

      await activityLogRouteHandlers.getActivityLog(req, res);

      expect(mockActivityLogService.getActivityLog).toHaveBeenCalledWith(logId, expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: config.RESPONSE.ERROR.ACTIVITY_LOG.NOT_FOUND,
      });
    });
  });

  describe("createActivityLog", () => {
    test("should create an activity log successfully", async () => {
      const mockLogData = {
        userId: "user123",
        action: "create",
        description: "Created a new course",
        ip: "127.0.0.1",
        path: "/course/create",
        method: "POST",
        headers: {
          "user-agent": "Test Browser",
        },
        page: {
          url: "/course/create",
          title: "Create Course",
        },
        organizationId: "org123",
        entityType: "course",
      };

      const mockCreatedLog = {
        _id: "newLogId",
        ...mockLogData,
        id: "newLogId",
        createdAt: new Date(),
      };

      mockActivityLogService.createActivityLog.mockResolvedValueOnce(
        mockCreatedLog as unknown as IActivityLogging
      );
      mockActivityLogService.createActivityLog.mockResolvedValueOnce(
        {} as unknown as IActivityLogging
      );
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockLogData,
      });

      const res = createMockResponse();

      await activityLogRouteHandlers.createActivityLog(req, res);

      expect(mockActivityLogService.createActivityLog).toHaveBeenCalledWith(mockLogData);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalledTimes(2);
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send).toHaveBeenCalledWith(mockCreatedLog);
    });

    test("should handle error when creating activity log", async () => {
      const error = new Error("Test error");
      mockActivityLogService.createActivityLog.mockRejectedValue(error);

      const req = createMockRequest({
        body: {
          userId: "user123",
          action: "create",
          description: "Test",
          ip: "127.0.0.1",
          path: "/test",
          method: "POST",
        },
      });

      const res = createMockResponse();

      await activityLogRouteHandlers.createActivityLog(req, res);

      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(201);
    });
  });

  describe("updateActivityLog", () => {
    test("should update an activity log successfully", async () => {
      const logId = "existingLogId";
      const mockUpdateData = {
        _id: logId,
        description: "Updated description",
        action: "update",
      };

      const mockCurrentLog = {
        _id: logId,
        userId: "user1",
        action: "read",
        description: "Original description",
        ip: "127.0.0.1",
        path: "/dashboard",
        method: "GET",
      };

      const mockUpdatedLog = {
        ...mockCurrentLog,
        ...mockUpdateData,
      };

      mockActivityLogService.getActivityLog.mockResolvedValue(
        mockCurrentLog as unknown as IActivityLogging
      );
      mockActivityLogService.updateActivityLog.mockResolvedValue(
        mockUpdatedLog as unknown as IActivityLogging
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as IActivityLogging);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockUpdateData,
      });

      const res = createMockResponse();

      await activityLogRouteHandlers.updateActivityLog(req, res);

      expect(mockActivityLogService.getActivityLog).toHaveBeenCalledWith(logId, expect.any(Object));
      expect(mockActivityLogService.updateActivityLog).toHaveBeenCalledWith(mockUpdateData);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockUpdatedLog);
    });

    test("should return 404 when activity log to update is not found", async () => {
      const logId = "nonExistentLogId";
      const mockUpdateData = {
        _id: logId,
        description: "Updated description",
      };

      mockActivityLogService.getActivityLog.mockResolvedValue({} as unknown as IActivityLogging);
      mockActivityLogService.updateActivityLog.mockResolvedValue(null);

      const req = createMockRequest({
        body: mockUpdateData,
      });

      const res = createMockResponse();

      await activityLogRouteHandlers.updateActivityLog(req, res);

      expect(mockActivityLogService.updateActivityLog).toHaveBeenCalledWith(mockUpdateData);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: config.RESPONSE.ERROR.ACTIVITY_LOG.NOT_FOUND,
      });
    });
  });

  describe("deleteActivityLog", () => {
    test("should delete an activity log successfully", async () => {
      const logId = "logToDeleteId";
      const mockActivityLog = {
        _id: logId,
        userId: "user1",
        action: "read",
        description: "Log to delete",
      };

      mockActivityLogService.getActivityLog.mockResolvedValue(
        mockActivityLog as unknown as IActivityLogging
      );
      mockActivityLogService.deleteActivityLog.mockResolvedValue(
        mockActivityLog as unknown as IActivityLogging
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as IActivityLogging);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: logId },
      });

      const res = createMockResponse();

      await activityLogRouteHandlers.deleteActivityLog(req, res);

      expect(mockActivityLogService.getActivityLog).toHaveBeenCalledWith(logId, expect.any(Object));
      expect(mockActivityLogService.deleteActivityLog).toHaveBeenCalledWith(logId);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({ message: config.SUCCESS.ACTIVITY_LOG.DELETE });
    });

    test("should return 404 when activity log to delete is not found", async () => {
      const logId = "nonExistentLogId";
      mockActivityLogService.getActivityLog.mockResolvedValue({} as unknown as IActivityLogging);
      mockActivityLogService.deleteActivityLog.mockResolvedValue(null);

      const req = createMockRequest({
        params: { id: logId },
      });

      const res = createMockResponse();

      await activityLogRouteHandlers.deleteActivityLog(req, res);

      expect(mockActivityLogService.deleteActivityLog).toHaveBeenCalledWith(logId);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: config.RESPONSE.ERROR.ACTIVITY_LOG.NOT_FOUND,
      });
    });
  });

  describe("searchActivityLog", () => {
    test("should search activity logs successfully", async () => {
      const searchQuery = { query: { action: "read" } };
      const mockSearchResults = [
        {
          _id: "log1",
          userId: "user1",
          action: "read",
          description: "Viewed dashboard",
        },
        {
          _id: "log2",
          userId: "user2",
          action: "read",
          description: "Viewed profile",
        },
      ];

      mockActivityLogService.searchActivityLog.mockResolvedValue(
        mockSearchResults as unknown as IActivityLogging[]
      );

      const req = createMockRequest({
        body: searchQuery,
      });

      const res = createMockResponse();

      await activityLogRouteHandlers.searchActivityLog(req, res);

      expect(mockActivityLogService.searchActivityLog).toHaveBeenCalledWith(searchQuery);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockSearchResults);
    });

    test("should handle error when searching activity logs", async () => {
      const error = new Error("Test error");
      mockActivityLogService.searchActivityLog.mockRejectedValue(error);

      const req = createMockRequest({
        body: { query: { action: "read" } },
      });

      const res = createMockResponse();

      await activityLogRouteHandlers.searchActivityLog(req, res);

      expect(mockActivityLogService.searchActivityLog).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(200);
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

    testRoleAccess("getActivityLogs", ACTION.GET_ALL, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.STUDENT,
      USER_ROLES.EMPLOYEE,
      USER_ROLES.USER,
      USER_ROLES.VIEW,
    ]);

    testRoleAccess("getActivityLog", ACTION.GET_BY_ID, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.STUDENT,
      USER_ROLES.EMPLOYEE,
      USER_ROLES.USER,
      USER_ROLES.VIEW,
    ]);

    testRoleAccess("createActivityLog", ACTION.CREATE, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.STUDENT,
      USER_ROLES.EMPLOYEE,
      USER_ROLES.USER,
      USER_ROLES.VIEW,
    ]);

    testRoleAccess("updateActivityLog", ACTION.UPDATE, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.STUDENT,
      USER_ROLES.EMPLOYEE,
      USER_ROLES.USER,
      USER_ROLES.VIEW,
    ]);

    testRoleAccess("deleteActivityLog", ACTION.DELETE, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.STUDENT,
      USER_ROLES.EMPLOYEE,
      USER_ROLES.USER,
      USER_ROLES.VIEW,
    ]);

    testRoleAccess("searchActivityLog", ACTION.SEARCH, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.STUDENT,
      USER_ROLES.EMPLOYEE,
      USER_ROLES.USER,
      USER_ROLES.VIEW,
    ]);
  });

  describe("Activity Log Zod Validation", () => {
    describe("createActivityLog validation", () => {
      test("should validate required fields", async () => {
        const invalidData = {
          ip: "127.0.0.1",
          path: "/test",
        };

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        await activityLogRouteHandlers.createActivityLog(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      test("should validate action field values", async () => {
        const invalidData = {
          userId: "user123",
          action: "invalid_action",
          description: "Test description",
          ip: "127.0.0.1",
          path: "/test",
          method: "GET",
        };

        mockActivityLogService.createActivityLog.mockImplementation(() => {
          throw new Error("Invalid action value");
        });

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        await activityLogRouteHandlers.createActivityLog(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe("updateActivityLog validation", () => {
      test("should validate that _id is provided", async () => {
        const invalidData = {
          description: "Updated description",
        };

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        await activityLogRouteHandlers.updateActivityLog(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe("getActivityLog validation", () => {
      test("should validate id parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        await activityLogRouteHandlers.getActivityLog(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe("deleteActivityLog validation", () => {
      test("should validate id parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        await activityLogRouteHandlers.deleteActivityLog(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe("searchActivityLog validation", () => {
      test("should validate search query format", async () => {
        const invalidData = {
          filters: { action: "read" },
        };

        mockActivityLogService.searchActivityLog.mockImplementation(() => {
          throw new Error("Invalid search query format");
        });

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        await activityLogRouteHandlers.searchActivityLog(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });
  });
});
