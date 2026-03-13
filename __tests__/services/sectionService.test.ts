jest.mock("../../repository/sectionRepository");
jest.mock("../../repository/courseRepository", () => ({
  getCourse: jest.fn().mockImplementation(() =>
    Promise.resolve({
      _id: "test-course-id",
      title: "Test Course",
    })
  ),
  updateCourse: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock("../../repository/instructorRepository", () => ({
  getInstructor: jest.fn().mockImplementation(() =>
    Promise.resolve({
      _id: "test-instructor-id",
      firstName: "John",
      lastName: "Doe",
    })
  ),
  updateInstructor: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock("../../repository/studentRepository", () => ({
  getStudent: jest.fn().mockImplementation(() =>
    Promise.resolve({
      _id: "test-student-id",
      firstName: "Jane",
      lastName: "Smith",
    })
  ),
  updateStudent: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import sectionService from "../../services/sectionService";
import { config } from "../../config/common";
import sectionRepository from "../../repository/sectionRepository";
import { ISection } from "../../models/sectionModel";
import { Types } from "mongoose";

const mockSectionRepository = sectionRepository as jest.Mocked<typeof sectionRepository>;

describe("Section Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should throw error when getting section without ID", async () => {
    await expect(sectionService.getSection("", {})).rejects.toThrow(config.ERROR.USER.NO_ID);
  });

  test("should throw error when getting sections without params", async () => {
    await expect(sectionService.getSections(null as any)).rejects.toThrow(
      config.RESPONSE.ERROR.SECTION.INVALID_PARAMETER.GET_ALL
    );
  });

  describe("getSection", () => {
    test("should get a section successfully", async () => {
      const mockSection = {
        _id: new Types.ObjectId(),
        code: "SEC101",
        name: "Test Section",
        course: new Types.ObjectId(),
        instructor: new Types.ObjectId(),
        students: [new Types.ObjectId()],
        status: "upcoming" as const,
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        capacity: 30,
        organizationId: new Types.ObjectId(),
        modules: [],
        grade: {
          passingGrade: 60,
          maxGrade: 100,
        },
        schedule: {
          days: ["Monday", "Wednesday"],
          time: {
            start: "09:00",
            end: "10:30",
          },
        },
        attendance: [],
        announcements: [],
        assessments: [],
        totalStudent: 1,
        isDeleted: false,
      } as unknown as ISection;

      mockSectionRepository.getSection.mockImplementation(async () => mockSection);

      const result = await sectionService.getSection(mockSection._id.toString(), {
        query: { organizationId: mockSection.organizationId },
      });

      expect(result).toBeDefined();
      expect(result?.name).toBe(mockSection.name);
      expect(mockSectionRepository.getSection).toHaveBeenCalled();
    });

    test("should return null when organizationId is not provided", async () => {
      const result = await sectionService.getSection("123", {});

      expect(result).toBeNull();
      expect(mockSectionRepository.getSection).not.toHaveBeenCalled();
    });
  });

  describe("getSections", () => {
    test("should get sections successfully with pagination", async () => {
      const mockSections = [
        {
          _id: new Types.ObjectId(),
          code: "SEC101",
          name: "Test Section 1",
          course: new Types.ObjectId(),
          instructor: new Types.ObjectId(),
          students: [new Types.ObjectId()],
          status: "upcoming" as const,
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
          capacity: 30,
          organizationId: new Types.ObjectId(),
          modules: [],
          grade: {
            passingGrade: 60,
            maxGrade: 100,
          },
          schedule: {
            days: ["Monday", "Wednesday"],
            time: {
              start: "09:00",
              end: "10:30",
            },
          },
          attendance: [],
          announcements: [],
          assessments: [],
          totalStudent: 1,
          isDeleted: false,
        },
        {
          _id: new Types.ObjectId(),
          code: "SEC102",
          name: "Test Section 2",
          course: new Types.ObjectId(),
          instructor: new Types.ObjectId(),
          students: [new Types.ObjectId()],
          status: "upcoming" as const,
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
          capacity: 30,
          organizationId: new Types.ObjectId(),
          modules: [],
          grade: {
            passingGrade: 60,
            maxGrade: 100,
          },
          schedule: {
            days: ["Tuesday", "Thursday"],
            time: {
              start: "09:00",
              end: "10:30",
            },
          },
          attendance: [],
          announcements: [],
          assessments: [],
          totalStudent: 1,
          isDeleted: false,
        },
      ] as unknown as ISection[];

      mockSectionRepository.getSections.mockImplementation(async () => mockSections);
      mockSectionRepository.getSectionCount.mockImplementation(async () => 2);

      const result = await sectionService.getSections({
        limit: 10,
        page: 1,
        query: { organizationId: new Types.ObjectId() },
      });

      expect(result).toBeDefined();
      expect(result.sections.length).toBe(2);
      expect(result.pagination.totalItems).toBe(2);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.currentPage).toBe(1);
      expect(result.pagination.pageSize).toBe(10);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(false);
      expect(mockSectionRepository.getSections).toHaveBeenCalled();
      expect(mockSectionRepository.getSectionCount).toHaveBeenCalled();
    });

    test("should return empty result when organizationId is not provided", async () => {
      const result = await sectionService.getSections({ limit: 10 });

      expect(result).toBeDefined();
      expect(result.sections.length).toBe(0);
      expect(mockSectionRepository.getSections).not.toHaveBeenCalled();
    });
  });

  describe("createSection", () => {
    test("should create a section successfully", async () => {
      const courseId = new Types.ObjectId();
      const instructorId = new Types.ObjectId();
      const organizationId = new Types.ObjectId();

      const mockUser = {
        organizationId,
      };

      const mockSectionData = {
        code: "SEC103",
        name: "New Section",
        course: courseId,
        instructor: instructorId,
        organizationId,
        schedule: {
          startDate: new Date(),
          endDate: new Date(),
          days: ["Tuesday", "Thursday"],
          time: {
            start: "11:00 AM",
            end: "12:30 PM",
          },
        },
        status: "upcoming",
      };

      const mockCreatedSection = {
        _id: new Types.ObjectId(),
        ...mockSectionData,
        students: [],
        modules: [],
        isDeleted: false,
      } as unknown as ISection;

      mockSectionRepository.createSection.mockImplementation(async () => mockCreatedSection);

      const result = await sectionService.createSection(mockSectionData as any, mockUser);

      expect(result).toBeDefined();
      expect(result.code).toBe(mockSectionData.code);
      expect(mockSectionRepository.createSection).toHaveBeenCalled();
    });

    test("should throw error when creating without data", async () => {
      await expect(sectionService.createSection(null as any)).rejects.toThrow(
        config.ERROR.USER.REQUIRED_FIELDS
      );
    });
  });

  describe("updateSection", () => {
    test("should update a section successfully", async () => {
      const mockSection = {
        _id: new Types.ObjectId(),
        code: "SEC101",
        name: "Updated Section Name",
        status: "upcoming",
      } as unknown as ISection;

      mockSectionRepository.updateSection.mockImplementation(async () => mockSection);

      const result = await sectionService.updateSection(mockSection);

      expect(result).toBeDefined();
      expect(result?.name).toBe(mockSection.name);
      expect(mockSectionRepository.updateSection).toHaveBeenCalled();
    });

    test("should throw error when updating without data", async () => {
      await expect(sectionService.updateSection(null as any)).rejects.toThrow(
        config.RESPONSE.ERROR.SECTION.INVALID_PARAMETER.UPDATE
      );
    });
  });

  describe("deleteSection", () => {
    test("should delete a section successfully", async () => {
      const mockSection = {
        _id: new Types.ObjectId(),
        code: "SEC101",
        course: new Types.ObjectId(),
        instructor: new Types.ObjectId(),
        students: [new Types.ObjectId(), new Types.ObjectId()],
        isDeleted: true,
        archive: {
          status: true,
          date: new Date(),
        },
      } as unknown as ISection;

      mockSectionRepository.getSection.mockImplementation(async () => mockSection);
      mockSectionRepository.archiveSection.mockImplementation(async () => mockSection);

      const result = await sectionService.deleteSection(mockSection._id.toString());

      expect(result).toBeDefined();
      expect(mockSectionRepository.archiveSection).toHaveBeenCalled();
    });

    test("should throw error when deleting without ID", async () => {
      await expect(sectionService.deleteSection("")).rejects.toThrow(
        config.RESPONSE.ERROR.SECTION.INVALID_PARAMETER.REMOVE
      );
    });
  });

  describe("searchSection", () => {
    test("should search sections successfully", async () => {
      const mockSections = [
        {
          _id: new Types.ObjectId(),
          code: "SEC101",
          name: "Introduction Section",
        },
        {
          _id: new Types.ObjectId(),
          code: "SEC102",
          name: "Advanced Section",
        },
      ] as unknown as ISection[];

      mockSectionRepository.searchSection.mockImplementation(async () => mockSections);

      const result = await sectionService.searchSection({
        query: { name: { $regex: "Section", $options: "i" } },
      });

      expect(result).toBeDefined();
      expect(result.sections).toBeDefined();
      expect(Array.isArray(result.sections)).toBe(true);
      expect(result.sections.length).toBe(2);
      expect(mockSectionRepository.searchSection).toHaveBeenCalled();
    });
  });

  describe("getSectionAttendance", () => {
    test("should get section attendance successfully", async () => {
      const sectionCode = "SEC101";
      const mockUser = {
        id: new Types.ObjectId().toString(),
        role: "instructor",
        organizationId: new Types.ObjectId(),
      };

      const mockSection = {
        _id: new Types.ObjectId(),
        code: sectionCode,
        name: "Test Section",
        course: new Types.ObjectId(),
        instructor: mockUser.id,
        students: [new Types.ObjectId()],
        status: "upcoming" as const,
        startDate: new Date(),
        endDate: new Date(),
        capacity: 30,
        organizationId: mockUser.organizationId,
        modules: [],
        grade: {
          passingGrade: 60,
          maxGrade: 100,
        },
        schedule: {
          days: ["Monday", "Wednesday"],
          time: {
            start: "09:00",
            end: "10:30",
          },
        },
        attendance: [],
        announcements: [],
        assessments: [],
        totalStudent: 1,
        isDeleted: false,
      } as unknown as ISection;

      const mockAttendanceData = {
        data: [
          {
            date: new Date(),
            students: [
              {
                userId: new Types.ObjectId(),
                status: "present",
              },
            ],
          },
        ],
        totalEnrolled: 1,
      };

      mockSectionRepository.getSections.mockResolvedValue([mockSection]);
      mockSectionRepository.getSectionAttendance.mockImplementation(async () => mockAttendanceData);

      const result = await sectionService.getSectionAttendance(
        sectionCode,
        undefined,
        undefined,
        mockUser
      );

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.totalEnrolled).toBe(1);
      expect(mockSectionRepository.getSectionAttendance).toHaveBeenCalledWith(
        sectionCode,
        expect.any(Date),
        mockUser.organizationId,
        undefined,
        undefined
      );
    });
  });
});
