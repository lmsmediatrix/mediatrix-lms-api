import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { Response } from "express";
import { CustomRequest } from "../../type/types";
import voucherService from "../../services/voucherService";
import activityLogService from "../../services/activityLogService";
import auditLogService from "../../services/auditLogService";
import { IVoucher } from "../../models/voucherModel";
import { parseCSVBuffer } from "../../utils/csvUtils/csvUtils";

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

jest.mock("../../utils/csvUtils", () => ({
  parseCSVBuffer: jest.fn(),
}));

import * as voucherRouteHandlers from "../../routes/voucherRoute";
import { validatePermissions } from "../../middleware/rabcMiddleware";

jest.mock("../../services/voucherService");
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

const mockVoucherService = voucherService as jest.Mocked<typeof voucherService>;
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
    path: "/api/voucher/test",
    method: "GET",
    originalUrl: "/api/voucher/test",
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

describe("Voucher Route Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getVouchers", () => {
    test("should get all vouchers successfully", async () => {
      const mockVouchers = [
        { _id: "voucher1", code: "VOUCHER1", name: "Voucher 1" } as unknown as IVoucher,
        { _id: "voucher2", code: "VOUCHER2", name: "Voucher 2" } as unknown as IVoucher,
      ];

      const mockPagination = {
        totalItems: 2,
        totalPages: 1,
        currentPage: 1,
        pageSize: 10,
      };

      mockVoucherService.getVouchers.mockResolvedValue({
        vouchers: mockVouchers,
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

      await voucherRouteHandlers.getVouchers(req, res);

      expect(mockVoucherService.getVouchers).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: "Vouchers retrieved successfully",
        data: mockVouchers,
        pagination: mockPagination,
        count: 2,
      });
    });

    test("should handle error when getting vouchers", async () => {
      const error = new Error("Test error");
      mockVoucherService.getVouchers.mockRejectedValue(error);

      const req = createMockRequest();
      const res = createMockResponse();

      await voucherRouteHandlers.getVouchers(req, res);

      expect(mockVoucherService.getVouchers).toHaveBeenCalled();
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

  describe("getVoucher", () => {
    test("should get a voucher by ID successfully", async () => {
      const voucherId = "mockVoucherId";
      const mockVoucher = {
        _id: voucherId,
        code: "TESTVOUCHER",
        name: "Test Voucher",
        discount: 10,
      };

      mockVoucherService.getVoucher.mockResolvedValue(mockVoucher as unknown as IVoucher);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: voucherId },
      });

      const res = createMockResponse();

      await voucherRouteHandlers.getVoucher(req, res);

      expect(mockVoucherService.getVoucher).toHaveBeenCalledWith(voucherId, expect.any(Object));
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: "Voucher retrieved successfully",
        data: mockVoucher,
      });
    });

    test("should return 404 when voucher is not found", async () => {
      const voucherId = "nonExistentVoucherId";
      mockVoucherService.getVoucher.mockResolvedValue(null);

      const req = createMockRequest({
        params: { id: voucherId },
      });

      const res = createMockResponse();

      await voucherRouteHandlers.getVoucher(req, res);

      expect(mockVoucherService.getVoucher).toHaveBeenCalledWith(voucherId, expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith({ message: "Voucher not found" });
    });

    test("should require admin or superadmin role for accessing single voucher", async () => {
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
        params: { id: "voucherId" },
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
        params: { id: "voucherId" },
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

  describe("createVoucher", () => {
    test("should create a voucher successfully", async () => {
      const mockVoucherData = {
        name: "New Voucher",
        code: "NEWVOUCHER",
        description: "Test voucher description",
        discount: 15,
      };

      const mockCreatedVoucher = {
        _id: "newVoucherId",
        ...mockVoucherData,
      };

      mockVoucherService.createVoucher.mockResolvedValue(mockCreatedVoucher as unknown as IVoucher);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockVoucherData,
      });

      const res = createMockResponse();

      await voucherRouteHandlers.createVoucher(req, res);

      expect(mockVoucherService.createVoucher).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockVoucherData,
          organizationId: expect.any(Object),
        })
      );
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send).toHaveBeenCalledWith({
        message: "Voucher created successfully",
        data: mockCreatedVoucher,
      });
    });

    test("should require admin or superadmin role for creating vouchers", async () => {
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

  describe("updateVoucher", () => {
    test("should update a voucher successfully", async () => {
      const voucherId = "existingVoucherId";
      const mockUpdateData = {
        _id: voucherId,
        name: "Updated Voucher",
        description: "Updated description",
      };

      const mockUpdatedVoucher = {
        _id: voucherId,
        code: "EXISTINGCODE",
        name: "Updated Voucher",
        description: "Updated description",
        discount: 20,
      };

      mockVoucherService.getVoucher.mockResolvedValue({
        code: "EXISTINGCODE",
        discount: 20,
      } as unknown as IVoucher);
      mockVoucherService.updateVoucher.mockResolvedValue(mockUpdatedVoucher as unknown as IVoucher);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockUpdateData,
      });

      const res = createMockResponse();

      await voucherRouteHandlers.updateVoucher(req, res);

      expect(mockVoucherService.updateVoucher).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: "Voucher updated successfully",
        data: mockUpdatedVoucher,
      });
    });

    test("should require admin or superadmin role for updating vouchers", async () => {
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
        body: { _id: "voucherId", name: "Updated Voucher" },
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
        body: { _id: "voucherId", name: "Updated Voucher" },
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

  describe("deleteVoucher", () => {
    test("should delete a voucher successfully", async () => {
      const voucherId = "voucherToDeleteId";
      const mockVoucher = {
        _id: voucherId,
        code: "DELETEVOUCHER",
        name: "Voucher to Delete",
        status: "active",
      };

      mockVoucherService.getVoucher.mockResolvedValue(mockVoucher as unknown as IVoucher);
      mockVoucherService.deleteVoucher.mockResolvedValue(mockVoucher as unknown as IVoucher);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: voucherId },
      });

      const res = createMockResponse();

      await voucherRouteHandlers.deleteVoucher(req, res);

      expect(mockVoucherService.getVoucher).toHaveBeenCalledWith(voucherId, expect.any(Object));
      expect(mockVoucherService.deleteVoucher).toHaveBeenCalledWith(voucherId);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: "Voucher deleted successfully",
        data: mockVoucher,
      });
    });

    test("should return 404 when voucher to delete is not found", async () => {
      const voucherId = "nonExistentVoucherId";
      mockVoucherService.getVoucher.mockResolvedValue(null);

      const req = createMockRequest({
        params: { id: voucherId },
      });

      const res = createMockResponse();

      await voucherRouteHandlers.deleteVoucher(req, res);

      expect(mockVoucherService.getVoucher).toHaveBeenCalledWith(voucherId, expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith({ message: "Voucher not found" });
    });

    test("should require admin or superadmin role for deleting vouchers", async () => {
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
        params: { id: "voucherId" },
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
        params: { id: "voucherId" },
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

  describe("searchVouchers", () => {
    test("should search vouchers successfully", async () => {
      const searchQuery = { query: { name: "Discount" } };
      const mockSearchResults = [
        { _id: "voucher1", code: "DISCOUNT10", name: "10% Discount Voucher" },
        { _id: "voucher2", code: "DISCOUNT20", name: "20% Discount Voucher" },
      ];

      mockVoucherService.searchVoucher.mockResolvedValue(
        mockSearchResults as unknown as IVoucher[]
      );
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: searchQuery,
      });

      const res = createMockResponse();

      await voucherRouteHandlers.searchVouchers(req, res);

      expect(mockVoucherService.searchVoucher).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            name: "Discount",
            organizationId: expect.any(String),
          }),
        })
      );
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockSearchResults);
    });

    test("should require admin or superadmin role for searching vouchers", async () => {
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
        body: { query: { name: "Discount" } },
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
        body: { query: { name: "Discount" } },
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

  describe("bulkCreateVouchers", () => {
    test("should create multiple vouchers from CSV successfully", async () => {
      const csvData = [
        {
          name: "Bulk Voucher 1",
          code: "BULK001",
          description: "Bulk created voucher 1",
          discount: 10,
        },
        {
          name: "Bulk Voucher 2",
          code: "BULK002",
          description: "Bulk created voucher 2",
          discount: 15,
        },
      ];

      const mockResult = {
        successCount: 2,
        successList: [
          { _id: "id1", code: "BULK001", name: "Bulk Voucher 1" },
          { _id: "id2", code: "BULK002", name: "Bulk Voucher 2" },
        ],
        errorCount: 0,
        errorList: [],
      };

      jest.mocked(parseCSVBuffer).mockResolvedValue(csvData);

      mockVoucherService.bulkCreateVouchers.mockResolvedValue(mockResult);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        file: {
          buffer: Buffer.from("test,csv,data"),
        } as Express.Multer.File,
      });

      const res = createMockResponse();

      await voucherRouteHandlers.bulkCreateVouchers(req, res);

      expect(mockVoucherService.bulkCreateVouchers).toHaveBeenCalledWith({
        csvData,
        organizationId: expect.any(String),
      });
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: `Successfully created ${mockResult.successCount} vouchers (${mockResult.errorCount} failed)`,
        result: mockResult,
      });
    });

    test("should handle empty CSV data", async () => {
      jest.mocked(parseCSVBuffer).mockResolvedValue([]);

      const req = createMockRequest({
        file: {
          buffer: Buffer.from(""),
        } as Express.Multer.File,
      });

      const res = createMockResponse();

      await voucherRouteHandlers.bulkCreateVouchers(req, res);

      expect(parseCSVBuffer).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({
        message: "CSV file contains no valid data",
      });
    });

    test("should handle missing file", async () => {
      const req = createMockRequest({
        file: undefined,
      });

      const res = createMockResponse();

      await voucherRouteHandlers.bulkCreateVouchers(req, res);

      expect(mockVoucherService.bulkCreateVouchers).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(200);
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
              case "getVoucher":
              case "deleteVoucher":
                requestPayload = { params: { id: "voucherId" } };
                break;
              case "updateVoucher":
                requestPayload = { body: { _id: "voucherId" } };
                break;
              case "searchVouchers":
                requestPayload = { body: { query: { name: "Test" } } };
                break;
              case "bulkCreateVouchers":
                requestPayload = {
                  file: { buffer: Buffer.from("test,csv,data") } as Express.Multer.File,
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

    testRoleAccess("getVouchers", ACTION.GET_ALL);
    testRoleAccess("getVoucher", ACTION.GET_BY_ID);
    testRoleAccess("createVoucher", ACTION.CREATE);
    testRoleAccess("updateVoucher", ACTION.UPDATE);
    testRoleAccess("deleteVoucher", ACTION.DELETE);
    testRoleAccess("searchVouchers", ACTION.CUSTOM);
    testRoleAccess("bulkCreateVouchers", ACTION.CREATE);

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
