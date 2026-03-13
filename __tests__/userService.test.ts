import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import userService from "../services/userService";
import { config } from "../config/common";
import userRepository from "../repository/userRepository";
import * as bcrypt from "bcrypt";
import { generateToken } from "../utils/token";
import { IUser } from "../models/userModel";
import { Types } from "mongoose";

jest.mock("../repository/userRepository");
jest.mock("bcrypt");
jest.mock("../utils/token");

const mockUserRepository = userRepository as jest.Mocked<typeof userRepository>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockGenerateToken = generateToken as jest.MockedFunction<typeof generateToken>;

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

  describe("createUser", () => {
    test("should create a user successfully", async () => {
      const mockUser = {
        email: "test@example.com",
        password: "password123",
        firstName: "John",
        lastName: "Doe",
      };

      mockBcrypt.hash.mockResolvedValue("hashedPassword123" as never);
      mockUserRepository.searchAndUpdate.mockResolvedValue(null);
      mockUserRepository.createUser.mockResolvedValue({
        ...mockUser,
        _id: new Types.ObjectId(),
        password: "hashedPassword123",
        status: "active",
        type: "user",
        role: "scout",
      } as unknown as IUser);

      const result = await userService.createUser(mockUser);

      expect(result).toBeDefined();
      expect(result.email).toBe(mockUser.email);
      expect(mockBcrypt.hash).toHaveBeenCalledWith(mockUser.password, config.BCRYPT.SALT_ROUNDS);
    });

    test("should throw error when user already exists", async () => {
      const mockUser = {
        email: "existing@example.com",
        password: "password123",
      };

      mockUserRepository.searchAndUpdate.mockResolvedValue({
        _id: new Types.ObjectId(),
        email: mockUser.email,
      } as unknown as IUser);

      await expect(userService.createUser(mockUser)).rejects.toThrow(
        config.ERROR.USER.ALREADY_EXIST
      );
    });
  });

  describe("loginUser", () => {
    test("should login user successfully", async () => {
      const credentials = {
        email: "test@example.com",
        password: "password123",
      };

      const mockUser = {
        _id: new Types.ObjectId(),
        id: "123",
        email: credentials.email,
        password: "hashedPassword",
        firstName: "John",
        lastName: "Doe",
        role: "user",
        type: "regular",
        status: "active",
        archive: { status: false, date: null },
      } as unknown as IUser;

      mockUserRepository.searchAndUpdate.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockGenerateToken.mockReturnValue("mockToken");

      const result = await userService.loginUser(credentials);

      expect(result).toHaveProperty("token");
      expect(result).toHaveProperty("user");
      expect(result.user.email).toBe(credentials.email);
    });

    test("should throw error for invalid credentials", async () => {
      const credentials = {
        email: "test@example.com",
        password: "wrongpassword",
      };

      const mockUser = {
        _id: new Types.ObjectId(),
        email: credentials.email,
        password: "hashedPassword",
        status: "active",
        archive: { status: false, date: null },
      } as unknown as IUser;

      mockUserRepository.searchAndUpdate.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false as never);

      await expect(userService.loginUser(credentials)).rejects.toThrow(
        config.ERROR.USER.INVALID_CREDENTIALS
      );
    });

    test("should throw error for deactivated user", async () => {
      const credentials = {
        email: "test@example.com",
        password: "password123",
      };

      const mockUser = {
        _id: new Types.ObjectId(),
        email: credentials.email,
        password: "hashedPassword",
        status: "deactivated",
        archive: { status: false, date: null },
      } as unknown as IUser;

      mockUserRepository.searchAndUpdate.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true as never);

      await expect(userService.loginUser(credentials)).rejects.toThrow(
        config.ERROR.USER.DEACTIVATED
      );
    });
  });

  describe("updateUser", () => {
    test("should update user successfully", async () => {
      const objectId = new Types.ObjectId();
      const updateData = {
        _id: objectId,
        firstName: "Updated",
        lastName: "Name",
      } as Partial<IUser>;

      const mockExistingUser = {
        _id: objectId,
        email: "test@example.com",
        firstName: "Original",
        lastName: "Name",
        status: "active",
        type: "user",
        role: "scout",
      } as unknown as IUser;

      const mockGetUser = jest.spyOn(userService, "getUser").mockResolvedValue(mockExistingUser);
      mockUserRepository.updateUser.mockResolvedValue({
        ...mockExistingUser,
        firstName: updateData.firstName,
        lastName: updateData.lastName,
      } as unknown as IUser);

      const result = await userService.updateUser(updateData);

      expect(result).toBeDefined();
      expect(result?.firstName).toBe(updateData.firstName);
      expect(mockUserRepository.updateUser).toHaveBeenCalled();
      mockGetUser.mockRestore();
    });

    test("should throw error when updating non-existent user", async () => {
      const objectId = new Types.ObjectId();

      const updateData = {
        _id: objectId,
        firstName: "Updated",
      } as Partial<IUser>;

      mockUserRepository.getUser.mockResolvedValue(null);

      try {
        await userService.updateUser(updateData);
      } catch (error) {
        await expect(userService.updateUser(updateData)).rejects.toThrow(
          config.ERROR.USER.NOT_FOUND
        );
      }
    });
  });
});
