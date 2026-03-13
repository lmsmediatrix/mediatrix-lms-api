import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import instructorService from "../../services/instructorService";
import { config } from "../../config/common";
import instructorRepository from "../../repository/instructorRepository";
import userRepository from "../../repository/userRepository";
import { IInstructor } from "../../models/instructorModel";
import { Types } from "mongoose";

jest.mock("../../repository/instructorRepository");
jest.mock("../../repository/userRepository");
jest.mock("../../repository/organizationRepository");

jest.mock("../../services/cloudinaryService", () => {
  return {
    __esModule: true,
    default: {
      uploadImage: jest
        .fn()
        .mockImplementation(() => Promise.resolve("https://example.com/image.jpg")),
    },
  };
});

const mockInstructorRepository = {
  getInstructor: jest.fn(),
  getInstructors: jest.fn(),
  createInstructor: jest.fn(),
  updateInstructor: jest.fn(),
  deleteInstructor: jest.fn(),
  searchInstructor: jest.fn(),
  searchAndUpdate: jest.fn(),
  findOrCreate: jest.fn(),
  instructorDashboard: jest.fn(),
  getInstructorsCount: jest.fn().mockImplementation(() => Promise.resolve(2)),
  getSectionLoadForInstructor: jest.fn().mockImplementation(() =>
    Promise.resolve({
      total: 0,
      sections: [],
    })
  ),
  archiveInstructor: jest.fn(),
} as unknown as jest.Mocked<typeof instructorRepository>;

const mockUserRepository = {
  getUser: jest.fn(),
} as unknown as jest.Mocked<typeof userRepository>;

(instructorRepository as jest.Mocked<typeof instructorRepository>) = mockInstructorRepository;
(userRepository as jest.Mocked<typeof userRepository>) = mockUserRepository;

