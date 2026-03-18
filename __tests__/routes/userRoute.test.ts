import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { Response } from "express";
import { CustomRequest } from "../../type/types";
import { config } from "../../config/common";
import userService from "../../services/userService";
import activityLogService from "../../services/activityLogService";
import auditLogService from "../../services/auditLogService";
import cloudinaryService from "../../services/cloudinaryService";
import { IUser } from "../../models/userModel";

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

jest.mock("../../middleware/zodErrorHandler", () => {
  return {
    handleZodError: jest.fn((_error, res: any) => {
      res.status(400).json({ error: "Test error" });
    }),
  };
});

import * as userRouteHandlers from "../../routes/userRoute";

jest.mock("../../services/userService");
jest.mock("../../services/activityLogService");
jest.mock("../../services/auditLogService");
jest.mock("../../services/cloudinaryService");

jest.mock("mongoose", () => {
  const originalModule = jest.requireActual("mongoose") as object;
  return {
    ...originalModule,
    Types: {
      ObjectId: jest.fn().mockImplementation((id) => id || "mockedObjectId"),
    },
  };
});

const mockUserService = userService as jest.Mocked<typeof userService>;
const mockActivityLogService = activityLogService as jest.Mocked<typeof activityLogService>;
const mockAuditLogService = auditLogService as jest.Mocked<typeof auditLogService>;
const mockCloudinaryService = cloudinaryService as jest.Mocked<typeof cloudinaryService>;

