import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { Types, Query } from "mongoose";
import User, { IUser } from "../../models/userModel";
import userRepository from "../../repository/userRepository";

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

jest.mock("../../models/userModel", () => {
  return {
    __esModule: true,
    default: {
      findById: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      create: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateMany: jest.fn(),
      aggregate: jest.fn(),
      insertMany: jest.fn(),
    },
  };
});

type MockQueryChain = {
  where: jest.Mock;
  ne: jest.Mock;
  equals: jest.Mock;
  populate: jest.Mock;
  sort: jest.Mock;
  limit: jest.Mock;
  select: jest.Mock;
  lean: jest.Mock;
  skip: jest.Mock;
  setQuery: jest.Mock;
  projection: jest.Mock;
  setOptions: jest.Mock;
  exec: jest.Mock;
};

const createMockQueryChain = <T>(returnValue: T): Partial<MockQueryChain> => {
  const mockChain: Partial<MockQueryChain> = {
    where: jest.fn().mockReturnThis(),
    ne: jest.fn().mockReturnThis(),
    equals: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    setQuery: jest.fn().mockReturnThis(),
    projection: jest.fn().mockReturnThis(),
    setOptions: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(returnValue as never),
  };

  return mockChain;
};

const mockUser: IUser = {
  _id: new Types.ObjectId("mockedId"),
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@example.com",
  password: "hashedPassword",
  role: "admin",
  status: "active",
  organizationId: new Types.ObjectId("orgId"),
  createdAt: new Date(),
  updatedAt: new Date(),
  archive: { status: false, date: null },
} as unknown as IUser;

const mockUserModel = User as jest.Mocked<typeof User>;

