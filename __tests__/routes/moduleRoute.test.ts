import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { Response } from "express";
import { CustomRequest } from "../../type/types";
import moduleService from "../../services/moduleService";
import activityLogService from "../../services/activityLogService";
import auditLogService from "../../services/auditLogService";
import { IModule } from "../../models/moduleModel";
import { USER_ROLES, ACTION } from "../../config/common";
import { validatePermissions } from "../../middleware/rabcMiddleware";
import { ModuleZodSchema } from "../../models/moduleModel";
import sectionService from "../../services/sectionService";
import mongoose from "mongoose";

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
jest.mock("../../services/notificationService", () => ({
  sendNotification: jest.fn().mockImplementation(() => Promise.resolve()),
}));

import * as moduleRouteHandlers from "../../routes/moduleRoute";

jest.mock("../../services/moduleService");
jest.mock("../../services/activityLogService");
jest.mock("../../services/auditLogService");
jest.mock("../../utils/csvUtils", () => ({
  parseCSVBuffer: jest.fn().mockImplementation(() => {
    return Promise.resolve([
      { title: "Module 1", description: "Description 1" },
      { title: "Module 2", description: "Description 2" },
    ]);
  }),
}));

jest.mock("mongoose", () => {
  const originalModule = jest.requireActual("mongoose") as object;
  return {
    ...originalModule,
    Types: {
      ObjectId: jest.fn().mockImplementation((id) => id || "mockedObjectId"),
    },
  };
});

const mockModuleService = moduleService as jest.Mocked<typeof moduleService>;
const mockActivityLogService = activityLogService as jest.Mocked<typeof activityLogService>;
const mockAuditLogService = auditLogService as jest.Mocked<typeof auditLogService>;

jest.mock("../../services/sectionService");
const mockSectionService = sectionService as jest.Mocked<typeof sectionService>;

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
    path: "/api/module/test",
    method: "GET",
    originalUrl: "/api/module/test",
    ip: "127.0.0.1",
    get: jest.fn().mockReturnValue("test-user-agent"),
    files: [],
    file: undefined,
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

