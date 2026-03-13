import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import auditLogService from "../../services/auditLogService";
import { config } from "../../config/common";
import auditLogRepository from "../../repository/auditLogRepository";
import { IAuditLog } from "../../models/auditLogModel";
import { Types } from "mongoose";

jest.mock("../../repository/auditLogRepository");

const mockAuditLogRepository = auditLogRepository as jest.Mocked<typeof auditLogRepository>;

function createMockAuditLog(overrides: Partial<IAuditLog> = {}): IAuditLog {
  return {
    _id: new Types.ObjectId(),
    user: new Types.ObjectId(),
    type: "UPDATE",
    severity: "INFO",
    entity: {
      type: "USER",
      id: new Types.ObjectId(),
    },
    changes: {
      before: { status: "active" },
      after: { status: "inactive" },
    },
    metadata: {
      userAgent: "test-agent",
      ip: "127.0.0.1",
      path: "/api/users",
      method: "PUT",
    },
    description: "User status updated",
    timestamp: new Date(),
    organizationId: new Types.ObjectId(),
    ...overrides,
  } as IAuditLog;
}

describe("Audit Log Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should throw error when getting audit log without ID", async () => {
    await expect(auditLogService.getAuditLog("", {})).rejects.toThrow(
      config.RESPONSE.ERROR.AUDIT_LOG.INVALID_PARAMETER.GET
    );
  });

  test("should throw error when getting audit logs without params", async () => {
    await expect(
      auditLogService.getAuditLogs(null as unknown as Record<string, unknown>)
    ).rejects.toThrow(config.RESPONSE.ERROR.AUDIT_LOG.INVALID_PARAMETER.GET_ALL);
  });

  describe("getAuditLog", () => {
    test("should get an audit log successfully", async () => {
      const mockAuditLog = createMockAuditLog();

      mockAuditLogRepository.getAuditLog.mockResolvedValue(mockAuditLog);

      const result = await auditLogService.getAuditLog(String(mockAuditLog._id), {});

      expect(result).toBeDefined();
      expect(result?.type).toBe(mockAuditLog.type);
      expect(result?.severity).toBe(mockAuditLog.severity);
      expect(mockAuditLogRepository.getAuditLog).toHaveBeenCalled();
    });

    test("should return audit log with specified parameters", async () => {
      const mockAuditLog = createMockAuditLog();

      mockAuditLogRepository.getAuditLog.mockResolvedValue(mockAuditLog);

      const result = await auditLogService.getAuditLog(String(mockAuditLog._id), {
        select: ["type", "severity", "description"],
        populateArray: [{ path: "user", select: "firstName lastName" }],
        lean: true,
      });

      expect(result).toBeDefined();
      expect(result?.type).toBe(mockAuditLog.type);
      expect(mockAuditLogRepository.getAuditLog).toHaveBeenCalledWith(
        String(mockAuditLog._id),
        expect.objectContaining({
          options: expect.objectContaining({
            select: "type severity description",
            populateArray: [{ path: "user", select: "firstName lastName" }],
            lean: true,
          }),
        })
      );
    });
  });

  describe("getAuditLogs", () => {
    test("should get audit logs successfully with pagination", async () => {
      const organizationId = new Types.ObjectId();
      const mockAuditLogs = [
        createMockAuditLog({ organizationId }),
        createMockAuditLog({
          organizationId,
          type: "CREATE",
          description: "User created",
          entity: {
            type: "USER",
            id: new Types.ObjectId(),
          },
        }),
      ];

      mockAuditLogRepository.getAuditLogs.mockResolvedValue(mockAuditLogs);
      mockAuditLogRepository.getAuditLogsCount.mockResolvedValue(2);

      const result = await auditLogService.getAuditLogs({
        limit: 10,
        page: 1,
        document: true,
        pagination: true,
      });

      expect(result).toBeDefined();
      expect(result.auditLogs.length).toBe(2);
      expect(result.pagination.totalItems).toBe(2);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.currentPage).toBe(1);
      expect(mockAuditLogRepository.getAuditLogs).toHaveBeenCalled();
      expect(mockAuditLogRepository.getAuditLogsCount).toHaveBeenCalled();
    });

    test("should apply query filters when provided", async () => {
      const organizationId = new Types.ObjectId();
      const mockAuditLogs = [createMockAuditLog({ organizationId })];

      mockAuditLogRepository.getAuditLogs.mockResolvedValue(mockAuditLogs);
      mockAuditLogRepository.getAuditLogsCount.mockResolvedValue(1);

      const result = await auditLogService.getAuditLogs({
        queryArray: [organizationId.toString()],
        queryArrayType: "organizationId",
        limit: 10,
        page: 1,
        document: true,
        pagination: true,
      });

      expect(result).toBeDefined();
      expect(result.auditLogs.length).toBe(1);
      expect(mockAuditLogRepository.getAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          query: { organizationId: { $in: [organizationId.toString()] } },
        })
      );
    });
  });

  describe("createAuditLog", () => {
    test("should create an audit log successfully", async () => {
      const newAuditLogData = {
        user: new Types.ObjectId(),
        type: "CREATE",
        severity: "INFO",
        entity: {
          type: "COURSE",
          id: new Types.ObjectId(),
        },
        changes: {
          after: { title: "New Course", description: "Course description" },
        },
        metadata: {
          userAgent: "test-agent",
          ip: "127.0.0.1",
          path: "/api/courses",
          method: "POST",
        },
        description: "Course created",
        organizationId: new Types.ObjectId(),
      };

      const createdAuditLog = {
        ...newAuditLogData,
        _id: new Types.ObjectId(),
        timestamp: new Date(),
      } as unknown as IAuditLog;

      mockAuditLogRepository.createAuditLog.mockResolvedValue(createdAuditLog);

      const result = await auditLogService.createAuditLog(newAuditLogData);

      expect(result).toBeDefined();
      expect(result._id).toBeDefined();
      expect(result.type).toBe("CREATE");
      expect(result.entity.type).toBe("COURSE");
      expect(mockAuditLogRepository.createAuditLog).toHaveBeenCalledWith(newAuditLogData);
    });

    test("should throw error when creating without data", async () => {
      await expect(
        auditLogService.createAuditLog(null as unknown as Partial<IAuditLog>)
      ).rejects.toThrow(config.RESPONSE.ERROR.AUDIT_LOG.INVALID_PARAMETER.CREATE);
    });
  });

  describe("updateAuditLog", () => {
    test("should update an audit log successfully", async () => {
      const mockAuditLog = createMockAuditLog({
        description: "Updated description",
        archive: {
          status: true,
          date: new Date(),
        },
      });

      mockAuditLogRepository.updateAuditLog.mockResolvedValue(mockAuditLog);

      const result = await auditLogService.updateAuditLog(mockAuditLog);

      expect(result).toBeDefined();
      expect(result?.description).toBe(mockAuditLog.description);
      expect(result?.archive?.status).toBe(true);
      expect(mockAuditLogRepository.updateAuditLog).toHaveBeenCalledWith(mockAuditLog);
    });
  });

  describe("deleteAuditLog", () => {
    test("should delete an audit log successfully", async () => {
      const mockAuditLog = createMockAuditLog({
        type: "DELETE",
        description: "User deleted",
        entity: {
          type: "USER",
          id: new Types.ObjectId(),
        },
      });

      mockAuditLogRepository.deleteAuditLog.mockResolvedValue(mockAuditLog);

      const result = await auditLogService.deleteAuditLog(String(mockAuditLog._id));

      expect(result).toBeDefined();
      expect(result?.type).toBe("DELETE");
      expect(mockAuditLogRepository.deleteAuditLog).toHaveBeenCalledWith(String(mockAuditLog._id));
    });

    test("should throw error when deleting without ID", async () => {
      await expect(auditLogService.deleteAuditLog("")).rejects.toThrow(
        config.RESPONSE.ERROR.AUDIT_LOG.INVALID_PARAMETER.DELETE
      );
    });
  });

  describe("searchAuditLog", () => {
    test("should search audit logs successfully", async () => {
      const mockAuditLogs = [
        createMockAuditLog(),
        createMockAuditLog({
          type: "CREATE",
          description: "Course created",
          entity: {
            type: "COURSE",
            id: new Types.ObjectId(),
          },
        }),
      ];

      mockAuditLogRepository.searchAuditLog.mockResolvedValue(mockAuditLogs);

      const result = await auditLogService.searchAuditLog({
        query: {
          $or: [{ type: "UPDATE" }, { type: "CREATE" }],
        },
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(mockAuditLogRepository.searchAuditLog).toHaveBeenCalled();
    });

    test("should return pagination data when requested", async () => {
      const mockAuditLogs = [createMockAuditLog()];

      mockAuditLogRepository.searchAuditLog.mockResolvedValue(mockAuditLogs);
      mockAuditLogRepository.getAuditLogsCount.mockResolvedValue(1);

      const result = await auditLogService.searchAuditLog({
        query: { type: "UPDATE" },
        pagination: true,
        document: true,
        limit: 10,
      });

      expect(result).toBeDefined();
      expect(result.auditLogs).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(result.pagination.totalItems).toBe(1);
      expect(mockAuditLogRepository.searchAuditLog).toHaveBeenCalled();
      expect(mockAuditLogRepository.getAuditLogsCount).toHaveBeenCalled();
    });
  });
});