describe("User Repository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getUser", () => {
    test("should get a user by ID successfully", async () => {
      const userId = mockUser._id.toString();
      const queryChain = createMockQueryChain(mockUser);
      mockUserModel.findById.mockReturnValue(queryChain as unknown as Query<IUser | null, IUser>);

      const result = await userRepository.getUser(userId);

      expect(result).toEqual(mockUser);
      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
    });

    test("should handle populating arrays properly", async () => {
      const userId = mockUser._id.toString();
      const populateArray = [{ path: "organizationId", select: "name code" }, "anotherField"];

      const queryChain = createMockQueryChain(mockUser);
      mockUserModel.findById.mockReturnValue(queryChain as unknown as Query<IUser | null, IUser>);

      const result = await userRepository.getUser(userId, {
        options: { populateArray },
      });

      expect(result).toEqual(mockUser);
      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
    });

    test("should include archived users when specified", async () => {
      const userId = mockUser._id.toString();

      const queryChain = createMockQueryChain(mockUser);
      mockUserModel.findById.mockReturnValue(queryChain as unknown as Query<IUser | null, IUser>);

      const result = await userRepository.getUser(userId, {
        query: { includeArchived: true },
      });

      expect(result).toEqual(mockUser);
      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
    });
  });

  describe("getUsers", () => {
    test("should get users with pagination successfully", async () => {
      const mockUsers = [
        mockUser,
        { ...mockUser, _id: new Types.ObjectId("user2"), email: "jane.doe@example.com" },
      ];

      const queryChain = createMockQueryChain(mockUsers);
      mockUserModel.find.mockReturnValue(queryChain as unknown as Query<IUser[], IUser>);

      const result = await userRepository.getUsers({
        options: {
          limit: 10,
          skip: 0,
          sort: { createdAt: -1 },
        },
      });

      expect(result).toEqual(mockUsers);
      expect(mockUserModel.find).toHaveBeenCalled();
    });

    test("should filter by organizationId when provided", async () => {
      const orgId = "testOrgId";

      const queryChain = createMockQueryChain([mockUser]);
      mockUserModel.find.mockReturnValue(queryChain as unknown as Query<IUser[], IUser>);

      const result = await userRepository.getUsers({
        query: { organizationId: orgId },
      });

      expect(result).toEqual([mockUser]);
      expect(mockUserModel.find).toHaveBeenCalled();
    });

    test("should exclude archived users by default", async () => {
      const queryChain = createMockQueryChain([mockUser]);
      mockUserModel.find.mockReturnValue(queryChain as unknown as Query<IUser[], IUser>);

      const result = await userRepository.getUsers({});

      expect(result).toEqual([mockUser]);
      expect(mockUserModel.find).toHaveBeenCalled();
    });
  });

  describe("countUsers", () => {
    test("should count users successfully", async () => {
      const queryChain = createMockQueryChain(5);
      mockUserModel.countDocuments.mockReturnValue(queryChain as unknown as Query<number, IUser>);

      const result = await userRepository.countUsers({});

      expect(result).toBe(5);
      expect(mockUserModel.countDocuments).toHaveBeenCalledWith({});
    });

    test("should count users with specific query", async () => {
      const query = { role: "admin" };

      const queryChain = createMockQueryChain(2);
      mockUserModel.countDocuments.mockReturnValue(queryChain as unknown as Query<number, IUser>);

      const result = await userRepository.countUsers(query);

      expect(result).toBe(2);
      expect(mockUserModel.countDocuments).toHaveBeenCalledWith(query);
    });
  });

  describe("createUser", () => {
    test("should create a user successfully", async () => {
      const userData = {
        firstName: "New",
        lastName: "User",
        email: "new.user@example.com",
        password: "password123",
      };

      const createdUser = {
        id: "newUserId",
        ...userData,
      } as IUser;

      const userWithoutPassword = {
        id: "newUserId",
        firstName: "New",
        lastName: "User",
        email: "new.user@example.com",
      };

      // Mock User.create to return createdUser with an id property
      mockUserModel.create.mockResolvedValue(createdUser as any);

      mockUserModel.findById.mockReturnValue(
        createMockQueryChain(mockUser) as unknown as Query<IUser | null, IUser>
      );

      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(userWithoutPassword as unknown as never),
        }),
      } as unknown as Query<IUser | null, IUser>);

      const result = await userRepository.createUser(userData as Partial<IUser>);
      // console.log(result);
      expect(result).toEqual(userWithoutPassword as Partial<IUser>);
      expect(mockUserModel.create).toHaveBeenCalledWith(userData);
      expect(mockUserModel.findById).toHaveBeenCalledWith(createdUser.id);
    });
  });

  describe("updateUser", () => {
    test("should update a user successfully", async () => {
      const userId = mockUser._id.toString();
      const updateData = {
        firstName: "Updated",
        lastName: "Name",
      };

      const updatedUser = {
        ...mockUser,
        ...updateData,
      };

      mockUserModel.findByIdAndUpdate.mockResolvedValue(updatedUser as any);

      const result = await userRepository.updateUser(userId, updateData as Partial<IUser>);

      expect(result).toEqual(updatedUser);
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        { $set: updateData },
        { new: true }
      );
    });
  });

  describe("deleteUser", () => {
    test("should delete a user successfully", async () => {
      const userId = mockUser._id.toString();

      mockUserModel.findByIdAndDelete.mockResolvedValue(mockUser as any);

      const result = await userRepository.deleteUser(userId);

      expect(result).toEqual(mockUser);
      expect(mockUserModel.findByIdAndDelete).toHaveBeenCalledWith(userId);
    });
  });

  describe("searchUser", () => {
    test("should search users successfully", async () => {
      const searchParams = {
        query: { firstName: "John" },
        populateArray: [{ path: "organizationId" }],
      };

      const queryChain = createMockQueryChain([mockUser]);
      mockUserModel.find.mockReturnValue(queryChain as unknown as Query<IUser[], IUser>);

      const result = await userRepository.searchUser(searchParams);

      expect(result).toEqual([mockUser]);
      expect(mockUserModel.find).toHaveBeenCalled();
    });

    test("should exclude archived users by default", async () => {
      const queryChain = createMockQueryChain([mockUser]);
      mockUserModel.find.mockReturnValue(queryChain as unknown as Query<IUser[], IUser>);

      const result = await userRepository.searchUser({});

      expect(result).toEqual([mockUser]);
      expect(mockUserModel.find).toHaveBeenCalled();
    });
  });

  describe("searchAndUpdate", () => {
    test("should search and find a user without updating", async () => {
      const query = { email: mockUser.email };
      const populatedUser = {
        ...mockUser,
        organizationId: { code: "TEST", type: "school", branding: {} },
      } as unknown as IUser;

      mockUserModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(populatedUser as unknown as never),
        }),
      } as unknown as Query<IUser | null, IUser>);

      const result = await userRepository.searchAndUpdate(query);

      expect(result).toEqual(populatedUser as IUser);
      expect(mockUserModel.findOne).toHaveBeenCalledWith(query);
    });

    test("should search and update a user successfully", async () => {
      const query = { email: mockUser.email };
      const update = { firstName: "Updated" };

      const updatedUser = {
        ...mockUser,
        ...update,
      };

      mockUserModel.findOneAndUpdate.mockResolvedValue(updatedUser as any);

      const result = await userRepository.searchAndUpdate(query, update);

      expect(result).toEqual(updatedUser);
      expect(mockUserModel.findOneAndUpdate).toHaveBeenCalledWith(query, update, { new: true });
    });

    test("should update many users when multi flag is true", async () => {
      const query = { role: "student" };
      const update = { status: "inactive" };
      const mockResult = { modifiedCount: 5 };

      mockUserModel.updateMany.mockResolvedValue(mockResult as any);

      const result = await userRepository.searchAndUpdate(query, update, { multi: true });

      expect(result).toEqual(mockResult);
      expect(mockUserModel.updateMany).toHaveBeenCalledWith(query, update);
    });
  });

  describe("getUserMetrics", () => {
    test("should get user metrics successfully", async () => {
      const organizationId = "orgId";
      const startTime = new Date();
      const endTime = new Date();
      const mockMetrics = {
        fullTimeCount: 5,
        partTimeCount: 3,
        probationaryCount: 2,
        instructorCount: 10,
        teacherStudentRatio: 1.5,
        studentCount: 15,
        activeStudentCount: 12,
        inactiveStudentCount: 3,
        studentGPA: 3.5,
      };

      mockUserModel.aggregate.mockResolvedValue([mockMetrics] as any);

      const result = await userRepository.getUserMetrics(organizationId, startTime, endTime);

      expect(result).toEqual(mockMetrics);
      expect(mockUserModel.aggregate).toHaveBeenCalled();
    });

    test("should handle errors gracefully", async () => {
      const organizationId = "orgId";
      const startTime = new Date();
      const endTime = new Date();

      mockUserModel.aggregate.mockImplementation(() => {
        throw new Error("Database error");
      });

      const result = await userRepository.getUserMetrics(organizationId, startTime, endTime);

      expect(result).toEqual({
        fullTimeCount: 0,
        partTimeCount: 0,
        probationaryCount: 0,
        instructorCount: 0,
        teacherStudentRatio: 0,
        studentCount: 0,
        activeStudentCount: 0,
        inactiveStudentCount: 0,
        studentGPA: 0,
      });
      expect(mockUserModel.aggregate).toHaveBeenCalled();
    });
  });

  describe("bulkCreate", () => {
    test("should create multiple users successfully", async () => {
      const usersData = [
        {
          firstName: "User1",
          lastName: "Test1",
          email: "user1@example.com",
          password: "password1",
        },
        {
          firstName: "User2",
          lastName: "Test2",
          email: "user2@example.com",
          password: "password2",
        },
      ];

      const createdUsers = usersData.map((user, index) => ({
        _id: `id${index + 1}`,
        ...user,
      }));

      mockUserModel.insertMany.mockResolvedValue(createdUsers as any);

      const result = await userRepository.bulkCreate(usersData as Partial<IUser>[]);

      expect(result).toEqual(createdUsers);
      expect(mockUserModel.insertMany).toHaveBeenCalledWith(usersData, { ordered: true });
    });
  });

  describe("archiveUser", () => {
    test("should archive a user successfully", async () => {
      const userId = mockUser._id.toString();
      const archiveDate = new Date();

      const archivedUser = {
        ...mockUser,
        archive: {
          status: true,
          date: archiveDate,
        },
      };

      mockUserModel.findByIdAndUpdate.mockResolvedValue(archivedUser as any);

      const result = await userRepository.archiveUser(userId);

      expect(result).toEqual(archivedUser);
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        {
          $set: {
            "archive.status": true,
            "archive.date": expect.any(Date),
          },
        },
        { new: true }
      );
    });
  });
});