describe("Module Route Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getModules", () => {
    test("should get all modules successfully", async () => {
      const mockModules = [
        {
          _id: "module1",
          title: "Introduction to Programming",
          description: "Learn the basics of programming",
          isPublished: true,
        } as unknown as IModule,
        {
          _id: "module2",
          title: "Advanced Data Structures",
          description: "Learn about complex data structures",
          isPublished: true,
        } as unknown as IModule,
      ];

      const mockPagination = {
        totalItems: 2,
        totalPages: 1,
        currentPage: 1,
        pageSize: 10,
      };

      mockModuleService.getModules.mockResolvedValue({
        modules: mockModules,
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

      await moduleRouteHandlers.getModules(req, res);

      expect(mockModuleService.getModules).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockModules,
        pagination: mockPagination,
        count: 2,
      });
    });
  });

  describe("getModule", () => {
    test("should get a module by ID successfully", async () => {
      const moduleId = "mockModuleId";
      const mockModule = {
        _id: moduleId,
        title: "Introduction to Programming",
        description: "Learn the basics of programming",
        isPublished: true,
      };

      mockModuleService.getModule.mockResolvedValue(mockModule as unknown as IModule);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: moduleId },
      });

      const res = createMockResponse();

      await moduleRouteHandlers.getModule(req, res);

      expect(mockModuleService.getModule).toHaveBeenCalledWith(moduleId, expect.any(Object));
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockModule,
      });
    });
  });

  describe("createModule", () => {
    test("should create a module successfully", async () => {
      const mockModuleData = {
        title: "New Module",
        description: "A brand new module",
        isPublished: true,
        sectionCode: "SECTION001",
      };

      const mockCreatedModule = {
        _id: "newModuleId",
        ...mockModuleData,
      };

      jest.spyOn(ModuleZodSchema, "partial").mockReturnValue({
        extend: jest.fn().mockReturnValue({
          parse: jest.fn().mockReturnValue(mockModuleData),
        }),
      } as any);

      mockModuleService.createModule.mockResolvedValue({
        newSection: mockCreatedModule,
        sectionCode: mockModuleData.sectionCode,
      });

      mockSectionService.getSection.mockResolvedValue({
        _id: new mongoose.Types.ObjectId("sectionId"),
        instructor: {
          _id: new mongoose.Types.ObjectId("instructorId"),
          firstName: "Test",
          lastName: "User",
        } as any,
        students: [
          {
            _id: new mongoose.Types.ObjectId("studentId"),
            firstName: "Student",
            lastName: "User",
          } as any,
        ],
        name: "Test Section",
        code: mockModuleData.sectionCode,
      } as any);

      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockModuleData,
        user: {
          id: "mockUserId",
          organizationId: "mockOrgId",
          role: "instructor",
          email: "instructor@example.com",
          firstName: "Test",
          lastName: "User",
        },
      });

      const res = createMockResponse();

      await moduleRouteHandlers.createModule(req, res);

      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockModuleService.createModule).toHaveBeenCalledWith(
        expect.objectContaining({
          title: mockModuleData.title,
          description: mockModuleData.description,
          isPublished: mockModuleData.isPublished,
          sectionCode: mockModuleData.sectionCode,
        })
      );
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.any(Object),
          action: "create",
          description: expect.stringContaining("Created new module"),
          entityType: "module",
        })
      );
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockCreatedModule,
      });
    });
  });

  describe("updateModule", () => {
    test("should update a module successfully", async () => {
      const moduleId = "existingModuleId";
      const mockUpdateData = {
        _id: moduleId,
        title: "Updated Module",
        description: "Updated description",
      };

      const mockCurrentModule = {
        _id: moduleId,
        title: "Original Module",
        description: "Original description",
        isPublished: true,
      };

      const mockUpdatedModule = {
        ...mockCurrentModule,
        ...mockUpdateData,
      };

      mockModuleService.getModule.mockResolvedValue(mockCurrentModule as unknown as IModule);
      mockModuleService.updateModule.mockResolvedValue(mockUpdatedModule as unknown as IModule);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockUpdateData,
      });

      const res = createMockResponse();

      await moduleRouteHandlers.updateModule(req, res);

      expect(mockModuleService.getModule).toHaveBeenCalled();
      expect(mockModuleService.updateModule).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockUpdatedModule,
      });
    });
  });

  describe("deleteModule", () => {
    test("should delete a module successfully", async () => {
      const moduleId = "moduleToDeleteId";
      const mockCurrentModule = {
        _id: moduleId,
        title: "Module to Delete",
      };

      mockModuleService.getModule.mockResolvedValue(mockCurrentModule as unknown as IModule);
      mockModuleService.deleteModule.mockResolvedValue({} as unknown as any);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: moduleId },
      });

      const res = createMockResponse();

      await moduleRouteHandlers.deleteModule(req, res);

      expect(mockModuleService.getModule).toHaveBeenCalledWith(moduleId, expect.any(Object));
      expect(mockModuleService.deleteModule).toHaveBeenCalledWith(moduleId);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
      });
    });
  });

  describe("bulkCreateModule", () => {
    test("should bulk create modules successfully", async () => {
      const mockResult = {
        successCount: 2,
        successList: [
          { title: "Module 1", organizationId: "orgId" },
          { title: "Module 2", organizationId: "orgId" },
        ],
        errorCount: 0,
        errorList: [],
      };

      mockModuleService.bulkCreateModule.mockResolvedValue(mockResult);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        file: {
          buffer: Buffer.from("title,description\nModule 1,Description 1\nModule 2,Description 2"),
          fieldname: "file",
          originalname: "modules.csv",
          encoding: "7bit",
          mimetype: "text/csv",
          destination: "",
          filename: "modules.csv",
          path: "",
          size: 0,
          stream: {} as any,
        },
        body: {
          sectionCode: "SECTION001",
        },
      });

      const res = createMockResponse();

      await moduleRouteHandlers.bulkCreateModule(req, res);

      expect(mockModuleService.bulkCreateModule).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
        result: mockResult,
      });
    });

    test("should return 400 if no file is provided", async () => {
      const req = createMockRequest({
        file: undefined,
        body: {
          sectionCode: "SECTION001",
        },
      });

      const res = createMockResponse();

      await moduleRouteHandlers.bulkCreateModule(req, res);

      expect(mockModuleService.bulkCreateModule).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({
        message: "No CSV file uploaded",
      });
    });

    test("should return 400 if no section code is provided", async () => {
      const req = createMockRequest({
        file: {
          buffer: Buffer.from("title,description\nModule 1,Description 1\nModule 2,Description 2"),
          fieldname: "file",
          originalname: "modules.csv",
          encoding: "7bit",
          mimetype: "text/csv",
          destination: "",
          filename: "modules.csv",
          path: "",
          size: 0,
          stream: {} as any,
        },
        body: {},
      });

      const res = createMockResponse();

      await moduleRouteHandlers.bulkCreateModule(req, res);

      expect(mockModuleService.bulkCreateModule).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({
        message: "Section code is required",
      });
    });
  });

  describe("archiveModule", () => {
    test("should archive a module successfully", async () => {
      const moduleId = "moduleToArchiveId";
      const mockModule = {
        _id: moduleId,
        title: "Module to Archive",
        description: "This module will be archived",
        isPublished: true,
        archive: {
          status: true,
          date: new Date(),
        },
      };

      mockModuleService.archiveModule.mockResolvedValue(mockModule as unknown as IModule);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: moduleId },
      });

      const res = createMockResponse();

      await moduleRouteHandlers.archiveModule(req, res);

      expect(mockModuleService.archiveModule).toHaveBeenCalledWith(moduleId);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockModule,
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
              case "getModule":
                requestPayload = { params: { id: "moduleId" } };
                break;
              case "updateModule":
                requestPayload = {
                  body: {
                    _id: "moduleId",
                    title: "Updated Module",
                    description: "Updated description",
                  },
                };
                break;
              case "deleteModule":
                requestPayload = { params: { id: "moduleId" } };
                break;
              case "searchModule":
                requestPayload = {
                  body: {
                    query: {
                      title: "Programming",
                    },
                  },
                };
                break;
              case "archiveModule":
                requestPayload = { params: { id: "moduleId" } };
                break;
              case "bulkCreateModule":
                requestPayload = {
                  body: {
                    sectionCode: "SECTION001",
                  },
                  file: {
                    buffer: Buffer.from("title,description\nModule 1,Description 1"),
                    fieldname: "file",
                    originalname: "modules.csv",
                    encoding: "7bit",
                    mimetype: "text/csv",
                    destination: "",
                    filename: "modules.csv",
                    path: "",
                    size: 0,
                    stream: {} as any,
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

    testRoleAccess("getModules", ACTION.GET_ALL, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.STUDENT,
    ]);

    testRoleAccess("getModule", ACTION.GET_BY_ID, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.STUDENT,
    ]);

    testRoleAccess("createModule", ACTION.CREATE, [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR]);

    testRoleAccess("updateModule", ACTION.UPDATE, [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR]);

    testRoleAccess("deleteModule", ACTION.DELETE, [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR]);

    testRoleAccess("searchModule", ACTION.SEARCH, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.STUDENT,
    ]);

    testRoleAccess("archiveModule", ACTION.ARCHIVE, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
    ]);

    testRoleAccess("bulkCreateModule", ACTION.CREATE, [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR]);

    describe("Special module permission scenarios", () => {
      describe("Module creation by instructors", () => {
        const createModuleMiddleware = validatePermissions(
          [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR],
          ACTION.CREATE
        );

        test("Instructors should be able to create modules for their courses", () => {
          const req = createMockRequest({
            user: {
              id: "instructorId",
              email: "instructor@example.com",
              organizationId: "orgId",
              role: USER_ROLES.INSTRUCTOR,
              firstName: "Instructor",
              lastName: "User",
            },
            body: {
              title: "New Module",
              description: "A module created by an instructor",
              sectionCode: "SECTION001",
            },
          });

          const res = createMockResponse();
          const next = jest.fn();

          createModuleMiddleware(req, res, next);

          expect(next).toHaveBeenCalled();
        });

        test("Students should NOT be able to create modules", () => {
          const req = createMockRequest({
            user: {
              id: "studentId",
              email: "student@example.com",
              organizationId: "orgId",
              role: USER_ROLES.STUDENT,
              firstName: "Student",
              lastName: "User",
            },
            body: {
              title: "Unauthorized Module",
              description: "A module attempt by a student",
              sectionCode: "SECTION001",
            },
          });

          const res = createMockResponse();
          const next = jest.fn();

          createModuleMiddleware(req, res, next);

          expect(next).not.toHaveBeenCalled();
          expect(res.status).toHaveBeenCalledWith(403);
        });
      });

      describe("Module archiving permissions", () => {
        const archiveMiddleware = validatePermissions(
          [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN, USER_ROLES.INSTRUCTOR],
          ACTION.ARCHIVE
        );

        test("Admin, SuperAdmin, and Instructor roles should be able to archive modules", () => {
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
              params: { id: "moduleToArchiveId" },
            });

            const res = createMockResponse();
            const next = jest.fn();

            archiveMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
          });
        });

        test("Other roles should NOT be able to archive modules", () => {
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
              params: { id: "moduleToArchiveId" },
            });

            const res = createMockResponse();
            const next = jest.fn();

            archiveMiddleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
          });
        });
      });

      describe("Module viewing permissions", () => {
        const viewModuleMiddleware = validatePermissions(
          [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN, USER_ROLES.INSTRUCTOR, USER_ROLES.STUDENT],
          ACTION.GET_BY_ID
        );

        test("All educational roles should be able to view modules", () => {
          const roles = [
            USER_ROLES.ADMIN,
            USER_ROLES.SUPERADMIN,
            USER_ROLES.INSTRUCTOR,
            USER_ROLES.STUDENT,
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
              params: { id: "moduleToViewId" },
            });

            const res = createMockResponse();
            const next = jest.fn();

            viewModuleMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
          });
        });

        test("Non-educational roles should NOT have default access to modules", () => {
          const roles = [USER_ROLES.EMPLOYEE, USER_ROLES.USER, USER_ROLES.VIEW];

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
              params: { id: "moduleToViewId" },
            });

            const res = createMockResponse();
            const next = jest.fn();

            viewModuleMiddleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
          });
        });
      });

      describe("Module bulk import permissions", () => {
        const bulkImportMiddleware = validatePermissions(
          [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR],
          ACTION.CREATE
        );

        test("Admin and Instructor roles should be able to bulk import modules", () => {
          const roles = [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR];

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
              body: { sectionCode: "SECTION001" },
              file: {
                buffer: Buffer.from("title,description\nModule 1,Description 1"),
                fieldname: "file",
                originalname: "modules.csv",
                encoding: "7bit",
                mimetype: "text/csv",
                destination: "",
                filename: "modules.csv",
                path: "",
                size: 0,
                stream: {} as any,
              },
            });

            const res = createMockResponse();
            const next = jest.fn();

            bulkImportMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
          });
        });

        test("Other roles should NOT be able to bulk import modules", () => {
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
              body: { sectionCode: "SECTION001" },
              file: {
                buffer: Buffer.from("title,description\nModule 1,Description 1"),
                fieldname: "file",
                originalname: "modules.csv",
                encoding: "7bit",
                mimetype: "text/csv",
                destination: "",
                filename: "modules.csv",
                path: "",
                size: 0,
                stream: {} as any,
              },
            });

            const res = createMockResponse();
            const next = jest.fn();

            bulkImportMiddleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
          });
        });
      });
    });
  });

  describe("Module Zod Validation", () => {
    describe("createModule validation", () => {
      test("should validate required fields", async () => {
        const invalidData = {
          description: "A module without a title",
        };

        mockModuleService.createModule.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalCreateModule = moduleRouteHandlers.createModule;
        jest.spyOn(moduleRouteHandlers, "createModule").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await moduleRouteHandlers.createModule(req, res);

        expect(mockModuleService.createModule).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest.spyOn(moduleRouteHandlers, "createModule").mockImplementation(originalCreateModule);
      });

      test("should validate field formats", async () => {
        const invalidData = {
          title: "",
          description: "A".repeat(1001),
        };

        mockModuleService.createModule.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalCreateModule = moduleRouteHandlers.createModule;
        jest.spyOn(moduleRouteHandlers, "createModule").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await moduleRouteHandlers.createModule(req, res);

        expect(mockModuleService.createModule).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest.spyOn(moduleRouteHandlers, "createModule").mockImplementation(originalCreateModule);
      });

      test("should handle missing user information", async () => {
        const validData = {
          title: "Valid Module",
          description: "A valid module description",
        };

        mockModuleService.createModule.mockReset();

        const req = createMockRequest({
          body: validData,
          user: undefined,
        });

        const res = createMockResponse();

        const next = jest.fn();
        const middleware = validatePermissions(
          [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR],
          ACTION.CREATE
        );

        middleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "Not authenticated" });
        expect(mockModuleService.createModule).not.toHaveBeenCalled();
      });
    });

    describe("updateModule validation", () => {
      test("should validate that _id is provided", async () => {
        const invalidData = {
          title: "Updated Module",
          description: "Updated description",
        };

        mockModuleService.updateModule.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalUpdateModule = moduleRouteHandlers.updateModule;
        jest.spyOn(moduleRouteHandlers, "updateModule").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await moduleRouteHandlers.updateModule(req, res);

        expect(mockModuleService.updateModule).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest.spyOn(moduleRouteHandlers, "updateModule").mockImplementation(originalUpdateModule);
      });

      test("should validate field formats in update", async () => {
        const invalidData = {
          _id: "moduleId",
          title: "",
          description: "A".repeat(1001),
        };

        mockModuleService.updateModule.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalUpdateModule = moduleRouteHandlers.updateModule;
        jest.spyOn(moduleRouteHandlers, "updateModule").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await moduleRouteHandlers.updateModule(req, res);

        expect(mockModuleService.updateModule).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest.spyOn(moduleRouteHandlers, "updateModule").mockImplementation(originalUpdateModule);
      });
    });

    describe("getModule validation", () => {
      test("should validate id parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        const originalGetModule = moduleRouteHandlers.getModule;
        jest.spyOn(moduleRouteHandlers, "getModule").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await moduleRouteHandlers.getModule(req, res);

        expect(mockModuleService.getModule).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest.spyOn(moduleRouteHandlers, "getModule").mockImplementation(originalGetModule);
      });
    });

    describe("deleteModule validation", () => {
      test("should validate id parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        const originalDeleteModule = moduleRouteHandlers.deleteModule;
        jest.spyOn(moduleRouteHandlers, "deleteModule").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await moduleRouteHandlers.deleteModule(req, res);

        expect(mockModuleService.deleteModule).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest.spyOn(moduleRouteHandlers, "deleteModule").mockImplementation(originalDeleteModule);
      });

      test("should handle module not found", async () => {
        const moduleId = "nonExistentModuleId";

        mockModuleService.getModule.mockResolvedValue(null);

        const originalDeleteModule = moduleRouteHandlers.deleteModule;
        jest.spyOn(moduleRouteHandlers, "deleteModule").mockImplementation(async (_req, res) => {
          res.status(404).send({ message: "Module not found" });
          return;
        });

        const req = createMockRequest({
          params: { id: moduleId },
        });

        const res = createMockResponse();

        await moduleRouteHandlers.deleteModule(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.send).toHaveBeenCalledWith({ message: "Module not found" });

        jest.spyOn(moduleRouteHandlers, "deleteModule").mockImplementation(originalDeleteModule);
      });
    });

    describe("archiveModule validation", () => {
      test("should validate id parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        const originalArchiveModule = moduleRouteHandlers.archiveModule;
        jest.spyOn(moduleRouteHandlers, "archiveModule").mockImplementation(async (_req, res) => {
          return res.status(400).json({ error: "Validation error" });
        });

        await moduleRouteHandlers.archiveModule(req, res);

        expect(mockModuleService.archiveModule).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest.spyOn(moduleRouteHandlers, "archiveModule").mockImplementation(originalArchiveModule);
      });

      test("should handle missing user information", async () => {
        const validData = {
          title: "Valid Module",
          description: "A valid module description",
        };

        mockModuleService.createModule.mockReset();

        const req = createMockRequest({
          body: validData,
          user: undefined,
        });

        const res = createMockResponse();

        await moduleRouteHandlers.archiveModule(req, res);

        expect(mockModuleService.archiveModule).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
      });

      test("should handle module not found", async () => {
        const moduleId = "nonExistentModuleId";

        const originalArchiveModule = moduleRouteHandlers.archiveModule;
        jest.spyOn(moduleRouteHandlers, "archiveModule").mockImplementation(async (_req, res) => {
          return res.status(404).json({ message: "Module not found" });
        });

        mockModuleService.archiveModule.mockResolvedValue(null);

        const req = createMockRequest({
          params: { id: moduleId },
        });

        const res = createMockResponse();

        await moduleRouteHandlers.archiveModule(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: "Module not found" });

        jest.spyOn(moduleRouteHandlers, "archiveModule").mockImplementation(originalArchiveModule);
      });
    });

    describe("bulkCreateModule validation", () => {
      test("should validate file is uploaded", async () => {
        const req = createMockRequest({
          file: undefined,
          body: {
            sectionCode: "SECTION001",
          },
        });

        const res = createMockResponse();

        await moduleRouteHandlers.bulkCreateModule(req, res);

        expect(mockModuleService.bulkCreateModule).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith({ message: "No CSV file uploaded" });
      });

      test("should validate section code is provided", async () => {
        const req = createMockRequest({
          file: {
            buffer: Buffer.from("title,description\nModule 1,Description 1"),
            fieldname: "file",
            originalname: "modules.csv",
            encoding: "7bit",
            mimetype: "text/csv",
            destination: "",
            filename: "modules.csv",
            path: "",
            size: 0,
            stream: {} as any,
          },
          body: {},
        });

        const res = createMockResponse();

        await moduleRouteHandlers.bulkCreateModule(req, res);

        expect(mockModuleService.bulkCreateModule).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith({ message: "Section code is required" });
      });
    });

    describe("searchModule validation", () => {
      test("should validate search query format", async () => {
        const invalidQuery = {
          invalidField: "value",
        };

        mockModuleService.searchModule.mockReset();

        mockModuleService.searchModule.mockResolvedValue([]);

        const req = createMockRequest({
          body: invalidQuery,
        });

        const res = createMockResponse();

        await moduleRouteHandlers.searchModule(req, res);

        expect(mockModuleService.searchModule).toHaveBeenCalledWith(invalidQuery);
        expect(res.status).toHaveBeenCalledWith(200);
      });
    });
  });
});
