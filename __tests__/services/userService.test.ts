import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import userService from "../../services/userService";
import { config } from "../../config/common";
import userRepository from "../../repository/userRepository";
import organizationRepository from "../../repository/organizationRepository";
import cloudinaryService from "../../services/cloudinaryService";
import * as bcrypt from "bcrypt";
import * as tokenUtils from "../../utils/token";
import { IUser } from "../../models/userModel";
import { Types } from "mongoose";
import { USER_ROLE, USER_STATUS, GENDERS } from "../../config/common";

jest.mock("../../repository/userRepository");
jest.mock("../../repository/organizationRepository");
jest.mock("../../services/cloudinaryService");
jest.mock("bcrypt");
jest.mock("../../utils/token");

const mockUserRepository = userRepository as jest.Mocked<typeof userRepository>;
const mockOrganizationRepository = organizationRepository as jest.Mocked<
  typeof organizationRepository
>;
const mockCloudinaryService = cloudinaryService as jest.Mocked<typeof cloudinaryService>;

describe("User Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should throw error when getting user without ID", async () => {
    await expect(userService.getUser("", {})).rejects.toThrow(config.ERROR.USER.NO_ID);
  });

  test("should throw error when getting users without params", async () => {
    await expect(userService.getUsers(null as any)).rejects.toThrow(
      config.RESPONSE.ERROR.USER.INVALID_PARAMETER.GET_ALL
    );
  });

  describe("getUser", () => {
    test("should get a user successfully", async () => {
      const organizationId = new Types.ObjectId();
      const mockUser = {
        _id: new Types.ObjectId(),
        firstName: "John",
        lastName: "Doe",
        email: "test@example.com",
        password: "hashedpassword",
        role: "superadmin" as const,
        status: "active" as const,
        organizationId,
        isDeleted: false,
      } as unknown as IUser;

      mockUserRepository.getUser.mockResolvedValue(mockUser);

      const result = await userService.getUser(mockUser._id.toString(), {
        query: { organizationId: organizationId.toString() },
      });

      expect(result).toBeDefined();
      expect(result?.email).toBe(mockUser.email);
      expect(mockUserRepository.getUser).toHaveBeenCalled();
    });

    test("should return null when organizationId is not provided", async () => {
      mockUserRepository.getUser.mockResolvedValue({
        _id: new Types.ObjectId(),
        firstName: "John",
        lastName: "Doe",
        email: "test@example.com",
        password: "hashedpassword",
        role: "superadmin" as const,
        status: "active" as const,
        organizationId: new Types.ObjectId(),
        isDeleted: false,
        phone: "12345678901",
        avatar: "https://example.com/avatar.png",
        gender: "male",
        dateOfBirth: new Date("2025-04-11"),
      } as unknown as IUser);

      const result = await userService.getUser("123", {});

      expect(result).toBeDefined();
      expect(result?.email).toBe("test@example.com");
      expect(mockUserRepository.getUser).toHaveBeenCalled();
    });
  });

  describe("getUsers", () => {
    test("should get users successfully with pagination", async () => {
      const organizationId = new Types.ObjectId();
      const mockUsers = [
        {
          _id: new Types.ObjectId(),
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          password: "hashedpassword",
          role: "admin" as const,
          status: "active" as const,
          organizationId,
          isDeleted: false,
        },
        {
          _id: new Types.ObjectId(),
          firstName: "Jane",
          lastName: "Doe",
          email: "jane.doe@example.com",
          password: "hashedpassword",
          role: "admin" as const,
          status: "active" as const,
          organizationId,
          isDeleted: false,
        },
      ] as unknown as IUser[];

      mockUserRepository.getUsers.mockResolvedValue(mockUsers);
      mockUserRepository.countUsers.mockResolvedValue(2);

      const result = await userService.getUsers({
        limit: 10,
        page: 1,
        query: { organizationId: organizationId.toString() },
        document: true,
        pagination: true,
      });

      expect(result).toBeDefined();
      expect(result.users.length).toBe(2);
      expect(result.pagination.totalItems).toBe(2);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.currentPage).toBe(1);
      expect(mockUserRepository.getUsers).toHaveBeenCalled();
      expect(mockUserRepository.countUsers).toHaveBeenCalled();
    });

    test("should return empty result when organizationId is not provided", async () => {
      const result = await userService.getUsers({ limit: 10 });

      expect(result).toBeDefined();
      expect(result.users.length).toBe(0);
      expect(mockUserRepository.getUsers).not.toHaveBeenCalled();
    });
  });

  describe("createUser", () => {
    test("should create a user successfully", async () => {
      const mockUser = {
        _id: new Types.ObjectId(),
        email: "test@example.com",
        password: "password123",
        firstName: "John",
        lastName: "Doe",
        organizationId: new Types.ObjectId(),
        role: "student",
      } as unknown as IUser;

      mockUserRepository.searchAndUpdate.mockResolvedValue(null);
      mockUserRepository.createUser.mockResolvedValue({
        ...mockUser,
        password: "hashedPassword123",
      } as unknown as IUser);

      const result = await userService.createUser(mockUser);

      expect(result).toBeDefined();
      expect(result).toEqual({
        ...mockUser,
        password: "hashedPassword123",
      });
      expect(mockUserRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          organizationId: mockUser.organizationId,
          role: mockUser.role,
        })
      );
    });

    test("should create an admin user and update organization successfully", async () => {
      const organizationId = new Types.ObjectId();
      const mockUser = {
        email: "admin@example.com",
        password: "password123",
        firstName: "Admin",
        lastName: "User",
        phone: "12345678901",
        dateOfBirth: new Date(),
        gender: GENDERS[0],
        role: "admin" as (typeof USER_ROLE)[number],
        status: USER_STATUS[0],
        organizationId: organizationId,
      };

      const createdUser = {
        ...mockUser,
        _id: new Types.ObjectId(),
        password: "hashedPassword123",
        avatar: "",
        isDeleted: false,
        isVerified: true,
      } as unknown as IUser;

      mockUserRepository.searchAndUpdate.mockResolvedValue(null);
      mockUserRepository.createUser.mockResolvedValue(createdUser);
      mockOrganizationRepository.updateOrganization.mockResolvedValue({} as any);

      const result = await userService.createUser(mockUser);

      expect(result).toBeDefined();
      expect(result.role).toBe("admin");
      expect(mockOrganizationRepository.updateOrganization).toHaveBeenCalledWith({
        _id: organizationId,
        $push: { admins: createdUser._id },
      });
    });

    test("should throw error when user already exists", async () => {
      const mockUser = {
        _id: new Types.ObjectId(),
        email: "test@example.com",
        password: "password123",
        firstName: "John",
        lastName: "Doe",
        organizationId: new Types.ObjectId(),
        role: "student",
      } as unknown as IUser;

      mockUserRepository.searchAndUpdate.mockResolvedValue(mockUser);

      await expect(userService.createUser(mockUser)).rejects.toThrow(
        config.ERROR.USER.ALREADY_EXIST
      );
    });

    test("should upload avatar when files are provided", async () => {
      const mockUser = {
        email: "test@example.com",
        password: "password123",
        firstName: "John",
        lastName: "Doe",
        role: USER_ROLE[0] as (typeof USER_ROLE)[number],
        organizationId: new Types.ObjectId(),
        path: "some/path",
      };

      const files = {
        avatar: [
          {
            filename: "avatar.png",
            path: "/tmp/avatar.png",
          } as Express.Multer.File,
        ],
      };

      mockUserRepository.searchAndUpdate.mockResolvedValue(null);
      mockCloudinaryService.uploadImage.mockResolvedValue("https://example.com/avatar.png");
      mockUserRepository.createUser.mockResolvedValue({
        ...mockUser,
        _id: new Types.ObjectId(),
        password: "hashedPassword123",
        avatar: "https://example.com/avatar.png",
        isDeleted: false,
        isVerified: true,
      } as unknown as IUser);

      const result = await userService.createUser(mockUser, files);

      expect(result).toBeDefined();
      expect(result.avatar).toBe("https://example.com/avatar.png");
      expect(mockCloudinaryService.uploadImage).toHaveBeenCalled();
    });
  });

  describe("updateUser", () => {
    test("should update a user successfully", async () => {
      const mockUser = {
        _id: new Types.ObjectId(),
        email: "updated@example.com",
        firstName: "Updated",
        lastName: "User",
        phone: "12345678901",
        dateOfBirth: new Date(),
        gender: GENDERS[0],
        avatar: "https://example.com/avatar.png",
        role: USER_ROLE[0] as (typeof USER_ROLE)[number],
        status: USER_STATUS[0],
        isDeleted: false,
        organizationId: new Types.ObjectId(),
      } as unknown as IUser;

      mockUserRepository.updateUser.mockResolvedValue(mockUser);

      const result = await userService.updateUser(mockUser);

      expect(result).toBeDefined();
      expect(result?.email).toBe(mockUser.email);
      expect(mockUserRepository.updateUser).toHaveBeenCalled();
    });

    test("should throw error when updating without data", async () => {
      const emptyData = { _id: new Types.ObjectId() };
      const mockGetUser = jest.spyOn(userService, "getUser").mockResolvedValue(null);
      mockUserRepository.updateUser.mockResolvedValue(null);

      await expect(userService.updateUser(emptyData)).rejects.toThrow(config.ERROR.USER.NOT_FOUND);

      expect(mockGetUser).toHaveBeenCalledWith(emptyData._id.toString(), {
        select: ["avatar", "password"],
        query: { organizationId: undefined },
      });
      expect(mockUserRepository.updateUser).not.toHaveBeenCalled();
      mockGetUser.mockRestore();
    });

    test("should upload avatar when updating with files", async () => {
      const mockUser = {
        _id: new Types.ObjectId(),
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        path: "some/path",
        organizationId: new Types.ObjectId(),
      };

      const files = {
        avatar: [
          {
            filename: "updated_avatar.png",
            path: "/tmp/updated_avatar.png",
          } as Express.Multer.File,
        ],
      };

      mockUserRepository.getUser.mockResolvedValue({
        _id: mockUser._id,
        email: mockUser.email,
        avatar: "https://example.com/old_avatar.png",
      } as unknown as IUser);

      mockCloudinaryService.uploadImage.mockResolvedValue("https://example.com/updated_avatar.png");
      mockCloudinaryService.deleteImage.mockResolvedValue();
      mockUserRepository.updateUser.mockResolvedValue({
        ...mockUser,
        avatar: "https://example.com/updated_avatar.png",
      } as unknown as IUser);

      const result = await userService.updateUser(mockUser, files);

      expect(result).toBeDefined();
      expect(result?.avatar).toBe("https://example.com/updated_avatar.png");
      expect(mockCloudinaryService.uploadImage).toHaveBeenCalled();
    });
  });

  describe("deleteUser", () => {
    test("should delete a user successfully", async () => {
      const mockUser = {
        _id: new Types.ObjectId(),
        email: "delete@example.com",
        firstName: "Delete",
        lastName: "User",
        phone: "12345678901",
        role: USER_ROLE[0] as (typeof USER_ROLE)[number],
        status: USER_STATUS[0],
        archive: { status: true, date: new Date() },
        organizationId: new Types.ObjectId(),
      } as unknown as IUser;

      mockUserRepository.archiveUser.mockResolvedValue(mockUser);
      mockUserRepository.getUser.mockResolvedValue(mockUser);

      const result = await userService.deleteUser(mockUser._id.toString());

      expect(result).toBeDefined();
      expect(result?.archive?.status).toBe(true);
      expect(mockUserRepository.archiveUser).toHaveBeenCalled();
    });

    test("should throw error when deleting without ID", async () => {
      await expect(userService.deleteUser("")).rejects.toThrow(config.ERROR.USER.NO_ID);
    });
  });

  describe("searchUser", () => {
    test("should search users successfully", async () => {
      const mockUsers = [
        {
          _id: new Types.ObjectId(),
          email: "john@example.com",
          firstName: "John",
          lastName: "Doe",
          phone: "12345678901",
          dateOfBirth: new Date(),
          gender: GENDERS[0],
          avatar: "https://example.com/avatar1.png",
          role: USER_ROLE[0] as (typeof USER_ROLE)[number],
          status: USER_STATUS[0],
          isDeleted: false,
          organizationId: new Types.ObjectId(),
        },
        {
          _id: new Types.ObjectId(),
          email: "jane@example.com",
          firstName: "Jane",
          lastName: "Smith",
          phone: "12345678902",
          dateOfBirth: new Date(),
          gender: GENDERS[1],
          avatar: "https://example.com/avatar2.png",
          role: USER_ROLE[0] as (typeof USER_ROLE)[number],
          status: USER_STATUS[0],
          isDeleted: false,
          organizationId: new Types.ObjectId(),
        },
      ] as unknown as IUser[];

      mockUserRepository.searchUser.mockResolvedValue(mockUsers);

      const result = await userService.searchUser({
        query: {
          organizationId: new Types.ObjectId(),
          $or: [
            { firstName: { $regex: "Jo", $options: "i" } },
            { lastName: { $regex: "Jo", $options: "i" } },
          ],
        },
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result?.length).toBe(2);
      expect(mockUserRepository.searchUser).toHaveBeenCalled();
    });

    test("should return empty array when organizationId not provided", async () => {
      const searchParams = { organizationId: undefined };
      mockUserRepository.searchUser.mockResolvedValue([]);

      const result = await userService.searchUser(searchParams);

      expect(result).toEqual([]);
      expect(mockUserRepository.searchUser).toHaveBeenCalledWith({
        lean: true,
        match: {},
        options: {
          limit: 10,
          select: "_id",
          skip: 0,
          sort: "-createdAt",
        },
        populateArray: [],
        query: {},
      });
    });
  });

  describe("loginUser", () => {
    test("should successfully login user with email and password", async () => {
      const mockUser = {
        _id: new Types.ObjectId(),
        email: "test@example.com",
        password: "hashedPassword",
        firstName: "John",
        lastName: "Doe",
        organizationId: new Types.ObjectId(),
        role: "student",
        status: "active",
        isPasswordChanged: false,
        id: new Types.ObjectId().toString(),
        archive: { status: false, date: null },
      } as unknown as IUser;

      mockUserRepository.searchAndUpdate.mockResolvedValue(mockUser);
      jest.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
      jest.mocked(tokenUtils.generateToken).mockReturnValueOnce("generated_token");

      const result = await userService.loginUser({
        email: "test@example.com",
        password: "password123",
      });

      expect(result).toBeDefined();
      expect(result.token).toBe("generated_token");
      expect(result.user.email).toBe("test@example.com");
      expect(mockUserRepository.searchAndUpdate).toHaveBeenCalledWith({
        email: "test@example.com",
      });
    });

    test("should throw error when user is not found", async () => {
      const loginData = {
        email: "nonexistent@example.com",
        password: "password123",
      };

      mockUserRepository.searchAndUpdate.mockResolvedValue(null);

      await expect(userService.loginUser(loginData)).rejects.toThrow(config.ERROR.USER.NO_ACCOUNT);
    });

    test("should throw error for invalid credentials", async () => {
      const mockUser = {
        _id: new Types.ObjectId(),
        email: "test@example.com",
        password: "hashedPassword",
        firstName: "John",
        lastName: "Doe",
        organizationId: new Types.ObjectId(),
        role: "student",
        status: "active",
        archive: { status: false, date: null },
      } as unknown as IUser;

      mockUserRepository.searchAndUpdate.mockResolvedValue(mockUser);
      jest.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);

      await expect(
        userService.loginUser({
          email: "test@example.com",
          password: "wrongpassword",
        })
      ).rejects.toThrow(config.ERROR.USER.INVALID_CREDENTIALS);
    });
  });

  describe("getUserMetrics", () => {
    test("should get user metrics successfully", async () => {
      const organizationId = new Types.ObjectId().toString();
      const filter = "week";
      const type = "instructor";

      const mockMetrics = {
        fullTimeCount: 5,
        partTimeCount: 3,
        probationaryCount: 2,
        instructorCount: 10,
        teacherStudentRatio: 1.5,
      };

      mockUserRepository.getUserMetrics
        .mockResolvedValueOnce(mockMetrics)
        .mockResolvedValueOnce(mockMetrics);

      const result = await userService.getUserMetrics(organizationId, filter, type);

      expect(result).toBeDefined();
      expect(result).toEqual({
        fullTime: expect.any(Object),
        partTime: expect.any(Object),
        probationary: expect.any(Object),
        instructor: expect.any(Object),
        teacherStudentRatio: expect.any(Object),
      });
      expect(mockUserRepository.getUserMetrics).toHaveBeenCalledTimes(2);
    });
  });
});
