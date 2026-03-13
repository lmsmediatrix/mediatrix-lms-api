import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import activityLogService from "../../services/activityLogService";
import { config } from "../../config/common";
import activityLogRepository from "../../repository/activityLogRepository";
import { IActivityLogging } from "../../models/activityLogModel";
import { Types } from "mongoose";

jest.mock("../../repository/activityLogRepository");

const mockActivityLogRepository = activityLogRepository as jest.Mocked<
  typeof activityLogRepository
>;

function createMockActivityLog(overrides: Partial<IActivityLogging> = {}): IActivityLogging {
  return {
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    headers: { "user-agent": "test-agent" },
    ip: "127.0.0.1",
    path: "/api/users",
    method: "GET",
    action: "view_users",
    description: "User viewed all users",
    organizationId: new Types.ObjectId(),
    createdAt: new Date(),
    ...overrides,
  } as IActivityLogging;
}

describe("Activity Log Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should throw error when getting activity log without ID", async () => {
    await expect(activityLogService.getActivityLog("", {})).rejects.toThrow(
      config.RESPONSE.ERROR.ACTIVITY_LOG.INVALID_PARAMETER.GET
    );
  });

  test("should throw error when getting activity logs without params", async () => {
    await expect(
      activityLogService.getActivityLogs(null as unknown as Record<string, unknown>)
    ).rejects.toThrow(config.RESPONSE.ERROR.ACTIVITY_LOG.INVALID_PARAMETER.GET_ALL);
  });

  describe("getActivityLog", () => {
    test("should get an activity log successfully", async () => {
      const mockActivityLog = createMockActivityLog();

      mockActivityLogRepository.getActivityLog.mockResolvedValue(mockActivityLog);

      const result = await activityLogService.getActivityLog(String(mockActivityLog._id), {});

      expect(result).toBeDefined();
      expect(result?.action).toBe(mockActivityLog.action);
      expect(mockActivityLogRepository.getActivityLog).toHaveBeenCalled();
    });

    test("should return activity log with specified parameters", async () => {
      const mockActivityLog = createMockActivityLog();

      mockActivityLogRepository.getActivityLog.mockResolvedValue(mockActivityLog);

      const result = await activityLogService.getActivityLog(String(mockActivityLog._id), {
        select: ["action", "description"],
        populateArray: [{ path: "userId", select: "firstName lastName" }],
        lean: true,
      });

      expect(result).toBeDefined();
      expect(result?.action).toBe(mockActivityLog.action);
      expect(mockActivityLogRepository.getActivityLog).toHaveBeenCalledWith(
        String(mockActivityLog._id),
        expect.objectContaining({
          options: expect.objectContaining({
            select: "action description",
            populateArray: [{ path: "userId", select: "firstName lastName" }],
            lean: true,
          }),
        })
      );
    });
  });

  describe("getActivityLogs", () => {
    test("should get activity logs successfully with pagination", async () => {
      const organizationId = new Types.ObjectId();
      const mockActivityLogs = [
        createMockActivityLog({ organizationId }),
        createMockActivityLog({
          organizationId,
          path: "/api/courses",
          action: "view_courses",
          description: "User viewed all courses",
        }),
      ];

      mockActivityLogRepository.getActivityLogs.mockResolvedValue(mockActivityLogs);
      mockActivityLogRepository.activityLogCount.mockResolvedValue(2);

      const result = await activityLogService.getActivityLogs({
        limit: 10,
        page: 1,
        document: true,
        pagination: true,
      });

      expect(result).toBeDefined();
      expect(result.activityLogs.length).toBe(2);
      expect(result.pagination.totalItems).toBe(2);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.currentPage).toBe(1);
      expect(mockActivityLogRepository.getActivityLogs).toHaveBeenCalled();
      expect(mockActivityLogRepository.activityLogCount).toHaveBeenCalled();
    });

    test("should apply query filters when provided", async () => {
      const organizationId = new Types.ObjectId();
      const mockActivityLogs = [createMockActivityLog({ organizationId })];

      mockActivityLogRepository.getActivityLogs.mockResolvedValue(mockActivityLogs);
      mockActivityLogRepository.activityLogCount.mockResolvedValue(1);

      const result = await activityLogService.getActivityLogs({
        queryArray: [organizationId.toString()],
        queryArrayType: "organizationId",
        limit: 10,
        page: 1,
        document: true,
        pagination: true,
      });

      expect(result).toBeDefined();
      expect(result.activityLogs.length).toBe(1);
      expect(mockActivityLogRepository.getActivityLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          query: { organizationId: { $in: [organizationId.toString()] } },
        })
      );
    });
  });

  describe("createActivityLog", () => {
    test("should create an activity log successfully", async () => {
      const mockActivityLog = {
        userId: new Types.ObjectId(),
        headers: { "user-agent": "test-agent" },
        ip: "127.0.0.1",
        path: "/api/users",
        method: "POST",
        action: "create_user",
        description: "User created a new user",
        organizationId: new Types.ObjectId(),
      };

      const createdActivityLog = {
        ...mockActivityLog,
        _id: new Types.ObjectId(),
      } as unknown as IActivityLogging;

      mockActivityLogRepository.createActivityLog.mockResolvedValue(createdActivityLog);

      const result = await activityLogService.createActivityLog(mockActivityLog);

      expect(result).toBeDefined();
      expect(result._id).toBeDefined();
      expect(result.action).toBe("create_user");
      expect(mockActivityLogRepository.createActivityLog).toHaveBeenCalledWith(mockActivityLog);
    });

    test("should throw error when creating without data", async () => {
      await expect(
        activityLogService.createActivityLog(null as unknown as Partial<IActivityLogging>)
      ).rejects.toThrow(config.RESPONSE.ERROR.ACTIVITY_LOG.INVALID_PARAMETER.CREATE);
    });
  });

  describe("updateActivityLog", () => {
    test("should update an activity log successfully", async () => {
      const mockActivityLog = createMockActivityLog({
        description: "Updated description",
        archive: {
          status: true,
          date: new Date(),
        },
      });

      mockActivityLogRepository.updateActivityLog.mockResolvedValue(mockActivityLog);

      const result = await activityLogService.updateActivityLog(mockActivityLog);

      expect(result).toBeDefined();
      expect(result?.description).toBe(mockActivityLog.description);
      expect(result?.archive?.status).toBe(true);
      expect(mockActivityLogRepository.updateActivityLog).toHaveBeenCalledWith(mockActivityLog);
    });
  });

  describe("deleteActivityLog", () => {
    test("should delete an activity log successfully", async () => {
      const mockActivityLog = createMockActivityLog({
        method: "DELETE",
        action: "delete_user",
        description: "User deleted a user",
      });

      mockActivityLogRepository.deleteActivityLog.mockResolvedValue(mockActivityLog);

      const result = await activityLogService.deleteActivityLog(String(mockActivityLog._id));

      expect(result).toBeDefined();
      expect(result?.action).toBe("delete_user");
      expect(mockActivityLogRepository.deleteActivityLog).toHaveBeenCalledWith(
        String(mockActivityLog._id)
      );
    });

    test("should throw error when deleting without ID", async () => {
      await expect(activityLogService.deleteActivityLog("")).rejects.toThrow(
        config.RESPONSE.ERROR.ACTIVITY_LOG.INVALID_PARAMETER.DELETE
      );
    });
  });

  describe("searchActivityLog", () => {
    test("should search activity logs successfully", async () => {
      const mockActivityLogs = [
        createMockActivityLog(),
        createMockActivityLog({
          path: "/api/courses",
          action: "view_courses",
          description: "User viewed all courses",
        }),
      ];

      mockActivityLogRepository.searchActivityLog.mockResolvedValue(mockActivityLogs);

      const result = await activityLogService.searchActivityLog({
        query: {
          $or: [
            { action: { $regex: "view", $options: "i" } },
            { description: { $regex: "viewed", $options: "i" } },
          ],
        },
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(mockActivityLogRepository.searchActivityLog).toHaveBeenCalled();
    });

    test("should return pagination data when requested", async () => {
      const mockActivityLogs = [createMockActivityLog()];

      mockActivityLogRepository.searchActivityLog.mockResolvedValue(mockActivityLogs);
      mockActivityLogRepository.activityLogCount.mockResolvedValue(1);

      const result = await activityLogService.searchActivityLog({
        query: { method: "GET" },
        pagination: true,
        document: true,
        limit: 10,
      });

      expect(result).toBeDefined();
      expect(result.activityLogs).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(result.pagination.totalItems).toBe(1);
      expect(mockActivityLogRepository.searchActivityLog).toHaveBeenCalled();
      expect(mockActivityLogRepository.activityLogCount).toHaveBeenCalled();
    });
  });
});
