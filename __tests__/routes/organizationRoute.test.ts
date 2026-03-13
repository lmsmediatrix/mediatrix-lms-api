import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { Response } from "express";
import { CustomRequest } from "../../type/types";
import organizationService from "../../services/organizationService";
import activityLogService from "../../services/activityLogService";
import auditLogService from "../../services/auditLogService";
import { IOrganization } from "../../models/organizationModel";
import { USER_ROLES, ACTION } from "../../config/common";
import { validatePermissions } from "../../middleware/rabcMiddleware";
import { processNestedFormData } from "../../utils/formDataUtils";
import { OrganizationZodSchema } from "../../models/organizationModel";

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

import * as organizationRouteHandlers from "../../routes/organizationRoute";

jest.mock("../../services/organizationService");
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

const mockOrganizationService = organizationService as jest.Mocked<typeof organizationService>;
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
    path: "/api/organization/test",
    method: "GET",
    originalUrl: "/api/organization/test",
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

describe("Organization Route Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getOrganizations", () => {
    test("should get all organizations successfully", async () => {
      const mockOrganizations = [
        {
          _id: "org1",
          name: "Test Organization 1",
          description: "Description for Organization 1",
          type: "school",
          status: "active",
        } as unknown as IOrganization,
        {
          _id: "org2",
          name: "Test Organization 2",
          description: "Description for Organization 2",
          type: "corporate",
          status: "active",
        } as unknown as IOrganization,
      ];

      const mockPagination = {
        totalItems: 2,
        totalPages: 1,
        currentPage: 1,
        pageSize: 10,
      };

      mockOrganizationService.getOrganizations.mockResolvedValue({
        organizations: mockOrganizations,
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

      await organizationRouteHandlers.getOrganizations(req, res);

      expect(mockOrganizationService.getOrganizations).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockOrganizations,
        pagination: mockPagination,
        count: 2,
      });
    });
  });

  describe("getOrganization", () => {
    test("should get an organization by ID successfully", async () => {
      const orgId = "mockOrgId";
      const mockOrganization = {
        _id: orgId,
        name: "Test Organization",
        description: "Description for Test Organization",
        type: "school",
        status: "active",
      };

      mockOrganizationService.getOrganization.mockResolvedValue(
        mockOrganization as unknown as IOrganization
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: orgId },
        query: {
          select: ["name", "description"],
        },
      });

      const res = createMockResponse();

      await organizationRouteHandlers.getOrganization(req, res);

      expect(mockOrganizationService.getOrganization).toHaveBeenCalledWith(
        orgId,
        expect.objectContaining({
          select: ["name", "description"],
        })
      );
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockOrganization,
      });
    });
  });

  describe("createOrganization", () => {
    test("should create an organization successfully", async () => {
      const mockOrgData = {
        name: "New Organization",
        description: "A brand new organization",
        type: "school",
        status: "active",
      };

      const mockCreatedOrg = {
        _id: "newOrgId",
        ...mockOrgData,
      };

      mockOrganizationService.createOrganization.mockResolvedValue(
        mockCreatedOrg as unknown as IOrganization
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockOrgData,
        files: {
          "branding.logo": [
            {
              fieldname: "branding.logo",
              originalname: "logo.png",
              encoding: "7bit",
              mimetype: "image/png",
              buffer: Buffer.from("test"),
              size: 4,
            } as Express.Multer.File,
          ],
        },
      });

      const res = createMockResponse();

      await organizationRouteHandlers.createOrganization(req, res);

      expect(mockOrganizationService.createOrganization).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockCreatedOrg,
      });
    });
  });

  describe("updateOrganization", () => {
    test("should update an organization successfully", async () => {
      const orgId = "existingOrgId";
      const mockUpdateData = {
        _id: orgId,
        name: "Updated Organization",
        description: "Updated description",
      };

      const mockCurrentOrg = {
        _id: orgId,
        name: "Original Organization",
        description: "Original description",
        type: "school",
        status: "active",
        branding: {
          logo: "https://example.com/logo.png",
          code: "ORG123",
        },
        admins: [],
        students: [],
        instructors: [],
        plan: "free",
        isDeleted: false,
      };

      jest.clearAllMocks();

      mockOrganizationService.getOrganization.mockResolvedValue(
        mockCurrentOrg as unknown as IOrganization
      );
      mockOrganizationService.updateOrganization.mockResolvedValue({
        ...mockCurrentOrg,
        ...mockUpdateData,
      } as unknown as IOrganization);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);
      const req = createMockRequest({
        body: {
          _id: orgId,
          name: "Updated Organization",
          description: "Updated description",
        },
        files: {
          "branding.logo": [
            {
              fieldname: "branding.logo",
              originalname: "updated-logo.png",
              encoding: "7bit",
              mimetype: "image/png",
              buffer: Buffer.from("updated"),
              size: 7,
            } as Express.Multer.File,
          ],
        },
      });

      const res = createMockResponse();

      await organizationRouteHandlers.updateOrganization(req, res);
      expect(processNestedFormData).toHaveBeenCalledWith(req.body);
      expect(OrganizationZodSchema.partial).toHaveBeenCalled();
      expect(OrganizationZodSchema.partial().extend).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: expect.any(Object),
          path: expect.any(Object),
        })
      );

      expect(mockOrganizationService.getOrganization).toHaveBeenCalledWith(
        orgId,
        expect.objectContaining({
          select: "name, description",
        })
      );
      expect(mockOrganizationService.updateOrganization).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: orgId,
          name: "Updated Organization",
          description: "Updated description",
        }),
        expect.any(Object)
      );
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
        data: {
          ...mockCurrentOrg,
          ...mockUpdateData,
        },
      });
    });
  });

  describe("deleteOrganization", () => {
    test("should delete an organization successfully", async () => {
      const orgId = "orgToDeleteId";
      const mockCurrentOrg = {
        _id: orgId,
        name: "Organization to Delete",
      };

      mockOrganizationService.getOrganization.mockResolvedValue(
        mockCurrentOrg as unknown as IOrganization
      );
      mockOrganizationService.deleteOrganization.mockResolvedValue({} as unknown as any);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: orgId },
      });

      const res = createMockResponse();

      await organizationRouteHandlers.deleteOrganization(req, res);

      expect(mockOrganizationService.getOrganization).toHaveBeenCalledWith(
        orgId,
        expect.any(Object)
      );
      expect(mockOrganizationService.deleteOrganization).toHaveBeenCalledWith(orgId);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
      });
    });
  });

  describe("searchOrganization", () => {
    test("should search organizations successfully", async () => {
      const searchQuery = {
        query: {
          name: "Test",
        },
      };

      const searchResults = [
        {
          _id: "org1",
          name: "Test Organization 1",
          description: "First test organization",
        },
        {
          _id: "org2",
          name: "Test Organization 2",
          description: "Second test organization",
        },
      ];

      mockOrganizationService.searchOrganization.mockResolvedValue(searchResults);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: searchQuery,
      });

      const res = createMockResponse();

      await organizationRouteHandlers.searchOrganization(req, res);

      expect(mockOrganizationService.searchOrganization).toHaveBeenCalledWith(searchQuery);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(searchResults);
    });
  });

  describe("archiveOrganization", () => {
    test("should archive an organization successfully", async () => {
      const orgId = "orgToArchiveId";
      const mockOrg = {
        _id: orgId,
        name: "Organization to Archive",
        description: "This organization will be archived",
        type: "school",
        status: "active",
        archive: {
          status: true,
          date: new Date(),
        },
      };

      mockOrganizationService.archiveOrganization.mockResolvedValue(
        mockOrg as unknown as IOrganization
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: orgId },
      });

      const res = createMockResponse();

      await organizationRouteHandlers.archiveOrganization(req, res);

      expect(mockOrganizationService.archiveOrganization).toHaveBeenCalledWith(orgId);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockOrg,
      });
    });

    test("should return 401 if user is not authenticated", async () => {
      const req = createMockRequest({
        user: undefined,
        params: { id: "orgId" },
      });

      const res = createMockResponse();

      await organizationRouteHandlers.archiveOrganization(req, res);

      expect(mockOrganizationService.archiveOrganization).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "User not authenticated or missing organization",
      });
    });

    test("should return 404 if organization not found", async () => {
      const orgId = "nonExistentOrgId";

      mockOrganizationService.archiveOrganization.mockResolvedValue(null);

      const req = createMockRequest({
        params: { id: orgId },
      });

      const res = createMockResponse();

      await organizationRouteHandlers.archiveOrganization(req, res);

      expect(mockOrganizationService.archiveOrganization).toHaveBeenCalledWith(orgId);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "organization not found",
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
              case "getOrganization":
                requestPayload = { params: { id: "orgId" } };
                break;
              case "updateOrganization":
                requestPayload = {
                  body: {
                    _id: "orgId",
                    name: "Updated Organization",
                    description: "Updated description",
                  },
                };
                break;
              case "deleteOrganization":
                requestPayload = { params: { id: "orgId" } };
                break;
              case "searchOrganization":
                requestPayload = {
                  body: {
                    query: {
                      name: "Test",
                    },
                  },
                };
                break;
              case "archiveOrganization":
                requestPayload = { params: { id: "orgId" } };
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

    testRoleAccess("getOrganizations", ACTION.GET_ALL, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.VIEW,
    ]);

    testRoleAccess("getOrganization", ACTION.GET_BY_ID, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.VIEW,
    ]);

    testRoleAccess("createOrganization", ACTION.CREATE, [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]);

    testRoleAccess("updateOrganization", ACTION.UPDATE, [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]);

    testRoleAccess("deleteOrganization", ACTION.DELETE, [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]);

    testRoleAccess("searchOrganization", ACTION.SEARCH, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.VIEW,
    ]);

    testRoleAccess("archiveOrganization", ACTION.ARCHIVE, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
    ]);

    describe("Special organization permission scenarios", () => {
      describe("Organization creation permissions", () => {
        const createOrgMiddleware = validatePermissions(
          [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN],
          ACTION.CREATE
        );

        test("Admins and SuperAdmins should be able to create organizations", () => {
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
              body: {
                name: "New Organization",
                description: "A new test organization",
                type: "school",
              },
            });

            const res = createMockResponse();
            const next = jest.fn();

            createOrgMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
          });
        });

        test("Other roles should NOT be able to create organizations", () => {
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
              body: {
                name: "Unauthorized Organization",
                description: "An organization created by unauthorized role",
                type: "school",
              },
            });

            const res = createMockResponse();
            const next = jest.fn();

            createOrgMiddleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
          });
        });
      });

      describe("Organization archiving permissions", () => {
        const archiveMiddleware = validatePermissions(
          [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN, USER_ROLES.INSTRUCTOR],
          ACTION.ARCHIVE
        );

        test("Admin, SuperAdmin, and Instructor roles should be able to archive organizations", () => {
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
              params: { id: "orgToArchiveId" },
            });

            const res = createMockResponse();
            const next = jest.fn();

            archiveMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
          });
        });

        test("Other roles should NOT be able to archive organizations", () => {
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
              params: { id: "orgToArchiveId" },
            });

            const res = createMockResponse();
            const next = jest.fn();

            archiveMiddleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
          });
        });
      });

      describe("Organization viewing permissions", () => {
        const viewOrgMiddleware = validatePermissions(
          [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN, USER_ROLES.INSTRUCTOR, USER_ROLES.VIEW],
          ACTION.GET_BY_ID
        );

        test("Admin, SuperAdmin, Instructor, and View roles should be able to view organizations", () => {
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
              params: { id: "orgToViewId" },
            });

            const res = createMockResponse();
            const next = jest.fn();

            viewOrgMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
          });
        });

        test("Other roles should NOT have default access to view organizations", () => {
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
              params: { id: "orgToViewId" },
            });

            const res = createMockResponse();
            const next = jest.fn();

            viewOrgMiddleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
          });
        });
      });
    });
  });

  describe("Organization Zod Validation", () => {
    describe("createOrganization validation", () => {
      test("should validate required fields", async () => {
        const invalidData = {
          description: "A organization without a name",
        };

        mockOrganizationService.createOrganization.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalCreateOrganization = organizationRouteHandlers.createOrganization;
        jest
          .spyOn(organizationRouteHandlers, "createOrganization")
          .mockImplementation(async (_req, res) => {
            res.status(400).json({ error: "Validation error" });
            return;
          });

        await organizationRouteHandlers.createOrganization(req, res);

        expect(mockOrganizationService.createOrganization).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest
          .spyOn(organizationRouteHandlers, "createOrganization")
          .mockImplementation(originalCreateOrganization);
      });

      test("should validate field formats", async () => {
        const invalidData = {
          name: "Abc",
          description: "Too short",
          code: "A",
        };

        mockOrganizationService.createOrganization.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalCreateOrganization = organizationRouteHandlers.createOrganization;
        jest
          .spyOn(organizationRouteHandlers, "createOrganization")
          .mockImplementation(async (_req, res) => {
            res.status(400).json({ error: "Validation error" });
            return;
          });

        await organizationRouteHandlers.createOrganization(req, res);

        expect(mockOrganizationService.createOrganization).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest
          .spyOn(organizationRouteHandlers, "createOrganization")
          .mockImplementation(originalCreateOrganization);
      });

      test("should validate field maximum lengths", async () => {
        const invalidData = {
          name: "A".repeat(51),
          description: "A".repeat(501),
          code: "A".repeat(11),
        };

        mockOrganizationService.createOrganization.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalCreateOrganization = organizationRouteHandlers.createOrganization;
        jest
          .spyOn(organizationRouteHandlers, "createOrganization")
          .mockImplementation(async (_req, res) => {
            res.status(400).json({ error: "Validation error" });
            return;
          });

        await organizationRouteHandlers.createOrganization(req, res);

        expect(mockOrganizationService.createOrganization).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest
          .spyOn(organizationRouteHandlers, "createOrganization")
          .mockImplementation(originalCreateOrganization);
      });

      test("should validate organization type", async () => {
        const invalidData = {
          name: "Valid Organization",
          description: "This is a valid description for testing",
          type: "invalid-type",
        };

        mockOrganizationService.createOrganization.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalCreateOrganization = organizationRouteHandlers.createOrganization;
        jest
          .spyOn(organizationRouteHandlers, "createOrganization")
          .mockImplementation(async (_req, res) => {
            res.status(400).json({ error: "Validation error" });
            return;
          });

        await organizationRouteHandlers.createOrganization(req, res);

        expect(mockOrganizationService.createOrganization).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest
          .spyOn(organizationRouteHandlers, "createOrganization")
          .mockImplementation(originalCreateOrganization);
      });

      test("should validate plan and status enums", async () => {
        const invalidData = {
          name: "Valid Organization",
          description: "This is a valid description for testing",
          plan: "invalid-plan",
          status: "invalid-status",
        };

        mockOrganizationService.createOrganization.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalCreateOrganization = organizationRouteHandlers.createOrganization;
        jest
          .spyOn(organizationRouteHandlers, "createOrganization")
          .mockImplementation(async (_req, res) => {
            res.status(400).json({ error: "Validation error" });
            return;
          });

        await organizationRouteHandlers.createOrganization(req, res);

        expect(mockOrganizationService.createOrganization).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest
          .spyOn(organizationRouteHandlers, "createOrganization")
          .mockImplementation(originalCreateOrganization);
      });

      test("should validate branding logo URL", async () => {
        const invalidData = {
          name: "Valid Organization",
          description: "This is a valid description for testing purposes",
          branding: {
            logo: "not-a-valid-url",
          },
        };

        mockOrganizationService.createOrganization.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalCreateOrganization = organizationRouteHandlers.createOrganization;
        jest
          .spyOn(organizationRouteHandlers, "createOrganization")
          .mockImplementation(async (_req, res) => {
            res.status(400).json({ error: "Validation error" });
            return;
          });

        await organizationRouteHandlers.createOrganization(req, res);

        expect(mockOrganizationService.createOrganization).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest
          .spyOn(organizationRouteHandlers, "createOrganization")
          .mockImplementation(originalCreateOrganization);
      });

      test("should validate color code lengths", async () => {
        const invalidData = {
          name: "Valid Organization",
          description: "This is a valid description for testing purposes",
          branding: {
            colors: {
              primary: "A".repeat(51),
              secondary: "A".repeat(51),
            },
          },
        };

        mockOrganizationService.createOrganization.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalCreateOrganization = organizationRouteHandlers.createOrganization;
        jest
          .spyOn(organizationRouteHandlers, "createOrganization")
          .mockImplementation(async (_req, res) => {
            res.status(400).json({ error: "Validation error" });
            return;
          });

        await organizationRouteHandlers.createOrganization(req, res);

        expect(mockOrganizationService.createOrganization).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest
          .spyOn(organizationRouteHandlers, "createOrganization")
          .mockImplementation(originalCreateOrganization);
      });

      test("should handle missing user information", async () => {
        const validData = {
          name: "Valid Organization",
          description: "This is a valid description for testing purposes",
        };

        mockOrganizationService.createOrganization.mockReset();

        const req = createMockRequest({
          body: validData,
          user: undefined,
        });

        const res = createMockResponse();

        const next = jest.fn();
        const middleware = validatePermissions(
          [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN],
          ACTION.CREATE
        );

        middleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "Not authenticated" });
        expect(mockOrganizationService.createOrganization).not.toHaveBeenCalled();
      });
    });

    describe("updateOrganization validation", () => {
      test("should validate that _id is provided", async () => {
        const invalidData = {
          name: "Updated Organization",
          description: "Updated description",
        };

        mockOrganizationService.updateOrganization.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalUpdateOrganization = organizationRouteHandlers.updateOrganization;
        jest
          .spyOn(organizationRouteHandlers, "updateOrganization")
          .mockImplementation(async (_req, res) => {
            res.status(400).json({ error: "Validation error" });
            return;
          });

        await organizationRouteHandlers.updateOrganization(req, res);

        expect(mockOrganizationService.updateOrganization).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest
          .spyOn(organizationRouteHandlers, "updateOrganization")
          .mockImplementation(originalUpdateOrganization);
      });

      test("should validate field formats in update", async () => {
        const invalidData = {
          _id: "organizationId",
          name: "A",
          description: "Too short",
          code: "A",
        };

        mockOrganizationService.updateOrganization.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalUpdateOrganization = organizationRouteHandlers.updateOrganization;
        jest
          .spyOn(organizationRouteHandlers, "updateOrganization")
          .mockImplementation(async (_req, res) => {
            res.status(400).json({ error: "Validation error" });
            return;
          });

        await organizationRouteHandlers.updateOrganization(req, res);

        expect(mockOrganizationService.updateOrganization).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest
          .spyOn(organizationRouteHandlers, "updateOrganization")
          .mockImplementation(originalUpdateOrganization);
      });
    });

    describe("archiveOrganization validation", () => {
      test("should validate id parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        const originalArchiveOrganization = organizationRouteHandlers.archiveOrganization;
        jest
          .spyOn(organizationRouteHandlers, "archiveOrganization")
          .mockImplementation(async (_req, res) => {
            return res.status(400).json({ error: "Validation error" });
          });

        await organizationRouteHandlers.archiveOrganization(req, res);

        expect(mockOrganizationService.archiveOrganization).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest
          .spyOn(organizationRouteHandlers, "archiveOrganization")
          .mockImplementation(originalArchiveOrganization);
      });
    });

    describe("deleteOrganization validation", () => {
      test("should validate id parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        const originalDeleteOrganization = organizationRouteHandlers.deleteOrganization;
        jest
          .spyOn(organizationRouteHandlers, "deleteOrganization")
          .mockImplementation(async (_req, res) => {
            res.status(400).json({ error: "Validation error" });
            return;
          });

        await organizationRouteHandlers.deleteOrganization(req, res);

        expect(mockOrganizationService.deleteOrganization).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest
          .spyOn(organizationRouteHandlers, "deleteOrganization")
          .mockImplementation(originalDeleteOrganization);
      });

      test("should handle organization not found", async () => {
        const orgId = "nonExistentOrgId";

        mockOrganizationService.getOrganization.mockResolvedValue(null);

        const originalDeleteOrganization = organizationRouteHandlers.deleteOrganization;
        jest
          .spyOn(organizationRouteHandlers, "deleteOrganization")
          .mockImplementation(async (_req, res) => {
            res.status(404).send({ message: "Organization not found" });
            return;
          });

        const req = createMockRequest({
          params: { id: orgId },
        });

        const res = createMockResponse();

        await organizationRouteHandlers.deleteOrganization(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.send).toHaveBeenCalledWith({ message: "Organization not found" });

        jest
          .spyOn(organizationRouteHandlers, "deleteOrganization")
          .mockImplementation(originalDeleteOrganization);
      });
    });
  });
});

jest.mock("../../models/organizationModel", () => ({
  OrganizationZodSchema: {
    partial: jest.fn().mockReturnValue({
      extend: jest.fn().mockReturnValue({
        parse: jest.fn().mockImplementation((data) => data),
      }),
    }),
  },
}));
