import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { config } from "../../config/common";
import courseService from "../../services/courseService";
import courseRepository from "../../repository/courseRepository";
import { ICourse } from "../../models/courseModel";
import { Types } from "mongoose";

jest.mock("../../repository/courseRepository");
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

const mockCourseRepository = courseRepository as jest.Mocked<typeof courseRepository>;

describe("Course Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should throw error when getting course without ID", async () => {
    await expect(courseService.getCourse("", {})).rejects.toThrow(config.ERROR.USER.NO_ID);
  });

  test("should throw error when getting courses without params", async () => {
    await expect(courseService.getCourses(null as any)).rejects.toThrow(
      config.RESPONSE.ERROR.USER.INVALID_PARAMETER.GET_ALL
    );
  });

  describe("getCourse", () => {
    test("should get a course successfully", async () => {
      const mockCourse = {
        _id: new Types.ObjectId(),
        title: "Test Course",
        description: "This is a test course description with at least 10 characters",
        code: "COURSE101",
        category: "Programming",
        level: "beginner" as const,
        language: "English",
        timezone: "UTC",
        status: "draft" as const,
        organizationId: new Types.ObjectId(),
      } as unknown as ICourse;

      mockCourseRepository.getCourse.mockResolvedValue(mockCourse);

      const result = await courseService.getCourse(mockCourse._id.toString(), {
        query: { organizationId: mockCourse.organizationId },
      });

      expect(result).toBeDefined();
      expect(result?.title).toBe(mockCourse.title);
      expect(mockCourseRepository.getCourse).toHaveBeenCalled();
    });
  });

  describe("getCourses", () => {
    test("should get courses successfully with pagination", async () => {
      const mockCourses = [
        {
          _id: new Types.ObjectId(),
          title: "Course 1",
          description: "Description for course 1 with at least 10 characters",
          code: "CS101",
          category: "Computer Science",
          level: "beginner" as const,
          language: "English",
          timezone: "UTC",
          status: "published" as const,
          organizationId: new Types.ObjectId(),
        },
        {
          _id: new Types.ObjectId(),
          title: "Course 2",
          description: "Description for course 2 with at least 10 characters",
          code: "CS102",
          category: "Computer Science",
          level: "intermediate" as const,
          language: "English",
          timezone: "UTC",
          status: "published" as const,
          organizationId: new Types.ObjectId(),
        },
      ] as unknown as ICourse[];

      mockCourseRepository.getCourses.mockResolvedValue(mockCourses);
      mockCourseRepository.getCoursesCount.mockImplementation(() => Promise.resolve(2));

      const result = await courseService.getCourses({
        limit: 10,
        page: 1,
        document: true,
        pagination: true,
        query: { organizationId: mockCourses[0].organizationId },
      });

      expect(result).toBeDefined();
      expect(result.courses.length).toBe(2);
      expect(result.pagination.totalItems).toBe(2);
      expect(mockCourseRepository.getCourses).toHaveBeenCalled();
      expect(mockCourseRepository.getCoursesCount).toHaveBeenCalled();
    });
  });

  describe("createCourse", () => {
    test("should create a course successfully", async () => {
      const mockUser = {
        organizationId: new Types.ObjectId(),
      };

      const mockCourseData = {
        title: "New Course",
        description: "New course description with at least 10 characters",
        code: "NEWCOURSE",
        category: new Types.ObjectId(),
        level: "beginner" as const,
        language: "English",
        timezone: "UTC",
        status: "draft" as const,
        thumbnail: "https://example.com/image.jpg",
      };

      const mockCreatedCourse = {
        _id: new Types.ObjectId(),
        ...mockCourseData,
        organizationId: mockUser.organizationId,
      } as unknown as ICourse;

      mockCourseRepository.createCourse.mockResolvedValue(mockCreatedCourse);

      const result = await courseService.createCourse(mockCourseData, undefined, mockUser);

      expect(result).toBeDefined();
      expect(result.title).toBe(mockCourseData.title);
      expect(mockCourseRepository.createCourse).toHaveBeenCalled();
    }, 10000);

    test("should throw error when creating without data", async () => {
      await expect(courseService.createCourse(null as any)).rejects.toThrow(
        "Cannot read properties of null (reading 'thumbnail')"
      );
    });
  });

  describe("updateCourse", () => {
    test("should update a course successfully", async () => {
      const mockCourse = {
        _id: new Types.ObjectId(),
        title: "Updated Title",
        description: "Updated description with at least 10 characters",
        code: "UPDCOURSE",
        category: "Updated Category",
        level: "intermediate" as const,
        language: "English",
        timezone: "UTC",
        status: "published" as const,
        organizationId: new Types.ObjectId(),
      } as unknown as ICourse;

      mockCourseRepository.getCourse.mockResolvedValue(mockCourse);
      mockCourseRepository.updateCourse.mockResolvedValue(mockCourse);

      const result = await courseService.updateCourse(mockCourse);

      expect(result).toBeDefined();
      expect(result?.title).toBe(mockCourse.title);
      expect(mockCourseRepository.updateCourse).toHaveBeenCalled();
    });

    test("should throw error when updating without data", async () => {
      await expect(courseService.updateCourse(null as any)).rejects.toThrow(
        config.RESPONSE.ERROR.COURSE.INVALID_PARAMETER.UPDATE
      );
    });
  });

  describe("deleteCourse", () => {
    test("should delete a course successfully", async () => {
      const mockCourse = {
        _id: new Types.ObjectId(),
        title: "To be deleted",
        description: "Course to be deleted with at least 10 characters",
        code: "DELCOURSE",
        category: "Temporary",
        level: "beginner" as const,
        language: "English",
        timezone: "UTC",
        status: "archived" as const,
        organizationId: new Types.ObjectId(),
      } as unknown as ICourse;

      mockCourseRepository.archiveCourse.mockResolvedValue(mockCourse);

      const result = await courseService.deleteCourse(mockCourse._id.toString());

      expect(result).toBeDefined();
      expect(mockCourseRepository.archiveCourse).toHaveBeenCalled();
    });

    test("should throw error when deleting without ID", async () => {
      await expect(courseService.deleteCourse("")).rejects.toThrow(
        config.RESPONSE.ERROR.COURSE.INVALID_PARAMETER.REMOVE
      );
    });
  });

  describe("searchCourse", () => {
    test("should search courses successfully", async () => {
      const mockCourses = [
        {
          _id: new Types.ObjectId(),
          title: "Programming Course",
          description: "Introduction to programming with at least 10 characters",
          code: "CS101",
          category: "Computer Science",
          level: "beginner" as const,
          language: "English",
          timezone: "UTC",
          status: "published" as const,
          organizationId: new Types.ObjectId(),
        },
        {
          _id: new Types.ObjectId(),
          title: "Advanced Programming",
          description: "Advanced programming concepts with at least 10 characters",
          code: "CS201",
          category: "Computer Science",
          level: "advance" as const,
          language: "English",
          timezone: "UTC",
          status: "published" as const,
          organizationId: new Types.ObjectId(),
        },
      ] as unknown as ICourse[];

      mockCourseRepository.searchCourse.mockResolvedValue(mockCourses);

      const result = await courseService.searchCourse({
        query: { title: { $regex: "Programming", $options: "i" } },
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      if (result) {
        expect(result.length).toBe(2);
      }
      expect(mockCourseRepository.searchCourse).toHaveBeenCalled();
    });

    test("should handle pagination in search if implemented in the future", async () => {
      const mockCourses = [
        {
          _id: new Types.ObjectId(),
          title: "Programming Course",
          description: "Introduction to programming with at least 10 characters",
          code: "CS101",
          category: "Computer Science",
          level: "beginner" as const,
          language: "English",
          timezone: "UTC",
          status: "published" as const,
          organizationId: new Types.ObjectId(),
        },
      ] as unknown as ICourse[];

      mockCourseRepository.searchCourse.mockResolvedValue(mockCourses);

      const result = await courseService.searchCourse({
        query: { title: { $regex: "Programming", $options: "i" } },
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      if (result) {
        expect(result.length).toBe(1);
      }
      expect(mockCourseRepository.searchCourse).toHaveBeenCalled();
    });
  });
});
