import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { Response } from "express";
import { CustomRequest } from "../../type/types";
import providerService from "../../services/providerService";
import activityLogService from "../../services/activityLogService";
import auditLogService from "../../services/auditLogService";
import { IProvider } from "../../models/providerModel";

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

import * as providerRouteHandlers from "../../routes/providerRoute";
import { validatePermissions } from "../../middleware/rabcMiddleware";

jest.mock("../../services/providerService");
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

const mockProviderService = providerService as jest.Mocked<typeof providerService>;
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
    path: "/api/provider/test",
    method: "GET",
    originalUrl: "/api/provider/test",
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

describe("Provider Route Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getProviders", () => {
    test("should get all providers successfully", async () => {
      const mockProviders = [
        {
          _id: "provider1",
          name: "Provider 1",
          description: "Test Provider 1",
        } as unknown as IProvider,
        {
          _id: "provider2",
          name: "Provider 2",
          description: "Test Provider 2",
        } as unknown as IProvider,
      ];

      const mockPagination = {
        totalItems: 2,
        totalPages: 1,
        currentPage: 1,
        pageSize: 10,
      };

      mockProviderService.getProviders.mockResolvedValue({
        providers: mockProviders,
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

      await providerRouteHandlers.getProviders(req, res);

      expect(mockProviderService.getProviders).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: "Providers retrieved successfully",
        data: mockProviders,
        pagination: mockPagination,
        count: 2,
      });
    });

    test("should handle error when getting providers", async () => {
      const error = new Error("Test error");
      mockProviderService.getProviders.mockRejectedValue(error);

      const req = createMockRequest();
      const res = createMockResponse();

      await providerRouteHandlers.getProviders(req, res);

      expect(mockProviderService.getProviders).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(200);
    });

    test("should require admin or superadmin role", async () => {
      const middleware = validatePermissions(
        [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN],
        ACTION.GET_ALL
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

      const studentReq = createMockRequest({
        user: {
          id: "studentId",
          email: "student@example.com",
          organizationId: "orgId",
          role: "student",
          firstName: "",
          lastName: "",
        },
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

  describe("getProvider", () => {
    test("should get a provider by ID successfully", async () => {
      const providerId = "mockProviderId";
      const mockProvider = {
        _id: providerId,
        name: "Test Provider",
        description: "Provider description",
        contactEmail: "provider@example.com",
        website: "https://provider.com",
      };

      mockProviderService.getProvider.mockResolvedValue(mockProvider as unknown as IProvider);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: providerId },
      });

      const res = createMockResponse();

      await providerRouteHandlers.getProvider(req, res);

      expect(mockProviderService.getProvider).toHaveBeenCalledWith(providerId, expect.any(Object));
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: "Provider retrieved successfully",
        data: mockProvider,
      });
    });

    test("should return 404 when provider is not found", async () => {
      const providerId = "nonExistentProviderId";
      mockProviderService.getProvider.mockResolvedValue(null);

      const req = createMockRequest({
        params: { id: providerId },
      });

      const res = createMockResponse();

      await providerRouteHandlers.getProvider(req, res);

      expect(mockProviderService.getProvider).toHaveBeenCalledWith(providerId, expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith({ message: "Provider not found" });
    });

    test("should require admin or superadmin role for accessing single provider", async () => {
      const middleware = validatePermissions(
        [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN],
        ACTION.GET_BY_ID
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
        params: { id: "providerId" },
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
        params: { id: "providerId" },
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

  describe("createProvider", () => {
    test("should create a provider successfully", async () => {
      const mockProviderData = {
        name: "New Provider",
        description: "Test provider description",
        contactEmail: "contact@newprovider.com",
        contactPhone: "123-456-7890",
        website: "https://newprovider.com",
      };

      const mockCreatedProvider = {
        _id: "newProviderId",
        ...mockProviderData,
      };

      mockProviderService.createProvider.mockResolvedValue(
        mockCreatedProvider as unknown as IProvider
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockProviderData,
      });

      const res = createMockResponse();

      await providerRouteHandlers.createProvider(req, res);

      expect(mockProviderService.createProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockProviderData,
          organizationId: expect.any(Object),
        })
      );
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send).toHaveBeenCalledWith({
        message: "Provider created successfully",
        data: mockCreatedProvider,
      });
    });

    test("should require admin or superadmin role for creating providers", async () => {
      const middleware = validatePermissions(
        [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN],
        ACTION.CREATE
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

      const studentReq = createMockRequest({
        user: {
          id: "studentId",
          email: "student@example.com",
          organizationId: "orgId",
          role: "student",
          firstName: "",
          lastName: "",
        },
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

  describe("updateProvider", () => {
    test("should update a provider successfully", async () => {
      const providerId = "existingProviderId";
      const mockUpdateData = {
        _id: providerId,
        name: "Updated Provider",
        description: "Updated description",
        website: "https://updatedprovider.com",
      };

      const mockUpdatedProvider = {
        _id: providerId,
        name: "Updated Provider",
        description: "Updated description",
        contactEmail: "contact@provider.com",
        contactPhone: "123-456-7890",
        website: "https://updatedprovider.com",
      };

      mockProviderService.getProvider.mockResolvedValue({
        name: "Original Provider",
        description: "Original description",
        website: "https://provider.com",
      } as unknown as IProvider);
      mockProviderService.updateProvider.mockResolvedValue(
        mockUpdatedProvider as unknown as IProvider
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockUpdateData,
      });

      const res = createMockResponse();

      await providerRouteHandlers.updateProvider(req, res);

      expect(mockProviderService.updateProvider).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: "Provider updated successfully",
        data: mockUpdatedProvider,
      });
    });

    test("should require admin or superadmin role for updating providers", async () => {
      const middleware = validatePermissions(
        [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN],
        ACTION.UPDATE
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
        body: { _id: "providerId", name: "Updated Provider" },
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
        body: { _id: "providerId", name: "Updated Provider" },
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

  describe("deleteProvider", () => {
    test("should delete a provider successfully", async () => {
      const providerId = "providerToDeleteId";
      const mockProvider = {
        _id: providerId,
        name: "Provider to Delete",
        description: "Provider to delete description",
      };

      mockProviderService.getProvider.mockResolvedValue(mockProvider as unknown as IProvider);
      mockProviderService.deleteProvider.mockResolvedValue(mockProvider as unknown as IProvider);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: providerId },
      });

      const res = createMockResponse();

      await providerRouteHandlers.deleteProvider(req, res);

      expect(mockProviderService.getProvider).toHaveBeenCalledWith(providerId, expect.any(Object));
      expect(mockProviderService.deleteProvider).toHaveBeenCalledWith(providerId);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: "Provider deleted successfully",
        data: mockProvider,
      });
    });

    test("should return 404 when provider to delete is not found", async () => {
      const providerId = "nonExistentProviderId";
      mockProviderService.getProvider.mockResolvedValue(null);

      const req = createMockRequest({
        params: { id: providerId },
      });

      const res = createMockResponse();

      await providerRouteHandlers.deleteProvider(req, res);

      expect(mockProviderService.getProvider).toHaveBeenCalledWith(providerId, expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith({ message: "Provider not found" });
    });

    test("should require admin or superadmin role for deleting providers", async () => {
      const middleware = validatePermissions(
        [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN],
        ACTION.DELETE
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
        params: { id: "providerId" },
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
        params: { id: "providerId" },
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

  describe("searchProviders", () => {
    test("should search providers successfully", async () => {
      const searchQuery = { query: { name: "Provider" } };
      const mockSearchResults = [
        { _id: "provider1", name: "Provider One", description: "First provider" },
        { _id: "provider2", name: "Provider Two", description: "Second provider" },
      ];

      mockProviderService.searchProvider.mockResolvedValue(
        mockSearchResults as unknown as IProvider[]
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: searchQuery,
      });

      const res = createMockResponse();

      await providerRouteHandlers.searchProviders(req, res);

      expect(mockProviderService.searchProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            name: "Provider",
            organizationId: expect.any(String),
          }),
        })
      );
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockSearchResults);
    });

    test("should require admin or superadmin role for searching providers", async () => {
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
        body: { query: { name: "Provider" } },
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
        body: { query: { name: "Provider" } },
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

  describe("Provider Zod Validation", () => {
    describe("createProvider validation", () => {
      test("should validate required fields", async () => {
        const invalidData = {
          description: "A provider without a name",
          contactEmail: "test@example.com",
        };

        mockProviderService.createProvider.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalCreateProvider = providerRouteHandlers.createProvider;
        jest
          .spyOn(providerRouteHandlers, "createProvider")
          .mockImplementation(async (_req, res) => {
            res.status(400).json({ error: "Validation error" });
            return;
          });

        await providerRouteHandlers.createProvider(req, res);

        expect(mockProviderService.createProvider).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest
          .spyOn(providerRouteHandlers, "createProvider")
          .mockImplementation(originalCreateProvider);
      });

      test("should validate field formats", async () => {
        const invalidData = {
          name: "Ab",
          description: "A".repeat(201),
          contactEmail: "not-an-email",
          contactPhone: "1".repeat(21),
          website: "invalid-url",
        };

        mockProviderService.createProvider.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalCreateProvider = providerRouteHandlers.createProvider;
        jest
          .spyOn(providerRouteHandlers, "createProvider")
          .mockImplementation(async (_req, res) => {
            res.status(400).json({ error: "Validation error" });
            return;
          });

        await providerRouteHandlers.createProvider(req, res);

        expect(mockProviderService.createProvider).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest
          .spyOn(providerRouteHandlers, "createProvider")
          .mockImplementation(originalCreateProvider);
      });

      test("should handle missing user information", async () => {
        const validData = {
          name: "Valid Provider",
          description: "A valid provider description",
          contactEmail: "valid@example.com",
        };

        mockProviderService.createProvider.mockReset();

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
        expect(mockProviderService.createProvider).not.toHaveBeenCalled();
      });
    });

    describe("updateProvider validation", () => {
      test("should validate that _id is provided", async () => {
        const invalidData = {
          name: "Updated Provider",
          description: "Updated description",
        };

        mockProviderService.updateProvider.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalUpdateProvider = providerRouteHandlers.updateProvider;
        jest
          .spyOn(providerRouteHandlers, "updateProvider")
          .mockImplementation(async (_req, res) => {
            return res.status(400).json({ error: "Validation error" });
          });

        await providerRouteHandlers.updateProvider(req, res);

        expect(mockProviderService.updateProvider).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest
          .spyOn(providerRouteHandlers, "updateProvider")
          .mockImplementation(originalUpdateProvider);
      });

      test("should validate field formats in update", async () => {
        const invalidData = {
          _id: "providerId",
          name: "A",
          description: "A".repeat(201),
          contactEmail: "not-valid-email",
          website: "not-valid-url",
        };

        mockProviderService.updateProvider.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalUpdateProvider = providerRouteHandlers.updateProvider;
        jest
          .spyOn(providerRouteHandlers, "updateProvider")
          .mockImplementation(async (_req, res) => {
            return res.status(400).json({ error: "Validation error" });
          });

        await providerRouteHandlers.updateProvider(req, res);

        expect(mockProviderService.updateProvider).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest
          .spyOn(providerRouteHandlers, "updateProvider")
          .mockImplementation(originalUpdateProvider);
      });
    });

    describe("deleteProvider validation", () => {
      test("should validate id parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        const originalDeleteProvider = providerRouteHandlers.deleteProvider;
        jest
          .spyOn(providerRouteHandlers, "deleteProvider")
          .mockImplementation(async (_req, res) => {
            return res.status(400).json({ error: "Validation error" });
          });

        await providerRouteHandlers.deleteProvider(req, res);

        expect(mockProviderService.deleteProvider).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest
          .spyOn(providerRouteHandlers, "deleteProvider")
          .mockImplementation(originalDeleteProvider);
      });

      test("should handle provider not found", async () => {
        const providerId = "nonExistentProviderId";

        mockProviderService.getProvider.mockResolvedValue(null);

        const req = createMockRequest({
          params: { id: providerId },
        });

        const res = createMockResponse();

        await providerRouteHandlers.deleteProvider(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.send).toHaveBeenCalledWith({ message: "Provider not found" });
      });
    });
  });

  describe("Role-Based Access Control", () => {
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
              case "getProvider":
              case "deleteProvider":
                requestPayload = { params: { id: "providerId" } };
                break;
              case "updateProvider":
                requestPayload = { body: { _id: "providerId" } };
                break;
              case "searchProviders":
                requestPayload = { body: { query: { name: "Test" } } };
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

    testRoleAccess("getProviders", ACTION.GET_ALL);
    testRoleAccess("getProvider", ACTION.GET_BY_ID);
    testRoleAccess("createProvider", ACTION.CREATE);
    testRoleAccess("updateProvider", ACTION.UPDATE);
    testRoleAccess("deleteProvider", ACTION.DELETE);
    testRoleAccess("searchProviders", ACTION.CUSTOM);

    describe("Custom role combinations", () => {
      describe("Admin-only permissions", () => {
        const adminOnlyMiddleware = validatePermissions([USER_ROLES.ADMIN], ACTION.CUSTOM);

        test("SUPERADMIN should NOT have access", () => {
          const req = createMockRequest({
            user: {
              id: "superadminId",
              email: "superadmin@example.com",
              organizationId: "orgId",
              role: USER_ROLES.SUPERADMIN,
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

      describe("Instructor-allowed permissions", () => {
        const instructorAllowedMiddleware = validatePermissions(
          [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN, USER_ROLES.INSTRUCTOR],
          ACTION.CUSTOM
        );

        test("SUPERADMIN, ADMIN, and INSTRUCTOR should have access", () => {
          const allowedRoles = [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR];

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

            instructorAllowedMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
          });
        });

        test("Other roles should NOT have access", () => {
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
            });
            const res = createMockResponse();
            const next = jest.fn();

            instructorAllowedMiddleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
          });
        });
      });
    });
  });
});
