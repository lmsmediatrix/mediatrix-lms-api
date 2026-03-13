import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { Response } from "express";
import { CustomRequest } from "../../type/types";
import attendanceService from "../../services/attendanceService";
import activityLogService from "../../services/activityLogService";
import auditLogService from "../../services/auditLogService";
import { IAttendance } from "../../models/attendanceModel";
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

import * as attendanceRouteHandlers from "../../routes/attendanceRoute";

jest.mock("../../services/attendanceService");
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

const mockAttendanceService = attendanceService as jest.Mocked<typeof attendanceService>;
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
    path: "/api/attendance/test",
    method: "GET",
    originalUrl: "/api/attendance/test",
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

describe("Attendance Route Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAttendances", () => {
    test("should get all attendance records successfully", async () => {
      const mockAttendanceRecords = [
        {
          _id: "attendance1",
          section: "sectionId1",
          userId: "studentId1",
          userType: "student",
          date: new Date(),
          status: "present",
        } as unknown as IAttendance,
        {
          _id: "attendance2",
          section: "sectionId1",
          userId: "studentId2",
          userType: "student",
          date: new Date(),
          status: "absent",
        } as unknown as IAttendance,
      ];

      const mockPagination = {
        totalItems: 2,
        totalPages: 1,
        currentPage: 1,
        pageSize: 10,
      };

      mockAttendanceService.getAttendances.mockResolvedValue({
        attendances: mockAttendanceRecords,
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

      await attendanceRouteHandlers.getAttendances(req, res);

      expect(mockAttendanceService.getAttendances).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        attendances: mockAttendanceRecords,
        pagination: mockPagination,
        count: 2,
      });
    });
  });

  describe("getAttendance", () => {
    test("should get an attendance record by ID successfully", async () => {
      const attendanceId = "mockAttendanceId";
      const mockAttendance = {
        _id: attendanceId,
        section: "sectionId1",
        userId: "studentId1",
        userType: "student",
        date: new Date(),
        status: "present",
      };

      mockAttendanceService.getAttendance.mockResolvedValue(
        mockAttendance as unknown as IAttendance
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: attendanceId },
      });

      const res = createMockResponse();

      await attendanceRouteHandlers.getAttendance(req, res);

      expect(mockAttendanceService.getAttendance).toHaveBeenCalledWith(
        attendanceId,
        expect.any(Object)
      );
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockAttendance);
    });
  });

  describe("createAttendance", () => {
    test("should create an attendance record successfully", async () => {
      const mockAttendanceData = {
        section: "sectionId1",
      };

      const mockCreatedAttendance = {
        _id: "newAttendanceId",
        section: "sectionId1",
        userId: "mockUserId",
        userType: "instructor",
        date: new Date(),
        status: "present",
      };

      mockAttendanceService.createAttendance.mockResolvedValue(
        mockCreatedAttendance as unknown as IAttendance
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockAttendanceData,
      });

      const res = createMockResponse();

      await attendanceRouteHandlers.createAttendance(req, res);

      expect(mockAttendanceService.createAttendance).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockCreatedAttendance);
    });
  });

  describe("updateAttendance", () => {
    test("should update an attendance record successfully", async () => {
      const attendanceId = "existingAttendanceId";
      const mockUpdateData = {
        _id: attendanceId,
        status: "late",
        remarks: "Student arrived 15 minutes late",
      };

      const mockUpdatedAttendance = {
        _id: attendanceId,
        section: "sectionId1",
        userId: "studentId1",
        userType: "student",
        date: new Date(),
        status: "late",
        remarks: "Student arrived 15 minutes late",
      };

      mockAttendanceService.updateAttendance.mockResolvedValue(
        mockUpdatedAttendance as unknown as IAttendance
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockUpdateData,
      });

      const res = createMockResponse();

      await attendanceRouteHandlers.updateAttendance(req, res);

      expect(mockAttendanceService.updateAttendance).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockUpdatedAttendance);
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
              case "getAttendance":
                requestPayload = { params: { id: "attendanceId" } };
                break;
              case "updateAttendance":
                requestPayload = { body: { _id: "attendanceId" } };
                break;
              case "deleteAttendance":
                requestPayload = { params: { id: "attendanceId" } };
                break;
              case "searchAttendance":
                requestPayload = { body: { query: { status: "present" } } };
                break;
              case "getStudentAttendance":
                requestPayload = { params: { studentId: "studentId" } };
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

    testRoleAccess("getAttendances", ACTION.GET_ALL, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
    ]);

    testRoleAccess("getAttendance", ACTION.GET_BY_ID, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
    ]);

    testRoleAccess("createAttendance", ACTION.CREATE, [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR]);

    testRoleAccess("updateAttendance", ACTION.UPDATE, [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR]);

    testRoleAccess("deleteAttendance", ACTION.DELETE, [USER_ROLES.ADMIN]);

    testRoleAccess("searchAttendance", ACTION.SEARCH, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
    ]);

    testRoleAccess("getStudentAttendance", ACTION.CUSTOM, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.STUDENT,
    ]);

    describe("Custom role combinations", () => {
      describe("Instructor marking attendance permissions", () => {
        const instructorMarkingMiddleware = validatePermissions(
          [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR],
          ACTION.CUSTOM
        );

        test("ADMIN and INSTRUCTOR should have access", () => {
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

            instructorMarkingMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
          });
        });

        test("Other roles should NOT have access", () => {
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

            instructorMarkingMiddleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
          });
        });
      });

      describe("Student viewing own attendance permissions", () => {
        const studentViewOwnAttendanceMiddleware = validatePermissions(
          [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR, USER_ROLES.STUDENT],
          ACTION.CUSTOM
        );

        test("ADMIN, INSTRUCTOR, and STUDENT should have access", () => {
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

            studentViewOwnAttendanceMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
          });
        });

        test("Other roles should NOT have access", () => {
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

            studentViewOwnAttendanceMiddleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
          });
        });
      });

      describe("Admin-only permissions", () => {
        const adminOnlyMiddleware = validatePermissions([USER_ROLES.ADMIN], ACTION.CUSTOM);

        test("ADMIN should have access", () => {
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

        test("Other roles should NOT have access", () => {
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

  describe("Attendance Zod Validation", () => {
    describe("createAttendance validation", () => {
      test("should validate required fields", async () => {
        const invalidData = {};

        mockAttendanceService.createAttendance.mockImplementation(() => {
          throw new Error("Validation error");
        });

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        await attendanceRouteHandlers.createAttendance(req, res);

        expect(res.status).not.toHaveBeenCalledWith(200);
        expect(mockAttendanceService.createAttendance).not.toHaveBeenCalled();
      });

      test("should validate section ID format", async () => {
        const invalidData = {
          section: "",
        };

        mockAttendanceService.createAttendance.mockImplementation(() => {
          throw new Error("Validation error");
        });

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        await attendanceRouteHandlers.createAttendance(req, res);

        expect(res.status).not.toHaveBeenCalledWith(200);
        expect(mockAttendanceService.createAttendance).not.toHaveBeenCalled();
      });

      test("should handle missing user information", async () => {
        const validData = {
          section: "validSectionId",
        };

        const req = createMockRequest({
          body: validData,
          user: undefined,
        });

        const res = createMockResponse();

        await attendanceRouteHandlers.createAttendance(req, res);

        expect(res.status).not.toHaveBeenCalledWith(200);
        expect(mockAttendanceService.createAttendance).not.toHaveBeenCalled();
      });
    });

    describe("updateAttendance validation", () => {
      test("should validate that _id is provided", async () => {
        const invalidData = {
          status: "present",
          remarks: "Attended class",
        };

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        await attendanceRouteHandlers.updateAttendance(req, res);

        expect(res.status).not.toHaveBeenCalledWith(200);
        expect(mockAttendanceService.updateAttendance).not.toHaveBeenCalled();
      });

      test("should validate status field values", async () => {
        const invalidData = {
          _id: "attendanceId",
          status: "invalid_status",
        };

        mockAttendanceService.updateAttendance.mockImplementation(() => {
          throw new Error("Validation error");
        });

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        await attendanceRouteHandlers.updateAttendance(req, res);

        expect(res.status).not.toHaveBeenCalledWith(200);
      });
    });

    describe("getAttendance validation", () => {
      test("should validate id parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        await attendanceRouteHandlers.getAttendance(req, res);

        expect(res.status).not.toHaveBeenCalledWith(200);
        expect(mockAttendanceService.getAttendance).not.toHaveBeenCalled();
      });
    });

    describe("deleteAttendance validation", () => {
      test("should validate id parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        await attendanceRouteHandlers.deleteAttendance(req, res);

        expect(res.status).not.toHaveBeenCalledWith(200);
        expect(mockAttendanceService.deleteAttendance).not.toHaveBeenCalled();
      });
    });

    describe("searchAttendance validation", () => {
      test("should validate search query format", async () => {
        const invalidQuery = {
          invalidField: "test",
        };

        mockAttendanceService.searchAttendance.mockImplementation(() => {
          throw new Error("Validation error");
        });

        const req = createMockRequest({
          body: invalidQuery,
        });

        const res = createMockResponse();

        await attendanceRouteHandlers.searchAttendance(req, res);

        expect(res.status).not.toHaveBeenCalledWith(200);
      });
    });

    describe("getStudentAttendance validation", () => {
      test("should validate student ID parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        await attendanceRouteHandlers.getStudentAttendance(req, res);

        expect(res.status).not.toHaveBeenCalledWith(200);
        expect(mockAttendanceService.getStudentAttendance).not.toHaveBeenCalled();
      });

      test("should validate date format in query", async () => {
        const req = createMockRequest({
          params: { studentId: "validStudentId" },
          query: {
            date: "invalid-date",
          },
        });

        mockAttendanceService.getStudentAttendance.mockImplementation(() => {
          throw new Error("Validation error");
        });

        const res = createMockResponse();

        await attendanceRouteHandlers.getStudentAttendance(req, res);

        expect(res.status).not.toHaveBeenCalledWith(200);
      });
    });
  });
});
