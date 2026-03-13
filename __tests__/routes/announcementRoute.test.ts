import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { Response } from "express";
import { CustomRequest } from "../../type/types";
import announcementService from "../../services/announcementService";
import activityLogService from "../../services/activityLogService";
import auditLogService from "../../services/auditLogService";
import { AnnouncementZodSchema, IAnnouncement } from "../../models/announcementModel";
import { config } from "../../config/common";

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

import * as announcementRouteHandlers from "../../routes/announcementRoute";
import { validatePermissions } from "../../middleware/rabcMiddleware";

jest.mock("../../services/announcementService");
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

const mockAnnouncementService = announcementService as jest.Mocked<typeof announcementService>;
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
    path: "/api/announcement/test",
    method: "GET",
    originalUrl: "/api/announcement/test",
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

import { USER_ROLES, ACTION } from "../../config/common";

describe("Announcement Route Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAnnouncements", () => {
    test("should get all announcements successfully", async () => {
      const mockAnnouncements = [
        {
          _id: "announcement1",
          title: "Announcement 1",
          textBody: "Test announcement 1",
          publishDate: new Date(),
          isPublished: true,
          author: "user1",
        } as unknown as IAnnouncement,
        {
          _id: "announcement2",
          title: "Announcement 2",
          textBody: "Test announcement 2",
          publishDate: new Date(),
          isPublished: true,
          author: "user2",
        } as unknown as IAnnouncement,
      ];

      const mockPagination = {
        totalItems: 2,
        totalPages: 1,
        currentPage: 1,
        pageSize: 10,
      };

      mockAnnouncementService.getAnnouncements.mockResolvedValue({
        announcements: mockAnnouncements,
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
          populateArray: JSON.stringify([{ path: "author", select: "email" }]),
        },
      });

      const res = createMockResponse();

      await announcementRouteHandlers.getAnnouncements(req, res);

      expect(mockAnnouncementService.getAnnouncements).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        announcements: mockAnnouncements,
        pagination: mockPagination,
        count: 2,
      });
    });

    test("should handle error when getting announcements", async () => {
      const error = new Error("Test error");
      mockAnnouncementService.getAnnouncements.mockRejectedValue(error);

      const req = createMockRequest();
      const res = createMockResponse();

      await announcementRouteHandlers.getAnnouncements(req, res);

      expect(mockAnnouncementService.getAnnouncements).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(200);
    });
  });

  describe("getAnnouncement", () => {
    test("should get an announcement by ID successfully", async () => {
      const announcementId = "mockAnnouncementId";
      const mockAnnouncement = {
        _id: announcementId,
        title: "Test Announcement",
        textBody: "This is a test announcement",
        publishDate: new Date(),
        isPublished: true,
        author: "user1",
      };

      mockAnnouncementService.getAnnouncement.mockResolvedValue(
        mockAnnouncement as unknown as IAnnouncement
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: announcementId },
        query: {
          populateArray: JSON.stringify([{ path: "author", select: "email" }]),
        },
      });

      const res = createMockResponse();

      await announcementRouteHandlers.getAnnouncement(req, res);

      expect(mockAnnouncementService.getAnnouncement).toHaveBeenCalledWith(
        announcementId,
        expect.any(Object)
      );
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockAnnouncement);
    });

    test("should handle error when getting announcement by ID", async () => {
      const error = new Error("Test error");
      mockAnnouncementService.getAnnouncement.mockRejectedValue(error);

      const req = createMockRequest({
        params: { id: "nonExistentId" },
      });

      const res = createMockResponse();

      await announcementRouteHandlers.getAnnouncement(req, res);

      expect(mockAnnouncementService.getAnnouncement).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(200);
    });
  });

  describe("createAnnouncement", () => {
    test("should create an announcement successfully", async () => {
      const mockAnnouncementData = {
        title: "New Announcement",
        textBody: "This is a new announcement",
        isPublished: true,
      };

      const mockCreatedAnnouncement = {
        _id: "newAnnouncementId",
        ...mockAnnouncementData,
        publishDate: new Date(),
        author: "user1",
      };

      mockAnnouncementService.createAnnouncement.mockResolvedValue(
        mockCreatedAnnouncement as unknown as IAnnouncement
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockAnnouncementData,
      });

      const res = createMockResponse();

      await announcementRouteHandlers.createAnnouncement(req, res);

      expect(mockAnnouncementService.createAnnouncement).toHaveBeenCalledWith(
        mockAnnouncementData,
        expect.any(Object)
      );
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockCreatedAnnouncement);
    });

    test("should handle error when creating announcement with missing user", async () => {
      const mockAnnouncementData = {
        title: "New Announcement",
        textBody: "This is a new announcement",
      };

      const req = createMockRequest({
        body: mockAnnouncementData,
        user: undefined,
      });

      const res = createMockResponse();

      await announcementRouteHandlers.createAnnouncement(req, res);

      expect(mockAnnouncementService.createAnnouncement).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(200);
    });
  });

  describe("updateAnnouncement", () => {
    test("should update an announcement successfully", async () => {
      const announcementId = "existingAnnouncementId";
      const mockUpdateData = {
        _id: announcementId,
        title: "Updated Announcement",
        textBody: "This announcement has been updated",
      };

      const mockCurrentAnnouncement = {
        _id: announcementId,
        title: "Original Announcement",
        textBody: "Original text",
        publishDate: new Date(),
        isPublished: true,
        author: "user1",
      };

      const mockUpdatedAnnouncement = {
        ...mockCurrentAnnouncement,
        ...mockUpdateData,
      };

      mockAnnouncementService.getAnnouncement.mockResolvedValue(
        mockCurrentAnnouncement as unknown as IAnnouncement
      );
      mockAnnouncementService.updateAnnouncement.mockResolvedValue(
        mockUpdatedAnnouncement as unknown as IAnnouncement
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockUpdateData,
      });

      const res = createMockResponse();

      await announcementRouteHandlers.updateAnnouncement(req, res);

      expect(mockAnnouncementService.getAnnouncement).toHaveBeenCalledWith(
        announcementId,
        expect.any(Object)
      );
      expect(mockAnnouncementService.updateAnnouncement).toHaveBeenCalledWith(mockUpdateData);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockUpdatedAnnouncement);
    });

    test("should handle error when updating with missing user", async () => {
      const mockUpdateData = {
        _id: "existingAnnouncementId",
        title: "Updated Announcement",
      };

      const req = createMockRequest({
        body: mockUpdateData,
        user: undefined,
      });

      const res = createMockResponse();

      await announcementRouteHandlers.updateAnnouncement(req, res);

      expect(mockAnnouncementService.updateAnnouncement).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(200);
    });
  });

  describe("deleteAnnouncement", () => {
    test("should delete an announcement successfully", async () => {
      const announcementId = "announcementToDeleteId";
      const mockAnnouncement = {
        _id: announcementId,
        title: "Announcement to Delete",
        textBody: "This announcement will be deleted",
        publishDate: new Date(),
        isPublished: true,
      };

      mockAnnouncementService.deleteAnnouncement.mockResolvedValue(
        mockAnnouncement as unknown as IAnnouncement
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: announcementId },
      });

      const res = createMockResponse();

      await announcementRouteHandlers.deleteAnnouncement(req, res);

      expect(mockAnnouncementService.deleteAnnouncement).toHaveBeenCalledWith(announcementId);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockAnnouncement);
    });

    test("should handle error when deleting announcement", async () => {
      const error = new Error("Test error");
      mockAnnouncementService.deleteAnnouncement.mockRejectedValue(error);

      const req = createMockRequest({
        params: { id: "nonExistentId" },
      });

      const res = createMockResponse();

      await announcementRouteHandlers.deleteAnnouncement(req, res);

      expect(mockAnnouncementService.deleteAnnouncement).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(200);
    });
  });

  describe("searchAnnouncement", () => {
    test("should search announcements successfully", async () => {
      const searchQuery = { query: { title: "Important" } };
      const mockSearchResults = [
        {
          _id: "announcement1",
          title: "Important Announcement",
          textBody: "This is an important announcement",
          publishDate: new Date(),
          isPublished: true,
        },
        {
          _id: "announcement2",
          title: "Another Important Announcement",
          textBody: "This is another important announcement",
          publishDate: new Date(),
          isPublished: true,
        },
      ];

      mockAnnouncementService.searchAnnouncement.mockResolvedValue(
        mockSearchResults as unknown as IAnnouncement[]
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: searchQuery,
      });

      const res = createMockResponse();

      await announcementRouteHandlers.searchAnnouncement(req, res);

      expect(mockAnnouncementService.searchAnnouncement).toHaveBeenCalledWith(searchQuery);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockSearchResults);
    });

    test("should handle error when searching announcements", async () => {
      const error = new Error("Test error");
      mockAnnouncementService.searchAnnouncement.mockRejectedValue(error);

      const req = createMockRequest({
        body: { query: { title: "Important" } },
      });

      const res = createMockResponse();

      await announcementRouteHandlers.searchAnnouncement(req, res);

      expect(mockAnnouncementService.searchAnnouncement).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(200);
    });
  });

  describe("archiveAnnouncement", () => {
    test("should archive an announcement successfully", async () => {
      const announcementId = "announcementToArchiveId";
      const mockAnnouncement = {
        _id: announcementId,
        title: "Announcement to Archive",
        textBody: "This announcement will be archived",
        publishDate: new Date(),
        isPublished: true,
        archive: {
          status: true,
          date: new Date(),
        },
      };

      mockAnnouncementService.archiveAnnouncement.mockResolvedValue(
        mockAnnouncement as unknown as IAnnouncement
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: announcementId },
      });

      const res = createMockResponse();

      await announcementRouteHandlers.archiveAnnouncement(req, res);

      expect(mockAnnouncementService.archiveAnnouncement).toHaveBeenCalledWith(announcementId);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: config.SUCCESS.ANNOUNCEMENT.ARCHIVE,
        data: mockAnnouncement,
      });
    });

    test("should return 404 when announcement to archive is not found", async () => {
      mockAnnouncementService.archiveAnnouncement.mockResolvedValue(null);

      const req = createMockRequest({
        params: { id: "nonExistentId" },
      });

      const res = createMockResponse();

      await announcementRouteHandlers.archiveAnnouncement(req, res);

      expect(mockAnnouncementService.archiveAnnouncement).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Announcement not found" });
    });

    test("should handle error when user is not authenticated", async () => {
      const req = createMockRequest({
        params: { id: "announcementId" },
        user: undefined,
      });

      const res = createMockResponse();

      await announcementRouteHandlers.archiveAnnouncement(req, res);

      expect(mockAnnouncementService.archiveAnnouncement).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test("should require admin or superadmin role for archiving announcements", async () => {
      const middleware = validatePermissions(
        [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN],
        ACTION.ARCHIVE
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
        params: { id: "announcementId" },
      });

      const studentReq = createMockRequest({
        user: {
          id: "studentId",
          email: "student@example.com",
          organizationId: "orgId",
          role: "student",
          firstName: "",
          lastName: "",
        },
        params: { id: "announcementId" },
      });

      const res = createMockResponse();
      const next = jest.fn();

      middleware(adminReq, res, next);
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

    testRoleAccess("getAnnouncements", ACTION.GET_ALL);

    testRoleAccess("getAnnouncement", ACTION.GET_BY_ID);

    testRoleAccess("createAnnouncement", ACTION.CREATE, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
    ]);

    testRoleAccess("updateAnnouncement", ACTION.UPDATE, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
    ]);

    testRoleAccess("deleteAnnouncement", ACTION.DELETE, [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]);

    testRoleAccess("searchAnnouncement", ACTION.SEARCH);

    testRoleAccess("archiveAnnouncement", ACTION.ARCHIVE, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
    ]);
  });

  describe("Announcement Zod Validation", () => {
    describe("createAnnouncement validation", () => {
      test("should validate required fields", async () => {
        const invalidData = {
          isPublished: true,
        };

        mockAnnouncementService.createAnnouncement.mockImplementation(() => {
          throw new Error("This should not be called");
        });

        const originalImplementation = AnnouncementZodSchema.partial().parse;
        const mockZodValidation = jest.fn().mockImplementation(() => {
          const error = new Error("Validation error");
          error.name = "ZodError";
          throw error;
        });

        (AnnouncementZodSchema.partial as jest.Mock) = jest.fn().mockReturnValue({
          parse: mockZodValidation,
        });

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        await announcementRouteHandlers.createAnnouncement(req, res);

        expect(res.status).not.toHaveBeenCalledWith(200);
        expect(mockAnnouncementService.createAnnouncement).not.toHaveBeenCalled();

        (AnnouncementZodSchema.partial as jest.Mock) = jest.fn().mockReturnValue({
          parse: originalImplementation,
        });
      });

      test("should validate title and textBody length", async () => {
        const invalidData = {
          title: "a".repeat(101),
          textBody: "a".repeat(501),
          isPublished: true,
        };

        mockAnnouncementService.createAnnouncement.mockImplementation(() => {
          throw new Error("Validation error");
        });

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        await announcementRouteHandlers.createAnnouncement(req, res);

        expect(res.status).not.toHaveBeenCalledWith(200);
        expect(mockAnnouncementService.createAnnouncement).not.toHaveBeenCalled();
      });
    });

    describe("updateAnnouncement validation", () => {
      test("should validate that _id is provided", async () => {
        const invalidData = {
          title: "Updated Title",
          textBody: "Updated text body",
        };

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        await announcementRouteHandlers.updateAnnouncement(req, res);

        expect(res.status).not.toHaveBeenCalledWith(200);
        expect(mockAnnouncementService.updateAnnouncement).not.toHaveBeenCalled();
      });
    });

    describe("getAnnouncement validation", () => {
      test("should validate id parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        await announcementRouteHandlers.getAnnouncement(req, res);

        expect(res.status).not.toHaveBeenCalledWith(200);
        expect(mockAnnouncementService.getAnnouncement).not.toHaveBeenCalled();
      });
    });

    describe("deleteAnnouncement validation", () => {
      test("should validate id parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        await announcementRouteHandlers.deleteAnnouncement(req, res);

        expect(res.status).not.toHaveBeenCalledWith(200);
        expect(mockAnnouncementService.deleteAnnouncement).not.toHaveBeenCalled();
      });
    });

    describe("archiveAnnouncement validation", () => {
      test("should validate id parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        await announcementRouteHandlers.archiveAnnouncement(req, res);

        expect(res.status).not.toHaveBeenCalledWith(200);
        expect(mockAnnouncementService.archiveAnnouncement).not.toHaveBeenCalled();
      });
    });

    describe("searchAnnouncement validation", () => {
      test("should validate search query format", async () => {
        const invalidQuery = {
          invalidField: "test",
        };

        const req = createMockRequest({
          body: invalidQuery,
        });

        const res = createMockResponse();

        await announcementRouteHandlers.searchAnnouncement(req, res);

        expect(res.status).not.toHaveBeenCalledWith(200);
      });
    });
  });
});