const createMockRequest = (overrides: Partial<CustomRequest> = {}): CustomRequest => {
  return {
    user: {
      id: "mockUserId",
      email: "test@example.com",
      organizationId: "mockOrgId",
    },
    params: {},
    query: {},
    body: {},
    path: "/api/user/test",
    method: "GET",
    originalUrl: "/api/user/test",
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
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
};

describe("User Route Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getUsers", () => {
    test("should get all users successfully", async () => {
      const mockUsers = [
        { _id: "user1", email: "user1@example.com" } as unknown as IUser,
        { _id: "user2", email: "user2@example.com" } as unknown as IUser,
      ];

      const mockPagination = {
        totalItems: 2,
        totalPages: 1,
        currentPage: 1,
        pageSize: 10,
      };

      mockUserService.getUsers.mockResolvedValue({
        users: mockUsers,
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

      await userRouteHandlers.getUsers(req, res);

      expect(mockUserService.getUsers).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: config.SUCCESS.USER.GET_ALL,
        data: mockUsers,
        pagination: mockPagination,
        count: 2,
      });
    });

    test("should handle error when getting users", async () => {
      const error = new Error("Test error");
      mockUserService.getUsers.mockRejectedValue(error);

      const req = createMockRequest();
      const res = createMockResponse();

      await userRouteHandlers.getUsers(req, res);

      expect(mockUserService.getUsers).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(200);
    });
  });

  describe("getUser", () => {
    test("should get a user by ID successfully", async () => {
      const userId = "mockUserId";
      const mockUser = {
        _id: userId,
        email: "user@example.com",
        firstName: "Test",
        lastName: "User",
      };

      mockUserService.getUser.mockResolvedValue(mockUser as unknown as IUser);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: userId },
      });

      const res = createMockResponse();

      await userRouteHandlers.getUser(req, res);

      expect(mockUserService.getUser).toHaveBeenCalledWith(userId, expect.any(Object));
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: config.SUCCESS.USER.GET_BY_ID,
        data: mockUser,
      });
    });

    test("should return 404 when user is not found", async () => {
      const userId = "nonExistentUserId";
      mockUserService.getUser.mockResolvedValue(null);

      const req = createMockRequest({
        params: { id: userId },
      });

      const res = createMockResponse();

      await userRouteHandlers.getUser(req, res);

      expect(mockUserService.getUser).toHaveBeenCalledWith(userId, expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith({ message: "User not found" });
    });
  });

  describe("createUser", () => {
    test("should create a user successfully", async () => {
      const mockUserData = {
        email: "newuser@example.com",
        password: "password123",
        firstName: "New",
        lastName: "User",
        role: "student",
      };

      const mockCreatedUser = {
        _id: "newUserId",
        ...mockUserData,
      };

      mockUserService.createUser.mockResolvedValue(mockCreatedUser as unknown as IUser);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockUserData,
      });

      const res = createMockResponse();

      await userRouteHandlers.createUser(req, res);

      expect(mockUserService.createUser).toHaveBeenCalledWith(
        expect.objectContaining(mockUserData),
        undefined
      );
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send).toHaveBeenCalledWith({
        message: config.SUCCESS.USER.CREATE,
        data: mockCreatedUser,
      });
    });
  });

  describe("updateUser", () => {
    test("should update a user successfully", async () => {
      const userId = "existingUserId";
      const mockUpdateData = {
        _id: userId,
        firstName: "Updated",
        lastName: "User",
      };

      const mockUpdatedUser = {
        _id: userId,
        email: "existing@example.com",
        firstName: "Updated",
        lastName: "User",
      };

      mockUserService.getUser.mockResolvedValue({
        email: "existing@example.com",
      } as unknown as IUser);
      mockUserService.updateUser.mockResolvedValue(mockUpdatedUser as unknown as IUser);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockUpdateData,
      });

      const res = createMockResponse();

      await userRouteHandlers.updateUser(req, res);

      expect(mockUserService.updateUser).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: config.SUCCESS.USER.UPDATE,
        data: mockUpdatedUser,
      });
    });
  });

  describe("deleteUser", () => {
    test("should delete a user successfully", async () => {
      const userId = "userToDeleteId";
      const mockUser = {
        _id: userId,
        email: "delete@example.com",
        firstName: "Delete",
        lastName: "User",
        role: "student",
      };

      mockUserService.getUser.mockResolvedValue(mockUser as unknown as IUser);
      mockUserService.deleteUser.mockResolvedValue(mockUser as unknown as IUser);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: userId },
      });

      const res = createMockResponse();

      await userRouteHandlers.deleteUser(req, res);

      expect(mockUserService.getUser).toHaveBeenCalledWith(userId, expect.any(Object));
      expect(mockUserService.deleteUser).toHaveBeenCalledWith(userId);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: config.SUCCESS.USER.DELETE,
        data: mockUser,
      });
    });
  });

  describe("loginUser", () => {
    test("should login a user successfully", async () => {
      const loginData = {
        email: "user@example.com",
        password: "password123",
      };

      const mockLoginResult = {
        user: {
          id: "loggedInUserId",
          email: loginData.email,
          firstname: "Test",
          lastname: "User",
          role: "student" as const,
          avatar: "avatar-url.jpg",
          organizationId: "orgId",
          isPasswordChanged: false,
        },
        token: "jwt-token-123",
      };

      mockUserService.loginUser.mockResolvedValue(mockLoginResult);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: loginData,
      });

      const res = createMockResponse();

      await userRouteHandlers.loginUser(req, res);

      expect(mockUserService.loginUser).toHaveBeenCalledWith(loginData);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith(
        "Authorization",
        `Bearer ${mockLoginResult.token}`
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        user: mockLoginResult.user,
        token: mockLoginResult.token,
        message: config.SUCCESS.USER.LOGIN,
      });
    });

    test("should handle invalid credentials", async () => {
      const loginData = {
        email: "user@example.com",
        password: "wrongpassword",
      };

      mockUserService.loginUser.mockRejectedValue(new Error(config.ERROR.USER.INVALID_CREDENTIALS));

      const req = createMockRequest({
        body: loginData,
      });

      const res = createMockResponse();

      await userRouteHandlers.loginUser(req, res);

      expect(mockUserService.loginUser).toHaveBeenCalledWith(loginData);
      expect(res.status).not.toHaveBeenCalledWith(200);
    });
  });

  describe("logoutUser", () => {
    test("should logout a user successfully", async () => {
      mockUserService.logoutUser.mockResolvedValue(undefined);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest();
      const res = createMockResponse();

      await userRouteHandlers.logoutUser(req, res);

      expect(mockUserService.logoutUser).toHaveBeenCalledWith(req);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledTimes(3);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: config.SUCCESS.USER.LOGOUT,
      });
    });
  });

  describe("currentUser", () => {
    test("should return current user information", async () => {
      const mockUserInfo = {
        user: {
          id: "currentUserId",
          email: "current@example.com",
          firstname: "Current",
          lastname: "User",
          avatar: "avatar.jpg",
          status: "active" as const,
          role: "student" as const,
          organization: "orgId",
          isPasswordChanged: false,
        },
      };

      mockUserService.currentUser.mockResolvedValue(mockUserInfo);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest();
      const res = createMockResponse();

      await userRouteHandlers.currentUser(req, res);

      expect(mockUserService.currentUser).toHaveBeenCalledWith(req);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockUserInfo);
    });

    test("should return 401 when user is not authenticated", async () => {
      const req = createMockRequest({ user: undefined });
      const res = createMockResponse();

      await userRouteHandlers.currentUser(req, res);

      expect(mockUserService.currentUser).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: config.ERROR.USER.NOT_AUTHORIZED });
    });
  });

  describe("searchUser", () => {
    test("should search users successfully", async () => {
      const searchQuery = { query: { name: "test" } };
      const mockSearchResults = [
        { _id: "user1", email: "user1@example.com" },
        { _id: "user2", email: "user2@example.com" },
      ];

      mockUserService.searchUser.mockResolvedValue(mockSearchResults as unknown as IUser[]);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: searchQuery,
      });

      const res = createMockResponse();

      await userRouteHandlers.searchUser(req, res);

      expect(mockUserService.searchUser).toHaveBeenCalledWith(searchQuery);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockSearchResults);
    });
  });

  describe("uploadImage", () => {
    test("should upload user avatar successfully", async () => {
      const userId = "userWithAvatarId";
      const mockFile = {
        filename: "avatar.jpg",
        path: "/tmp/avatar.jpg",
      };

      const mockUser = {
        _id: userId,
        email: "user@example.com",
        avatar: "https://example.com/old-avatar.jpg",
      };

      const mockUpdatedUser = {
        ...mockUser,
        avatar: "https://example.com/new-avatar.jpg",
      };

      mockUserService.getUser.mockResolvedValue(mockUser as unknown as IUser);
      mockCloudinaryService.deleteImage.mockResolvedValue({} as unknown as any);
      mockCloudinaryService.uploadImage.mockResolvedValue("https://example.com/new-avatar.jpg");
      mockUserService.updateUser.mockResolvedValue(mockUpdatedUser as unknown as IUser);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: userId },
        file: mockFile as unknown as Express.Multer.File,
      });

      const res = createMockResponse();

      await userRouteHandlers.uploadImage(req, res);

      expect(mockUserService.getUser).toHaveBeenCalledWith(userId, expect.any(Object));
      expect(mockCloudinaryService.deleteImage).toHaveBeenCalled();
      expect(mockCloudinaryService.uploadImage).toHaveBeenCalledWith(mockFile);
      expect(mockUserService.updateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: expect.any(Object),
          avatar: "https://example.com/new-avatar.jpg",
        })
      );
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockUpdatedUser);
    });

    test("should return 400 when no file is uploaded", async () => {
      const userId = "userWithAvatarId";
      const req = createMockRequest({
        params: { id: userId },
        file: undefined,
      });

      const res = createMockResponse();

      await userRouteHandlers.uploadImage(req, res);

      expect(mockUserService.getUser).not.toHaveBeenCalled();
      expect(mockCloudinaryService.uploadImage).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Please upload an image" });
    });
  });

  describe("getUserMetrics", () => {
    test("should get user metrics successfully", async () => {
      const mockMetrics = {
        totalUsers: 100,
        activeUsers: 80,
        inactiveUsers: 20,
      };

      mockUserService.getUserMetrics.mockResolvedValue(mockMetrics);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        query: {
          filter: "week",
          type: "student",
        },
      });

      const res = createMockResponse();

      await userRouteHandlers.getUserMetrics(req, res);

      expect(mockUserService.getUserMetrics).toHaveBeenCalledWith("mockOrgId", "week", "student");
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: config.SUCCESS.USER.METRICS,
        data: mockMetrics,
      });
    });
  });

  describe("archiveUser", () => {
    test("should archive a user successfully", async () => {
      const userId = "userToArchiveId";
      const mockArchivedUser = {
        _id: userId,
        email: "archive@example.com",
        firstName: "Archive",
        lastName: "User",
        archive: { status: true, date: new Date() },
      };

      mockUserService.archiveUser.mockResolvedValue(mockArchivedUser as unknown as IUser);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: userId },
      });

      const res = createMockResponse();

      await userRouteHandlers.archiveUser(req, res);

      expect(mockUserService.archiveUser).toHaveBeenCalledWith(userId);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: config.SUCCESS.USER.ARCHIVE,
        data: mockArchivedUser,
      });
    });

    test("should return 404 when user to archive is not found", async () => {
      const userId = "nonExistentUserId";
      mockUserService.archiveUser.mockResolvedValue(null);

      const req = createMockRequest({
        params: { id: userId },
      });

      const res = createMockResponse();

      await userRouteHandlers.archiveUser(req, res);

      expect(mockUserService.archiveUser).toHaveBeenCalledWith(userId);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "user not found" });
    });
  });

  describe("User Zod Validation", () => {
    describe("createUser validation", () => {
      test("should validate required fields", async () => {
        const invalidData = {
          lastName: "Doe",
          email: "john@example.com",
          password: "password123",
          role: "student",
        };

        mockUserService.createUser.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalCreateUser = userRouteHandlers.createUser;
        jest.spyOn(userRouteHandlers, "createUser").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await userRouteHandlers.createUser(req, res);

        expect(mockUserService.createUser).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest.spyOn(userRouteHandlers, "createUser").mockImplementation(originalCreateUser);
      });

      test("should validate email format", async () => {
        const invalidData = {
          firstName: "John",
          lastName: "Doe",
          email: "invalid-email",
          password: "password123",
          role: "student",
        };

        mockUserService.createUser.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalCreateUser = userRouteHandlers.createUser;
        jest.spyOn(userRouteHandlers, "createUser").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await userRouteHandlers.createUser(req, res);

        expect(mockUserService.createUser).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest.spyOn(userRouteHandlers, "createUser").mockImplementation(originalCreateUser);
      });

      test("should validate password length", async () => {
        const invalidData = {
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          password: "12",
          role: "student",
        };

        mockUserService.createUser.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalCreateUser = userRouteHandlers.createUser;
        jest.spyOn(userRouteHandlers, "createUser").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await userRouteHandlers.createUser(req, res);

        expect(mockUserService.createUser).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest.spyOn(userRouteHandlers, "createUser").mockImplementation(originalCreateUser);
      });

      test("should validate field lengths", async () => {
        const invalidData = {
          firstName: "A".repeat(51),
          lastName: "B".repeat(51),
          email: "john@example.com",
          password: "password123",
          role: "student",
        };

        mockUserService.createUser.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalCreateUser = userRouteHandlers.createUser;
        jest.spyOn(userRouteHandlers, "createUser").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await userRouteHandlers.createUser(req, res);

        expect(mockUserService.createUser).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest.spyOn(userRouteHandlers, "createUser").mockImplementation(originalCreateUser);
      });

      test("should validate phone number format", async () => {
        const invalidData = {
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          password: "password123",
          phone: "123456",
          role: "student",
        };

        mockUserService.createUser.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalCreateUser = userRouteHandlers.createUser;
        jest.spyOn(userRouteHandlers, "createUser").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await userRouteHandlers.createUser(req, res);

        expect(mockUserService.createUser).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest.spyOn(userRouteHandlers, "createUser").mockImplementation(originalCreateUser);
      });

      test("should validate role enum values", async () => {
        const invalidData = {
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          password: "password123",
          role: "invalid-role",
        };

        mockUserService.createUser.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalCreateUser = userRouteHandlers.createUser;
        jest.spyOn(userRouteHandlers, "createUser").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await userRouteHandlers.createUser(req, res);

        expect(mockUserService.createUser).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest.spyOn(userRouteHandlers, "createUser").mockImplementation(originalCreateUser);
      });
    });

    describe("updateUser validation", () => {
      test("should validate that _id is provided", async () => {
        const invalidData = {
          firstName: "Updated",
          lastName: "User",
        };

        mockUserService.updateUser.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalUpdateUser = userRouteHandlers.updateUser;
        jest.spyOn(userRouteHandlers, "updateUser").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await userRouteHandlers.updateUser(req, res);

        expect(mockUserService.updateUser).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest.spyOn(userRouteHandlers, "updateUser").mockImplementation(originalUpdateUser);
      });

      test("should validate field formats in update", async () => {
        const invalidData = {
          _id: "userId",
          firstName: "A",
          lastName: "B",
          email: "invalid-email",
        };

        mockUserService.updateUser.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalUpdateUser = userRouteHandlers.updateUser;
        jest.spyOn(userRouteHandlers, "updateUser").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await userRouteHandlers.updateUser(req, res);

        expect(mockUserService.updateUser).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest.spyOn(userRouteHandlers, "updateUser").mockImplementation(originalUpdateUser);
      });
    });

    describe("loginUser validation", () => {
      test("should validate required login fields", async () => {
        const invalidData = {
          password: "password123",
        };

        mockUserService.loginUser.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalLoginUser = userRouteHandlers.loginUser;
        jest.spyOn(userRouteHandlers, "loginUser").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await userRouteHandlers.loginUser(req, res);

        expect(mockUserService.loginUser).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest.spyOn(userRouteHandlers, "loginUser").mockImplementation(originalLoginUser);
      });

      test("should validate email format in login", async () => {
        const invalidData = {
          email: "invalid-email",
          password: "password123",
        };

        mockUserService.loginUser.mockReset();

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        const originalLoginUser = userRouteHandlers.loginUser;
        jest.spyOn(userRouteHandlers, "loginUser").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error" });
          return;
        });

        await userRouteHandlers.loginUser(req, res);

        expect(mockUserService.loginUser).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);

        jest.spyOn(userRouteHandlers, "loginUser").mockImplementation(originalLoginUser);
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
      allowedRoles: string[] = ["admin", "superadmin"]
    ) => {
      describe(`${endpoint} endpoint permissions`, () => {
        const allRoles = {
          superadmin: { shouldPass: allowedRoles.includes("superadmin") },
          admin: { shouldPass: allowedRoles.includes("admin") },
          instructor: { shouldPass: allowedRoles.includes("instructor") },
          student: { shouldPass: allowedRoles.includes("student") },
          employee: { shouldPass: allowedRoles.includes("employee") },
          user: { shouldPass: allowedRoles.includes("user") },
          view: { shouldPass: allowedRoles.includes("view") },
        };

        Object.entries(allRoles).forEach(([role, { shouldPass }]) => {
          test(`${role} ${shouldPass ? "should have" : "should NOT have"} access`, () => {
            const middleware = jest.fn((req: CustomRequest, res: Response, next: jest.Mock) => {
              if (!req.user) {
                return res.status(401).json({ message: "Not authenticated" });
              }

              if (!req.user.role || !allowedRoles.includes(req.user.role)) {
                return res.status(403).json({ message: "Not authorized" });
              }

              next();
            });

            let requestPayload = {};
            switch (endpoint) {
              case "getUser":
                requestPayload = { params: { id: "userId" } };
                break;
              case "updateUser":
                requestPayload = {
                  body: {
                    _id: "userId",
                    firstName: "Updated",
                    lastName: "User",
                  },
                };
                break;
              case "deleteUser":
                requestPayload = { params: { id: "userId" } };
                break;
              case "uploadImage":
                requestPayload = {
                  params: { id: "userId" },
                  file: { path: "/uploads/avatar.jpg" },
                };
                break;
              case "searchUser":
                requestPayload = {
                  body: {
                    query: {
                      firstName: "John",
                    },
                  },
                };
                break;
            }

            const req = createMockRequest({
              user: {
                id: `${role}Id`,
                email: `${role}@example.com`,
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

    testRoleAccess("getUsers", "GET_ALL", ["admin", "superadmin"]);
    testRoleAccess("getUser", "GET_BY_ID", ["admin", "superadmin", "instructor"]);
    testRoleAccess("createUser", "CREATE", ["admin", "superadmin"]);
    testRoleAccess("updateUser", "UPDATE", ["admin", "superadmin"]);
    testRoleAccess("deleteUser", "DELETE", ["admin", "superadmin"]);
    testRoleAccess("searchUser", "SEARCH", ["admin", "superadmin", "instructor"]);
    testRoleAccess("uploadImage", "UPDATE", ["admin", "superadmin", "instructor", "student"]);

    describe("Special user permission scenarios", () => {
      describe("Self-service permissions", () => {
        test("Users should be able to update their own profile", () => {
          const userOwnId = "currentUserId";

          const middleware = jest.fn((req: CustomRequest, res: Response, next: jest.Mock) => {
            if (!req.user) {
              return res.status(401).json({ message: "Not authenticated" });
            }

            if (req.body._id === req.user.id) {
              return next();
            }

            if (!["admin", "superadmin"].includes(req.user.role)) {
              return res.status(403).json({ message: "Not authorized" });
            }

            next();
          });

          const selfUpdateReq = createMockRequest({
            user: {
              id: userOwnId,
              email: "user@example.com",
              organizationId: "orgId",
              role: "student",
              firstName: "",
              lastName: "",
            },
            body: {
              _id: userOwnId,
              firstName: "Updated",
              lastName: "User",
            },
          });

          const res = createMockResponse();
          const next = jest.fn();

          middleware(selfUpdateReq, res, next);

          expect(next).toHaveBeenCalled();
          expect(res.status).not.toHaveBeenCalled();
        });

        test("Regular users should NOT be able to update other users' profiles", () => {
          const userOwnId = "currentUserId";
          const otherUserId = "otherUserId";

          const middleware = jest.fn((req: CustomRequest, res: Response, next: jest.Mock) => {
            if (!req.user) {
              return res.status(401).json({ message: "Not authenticated" });
            }

            if (req.body._id === req.user.id) {
              return next();
            }

            if (!["admin", "superadmin"].includes(req.user.role)) {
              return res.status(403).json({ message: "Not authorized" });
            }

            next();
          });

          const updateOtherReq = createMockRequest({
            user: {
              id: userOwnId,
              email: "user@example.com",
              organizationId: "orgId",
              role: "student",
              firstName: "",
              lastName: "",
            },
            body: {
              _id: otherUserId,
              firstName: "Other",
              lastName: "User",
            },
          });

          const res = createMockResponse();
          const next = jest.fn();

          middleware(updateOtherReq, res, next);

          expect(next).not.toHaveBeenCalled();
          expect(res.status).toHaveBeenCalledWith(403);
        });
      });
    });
  });
});