describe("Instructor Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should throw error when getting instructor without ID", async () => {
    await expect(instructorService.getInstructor("", {})).rejects.toThrow(
      config.RESPONSE.ERROR.INSTRUCTOR.ID
    );
  });

  test("should throw error when getting instructors without params", async () => {
    await expect(instructorService.getInstructors(null as any)).rejects.toThrow(
      config.RESPONSE.ERROR.INSTRUCTOR.INVALID_PARAMETER.GET_ALL
    );
  });

  describe("getInstructor", () => {
    test("should get an instructor successfully", async () => {
      const organizationId = new Types.ObjectId();
      const mockInstructor = {
        _id: new Types.ObjectId(),
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        password: "hashedpassword123",
        role: "instructor" as const,
        status: "active" as const,
        userId: new Types.ObjectId(),
        organizationId,
        employmentType: "full_time" as const,
        expertise: ["Computer Science", "Programming"],
        faculty: "Engineering",
        experienceYears: 5,
        qualifications: ["Ph.D. in Computer Science"],
        bio: "Experienced instructor with 5+ years of teaching",
        ratings: {
          average: 4.5,
          total_reviews: 20,
        },
        isVerified: true,
      } as unknown as IInstructor;

      mockInstructorRepository.getInstructor.mockResolvedValue(mockInstructor);

      const result = await instructorService.getInstructor(mockInstructor._id.toString(), {
        query: { organizationId: organizationId.toString() },
      });

      expect(result).toBeDefined();
      expect(result?.employmentType).toBe(mockInstructor.employmentType);
      expect(mockInstructorRepository.getInstructor).toHaveBeenCalled();
    });
  });

  describe("getInstructors", () => {
    test("should get instructors successfully with pagination", async () => {
      const organizationId = new Types.ObjectId();
      const mockInstructors = [
        {
          _id: new Types.ObjectId(),
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          password: "hashedpassword123",
          role: "instructor" as const,
          status: "active" as const,
          userId: new Types.ObjectId(),
          organizationId,
          employmentType: "full_time" as const,
          expertise: ["Computer Science"],
          faculty: "Engineering",
          isVerified: true,
        },
        {
          _id: new Types.ObjectId(),
          firstName: "Jane",
          lastName: "Doe",
          email: "jane.doe@example.com",
          password: "hashedpassword456",
          role: "instructor" as const,
          status: "active" as const,
          userId: new Types.ObjectId(),
          organizationId,
          employmentType: "full_time" as const,
          expertise: ["Physics"],
          faculty: "Science",
          isVerified: true,
        },
      ] as unknown as IInstructor[];

      const mockQuery = { organizationId: organizationId.toString() };
      mockInstructorRepository.getInstructors.mockResolvedValue(mockInstructors);
      mockInstructorRepository.getInstructorsCount.mockResolvedValue(2);

      const result = await instructorService.getInstructors({
        limit: 10,
        page: 1,
        query: mockQuery,
        document: true,
        pagination: true,
      });

      expect(result).toBeDefined();
      expect(result.instructors.length).toBe(2);
      expect(result.pagination.totalItems).toBe(2);
      expect(mockInstructorRepository.getInstructors).toHaveBeenCalledWith(
        expect.objectContaining({
          query: mockQuery,
          options: expect.objectContaining({
            skip: 0,
            limit: 10,
          }),
        })
      );
      expect(mockInstructorRepository.getInstructorsCount).toHaveBeenCalledWith(mockQuery);
    });
  });

  describe("createInstructor", () => {
    test("should create an instructor successfully", async () => {
      const organizationId = new Types.ObjectId();
      const mockUser = {
        _id: new Types.ObjectId(),
        firstName: "Robert",
        lastName: "Brown",
        email: "instructor@example.com",
        password: "hashedpassword123",
        role: "instructor" as const,
        status: "active" as const,
      } as any;

      const mockInstructorData = {
        firstName: "Robert",
        lastName: "Brown",
        email: "instructor@example.com",
        password: "password123",
        role: "instructor" as const,
        userId: mockUser._id,
        organizationId,
        employmentType: "full_time" as const,
        expertise: ["Computer Science"],
        faculty: new Types.ObjectId(),
        experienceYears: 5,
        qualifications: ["Ph.D. in Computer Science"],
        isVerified: false,
      };

      const mockCreatedInstructor = {
        _id: new Types.ObjectId(),
        ...mockInstructorData,
      } as unknown as IInstructor;

      mockUserRepository.getUser.mockResolvedValue(mockUser);
      mockInstructorRepository.searchAndUpdate.mockResolvedValue(null);
      mockInstructorRepository.createInstructor.mockResolvedValue(mockCreatedInstructor);

      const result = await instructorService.createInstructor({
        ...mockInstructorData,
        faculty: new Types.ObjectId(mockInstructorData.faculty),
      });

      expect(result).toBeDefined();
      expect(result.employmentType).toBe(mockInstructorData.employmentType);
      expect(mockInstructorRepository.createInstructor).toHaveBeenCalled();
    }, 10000);

    test("should throw error when creating without data", async () => {
      await expect(instructorService.createInstructor(null as any)).rejects.toThrow(
        config.ERROR.USER.REQUIRED_FIELDS
      );
    });

    test("should throw error when user does not exist", async () => {
      const organizationId = new Types.ObjectId();
      const mockInstructorData = {
        _id: new Types.ObjectId(),
        firstName: "Robert",
        lastName: "Brown",
        email: "instructor@example.com",
        password: "password123",
        role: "instructor" as const,
        status: "active" as const,
        organizationId,
        employmentType: "full_time" as const,
        expertise: ["Computer Science"],
        faculty: new Types.ObjectId(),
        experienceYears: 5,
        qualifications: ["Ph.D. in Computer Science"],
        isVerified: false,
      } as unknown as IInstructor;

      mockUserRepository.getUser.mockResolvedValue(null);
      mockInstructorRepository.searchAndUpdate.mockResolvedValue(null);
      mockInstructorRepository.createInstructor.mockRejectedValue(
        new Error(config.ERROR.USER.NOT_FOUND)
      );

      await expect(instructorService.createInstructor(mockInstructorData)).rejects.toThrow(
        config.ERROR.USER.NOT_FOUND
      );

      expect(mockInstructorRepository.searchAndUpdate).toHaveBeenCalledWith({
        email: mockInstructorData.email,
      });
      expect(mockInstructorRepository.createInstructor).toHaveBeenCalled();
    });
  });

  describe("updateInstructor", () => {
    test("should update an instructor successfully", async () => {
      const organizationId = new Types.ObjectId();
      const mockInstructor = {
        _id: new Types.ObjectId(),
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        password: "hashedpassword123",
        role: "instructor" as const,
        status: "active" as const,
        userId: new Types.ObjectId(),
        organizationId,
        employmentType: "part_time" as const,
        expertise: ["Mathematics"],
        faculty: "Science",
        experienceYears: 3,
        qualifications: ["M.Sc. in Mathematics"],
        bio: "Updated bio information",
        isVerified: true,
      } as unknown as IInstructor;

      mockInstructorRepository.getInstructor.mockResolvedValue(mockInstructor);
      mockInstructorRepository.updateInstructor.mockResolvedValue(mockInstructor);

      const result = await instructorService.updateInstructor(mockInstructor);

      expect(result).toBeDefined();
      expect(result?.bio).toBe(mockInstructor.bio);
      expect(mockInstructorRepository.updateInstructor).toHaveBeenCalled();
    });

    test("should throw error when updating without data", async () => {
      await expect(instructorService.updateInstructor(null as any)).rejects.toThrow(
        config.RESPONSE.ERROR.INSTRUCTOR.INVALID_PARAMETER.UPDATE
      );
    });
  });

  describe("deleteInstructor", () => {
    test("should delete an instructor successfully", async () => {
      const organizationId = new Types.ObjectId();
      const mockInstructor = {
        _id: new Types.ObjectId(),
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        password: "hashedpassword123",
        role: "instructor" as const,
        status: "active" as const,
        userId: new Types.ObjectId(),
        organizationId,
        employmentType: "full_time" as const,
        expertise: ["Computer Science"],
        faculty: "Engineering",
        isVerified: true,
        archive: { status: true, date: new Date() },
      } as unknown as IInstructor;

      mockInstructorRepository.archiveInstructor.mockResolvedValue(mockInstructor);
      mockInstructorRepository.getInstructor.mockResolvedValue(mockInstructor);

      const result = await instructorService.deleteInstructor(mockInstructor._id.toString());

      expect(result).toBeDefined();
      expect(result?.archive?.status).toBe(true);
      expect(mockInstructorRepository.archiveInstructor).toHaveBeenCalled();
    });

    test("should throw error when deleting without ID", async () => {
      await expect(instructorService.deleteInstructor("")).rejects.toThrow(
        config.RESPONSE.ERROR.INSTRUCTOR.INVALID_PARAMETER.REMOVE
      );
    });
  });

  describe("searchInstructor", () => {
    test("should search instructors successfully", async () => {
      const organizationId = new Types.ObjectId();
      const mockInstructors = [
        {
          _id: new Types.ObjectId(),
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          password: "hashedpassword123",
          role: "instructor" as const,
          status: "active" as const,
          userId: new Types.ObjectId(),
          organizationId,
          employmentType: "full_time" as const,
          expertise: ["Computer Science"],
          faculty: "Engineering",
          isVerified: true,
        },
        {
          _id: new Types.ObjectId(),
          firstName: "Jane",
          lastName: "Doe",
          email: "jane.doe@example.com",
          password: "hashedpassword456",
          role: "instructor" as const,
          status: "active" as const,
          userId: new Types.ObjectId(),
          organizationId,
          employmentType: "full_time" as const,
          expertise: ["Physics"],
          faculty: "Science",
          isVerified: true,
        },
      ] as unknown as IInstructor[];

      mockInstructorRepository.searchInstructor.mockResolvedValue(mockInstructors);

      const result = await instructorService.searchInstructor({
        query: { organizationId: organizationId.toString() },
      });

      expect(result).toBeDefined();
      if (result) {
        expect(result.length).toBe(2);
      }
      expect(mockInstructorRepository.searchInstructor).toHaveBeenCalled();
    });
  });
});
