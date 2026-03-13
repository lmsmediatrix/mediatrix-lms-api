import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import lessonService from "../../services/lessonService";
import { config } from "../../config/common";
import lessonRepository from "../../repository/lessonRepository";
import moduleRepository from "../../repository/moduleRepository";
import moduleService from "../../services/moduleService";
import cloudinaryService from "../../services/cloudinaryService";
import { ILesson } from "../../models/lessonModel";
import { Types } from "mongoose";
import sectionRepository from "../../repository/sectionRepository";
import { ISection } from "../../models/sectionModel";

jest.mock("../../repository/lessonRepository");
jest.mock("../../repository/moduleRepository");
jest.mock("../../services/moduleService");
jest.mock("../../services/cloudinaryService");
jest.mock("../../repository/sectionRepository");

const mockLessonRepository = lessonRepository as jest.Mocked<typeof lessonRepository>;
const mockModuleRepository = moduleRepository as jest.Mocked<typeof moduleRepository>;
const mockModuleService = moduleService as jest.Mocked<typeof moduleService>;
const mockCloudinaryService = cloudinaryService as jest.Mocked<typeof cloudinaryService>;
const mockSectionRepository = sectionRepository as jest.Mocked<typeof sectionRepository>;

describe("Lesson Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should throw error when getting lesson without ID", async () => {
    await expect(lessonService.getLesson("", {})).rejects.toThrow(
      config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.GET
    );
  });

  test("should throw error when getting lessons without params", async () => {
    await expect(lessonService.getLessons(null as any)).rejects.toThrow(
      config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.GET_ALL
    );
  });

  describe("getLesson", () => {
    test("should get a lesson successfully", async () => {
      const mockLesson = {
        _id: new Types.ObjectId(),
        title: "Test Lesson",
        category: "Programming",
        description: "This is a test lesson with detailed description",
        information: "Additional information about the lesson",
        videoUrl: "https://example.com/video.mp4",
        status: "published" as const,
        liveDiscussion: false,
        duration: 60,
        tags: ["javascript", "programming"],
        author: new Types.ObjectId(),
        isDeleted: false,
        mainContent: "https://example.com/content.pdf",
        files: ["https://example.com/file1.pdf", "https://example.com/file2.pdf"],
        progress: [
          {
            userId: new Types.ObjectId(),
            currentPage: 1,
            totalPages: 10,
            timeSpent: 120,
            status: "in-progress" as const,
          },
        ],
      } as unknown as ILesson;

      mockLessonRepository.getLesson.mockResolvedValue(mockLesson);

      const result = await lessonService.getLesson(mockLesson._id.toString(), {});

      expect(result).toBeDefined();
      expect(result?.title).toBe(mockLesson.title);
      expect(result?.status).toBe(mockLesson.status);
      expect(mockLessonRepository.getLesson).toHaveBeenCalled();
    });
  });

  describe("getLessons", () => {
    test("should get lessons successfully", async () => {
      const mockLessons = [
        {
          _id: new Types.ObjectId(),
          title: "Lesson 1",
          description: "Description for lesson 1",
          moduleId: new Types.ObjectId(),
          content: "This is the content of lesson 1",
          category: "lecture",
          duration: 60,
        },
        {
          _id: new Types.ObjectId(),
          title: "Lesson 2",
          description: "Description for lesson 2",
          moduleId: new Types.ObjectId(),
          content: "This is the content of lesson 2",
          category: "assignment",
          duration: 30,
        },
      ] as unknown as ILesson[];

      mockLessonRepository.getLessons.mockResolvedValue(mockLessons);

      const result = await lessonService.getLessons({
        document: true,
        pagination: false,
        limit: 10,
        page: 1,
      });

      expect(result).toBeDefined();
      expect(result.lessons.length).toBe(2);
      expect(result.lessons[0].title).toBe(mockLessons[0].title);
      expect(mockLessonRepository.getLessons).toHaveBeenCalled();
    });
  });

  describe("createLesson", () => {
    test("should create a lesson successfully", async () => {
      const mockModuleId = new Types.ObjectId().toString();
      const mockUser = {
        id: new Types.ObjectId().toString(),
      };

      const mockModule = {
        _id: mockModuleId,
        title: "Test Module",
      };

      const mockLessonData = {
        title: "New Lesson",
        category: "Programming",
        description: "New lesson description with detailed information",
        moduleId: mockModuleId,
        status: "published" as const,
        duration: 60,
        tags: ["javascript", "basics"],
        liveDiscussion: false,
      };

      const mockCreatedLesson = {
        _id: new Types.ObjectId(),
        ...mockLessonData,
        author: mockUser.id,
        isDeleted: false,
        files: [],
      } as unknown as ILesson;

      mockModuleService.getModule.mockResolvedValue(mockModule as any);
      mockLessonRepository.createLesson.mockResolvedValue(mockCreatedLesson);
      mockModuleRepository.updateModule.mockResolvedValue({} as any);

      const result = await lessonService.createLesson(mockLessonData, undefined, mockUser);

      expect(result).toBeDefined();
      expect(result.newLesson.title).toBe(mockLessonData.title);
      expect(result.newLesson.status).toBe(mockLessonData.status);
      expect(mockLessonRepository.createLesson).toHaveBeenCalled();
      expect(mockModuleRepository.updateModule).toHaveBeenCalledWith(
        { _id: mockModuleId },
        { $push: { lessons: mockCreatedLesson._id } }
      );
    });

    test("should create a lesson with files", async () => {
      const mockModuleId = new Types.ObjectId().toString();
      const mockUser = {
        id: new Types.ObjectId().toString(),
      };

      const mockModule = {
        _id: mockModuleId,
        title: "Test Module",
      };

      const mockSection = {
        _id: new Types.ObjectId(),
        name: "Test Section",
        code: "TEST123",
        instructor: new Types.ObjectId(),
        students: [new Types.ObjectId()],
        status: "ongoing" as const,
        isDeleted: false,
        course: new Types.ObjectId(),
        organizationId: new Types.ObjectId(),
        modules: [new Types.ObjectId()],
        totalStudent: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        archive: { status: false, date: null },
        gradeSystem: { type: "percentage", passingGrade: 60 },
        attendance: [],
        grade: new Types.ObjectId(),
        announcements: [],
        assessments: [],
        schedule: {
          startDate: new Date(),
          endDate: new Date(),
          daySchedules: [
            {
              time: { start: "09:00", end: "10:00" },
              day: "mon" as const,
            },
          ],
        },
      } as unknown as ISection;

      const mockLessonData = {
        title: "New Lesson With Files",
        category: "Programming",
        description: "New lesson with files and detailed content",
        moduleId: mockModuleId,
        status: "published" as const,
        duration: 90,
        tags: ["javascript", "advanced"],
        liveDiscussion: true,
        path: "org/course/module",
      };

      const files = {
        files: [
          {
            filename: "document.pdf",
            path: "/tmp/document.pdf",
            originalname: "document.pdf",
          } as Express.Multer.File,
        ],
        mainContent: [
          {
            filename: "main.pdf",
            path: "/tmp/main.pdf",
            originalname: "main.pdf",
          } as Express.Multer.File,
        ],
      };

      mockCloudinaryService.multipleUploadFile.mockResolvedValue(["https://example.com/file1.pdf"]);
      mockCloudinaryService.uploadPdf.mockResolvedValue("https://example.com/main.pdf");

      const mockCreatedLesson = {
        _id: new Types.ObjectId(),
        ...mockLessonData,
        files: ["https://example.com/file1.pdf"],
        mainContent: "https://example.com/main.pdf",
        author: mockUser.id,
        isDeleted: false,
      } as unknown as ILesson;

      mockModuleService.getModule.mockResolvedValue(mockModule as any);
      mockLessonRepository.createLesson.mockResolvedValue(mockCreatedLesson);
      mockModuleRepository.updateModule.mockResolvedValue({} as any);
      mockSectionRepository.searchSection.mockResolvedValue([mockSection]);

      const result = await lessonService.createLesson(mockLessonData, files, mockUser);

      expect(result).toBeDefined();
      expect(result.newLesson.title).toBe(mockLessonData.title);
      expect(result.newLesson.mainContent).toBe("https://example.com/main.pdf");
      expect(result.newLesson.files).toContain("https://example.com/file1.pdf");
      expect(mockCloudinaryService.multipleUploadFile).toHaveBeenCalled();
      expect(mockCloudinaryService.uploadPdf).toHaveBeenCalled();
      expect(mockLessonRepository.createLesson).toHaveBeenCalled();
      expect(mockModuleRepository.updateModule).toHaveBeenCalled();
      expect(mockSectionRepository.searchSection).toHaveBeenCalled();
    }, 15000);

    test("should throw error when creating without data", async () => {
      await expect(lessonService.createLesson(null as any)).rejects.toThrow(
        config.ERROR.USER.REQUIRED_FIELDS
      );
    });

    test("should throw error when moduleId is missing", async () => {
      const mockLessonData = {
        title: "New Lesson",
        category: "Programming",
        description: "Lesson description",
      };

      await expect(lessonService.createLesson(mockLessonData)).rejects.toThrow(
        "moduleId is required"
      );
    });

    test("should throw error when module is not found", async () => {
      const mockModuleId = new Types.ObjectId().toString();
      const mockLessonData = {
        title: "New Lesson",
        category: "Programming",
        description: "Lesson description",
        moduleId: mockModuleId,
      };

      mockModuleService.getModule.mockResolvedValue(null);

      await expect(lessonService.createLesson(mockLessonData)).rejects.toThrow("Module not found");
    });
  });

  describe("updateLesson", () => {
    test("should update a lesson successfully", async () => {
      const mockModuleId = new Types.ObjectId().toString();

      const mockLessonBeforeUpdate = {
        _id: new Types.ObjectId(),
        title: "Original Title",
        category: "Original Category",
        description: "Original description",
        status: "unpublished" as const,
        files: ["https://example.com/oldfile.pdf"],
        mainContent: "https://example.com/oldcontent.pdf",
      } as unknown as ILesson;

      const mockModule = {
        _id: mockModuleId,
        title: "Test Module",
      };

      const mockLessonUpdate = {
        _id: mockLessonBeforeUpdate._id,
        title: "Updated Title",
        category: "Updated Category",
        description: "Updated description with more details",
        status: "published" as const,
        moduleId: mockModuleId,
      } as unknown as ILesson;

      mockLessonRepository.getLesson.mockResolvedValue(mockLessonBeforeUpdate);
      mockModuleService.getModule.mockResolvedValue(mockModule as any);
      mockLessonRepository.updateLesson.mockResolvedValue({
        ...mockLessonBeforeUpdate,
        ...mockLessonUpdate,
      } as ILesson);

      const result = await lessonService.updateLesson(mockLessonUpdate);

      expect(result).toBeDefined();
      expect(result?.title).toBe(mockLessonUpdate.title);
      expect(result?.status).toBe(mockLessonUpdate.status);
      expect(mockLessonRepository.updateLesson).toHaveBeenCalled();
    });

    test("should throw error when updating without data", async () => {
      await expect(lessonService.updateLesson(null as any)).rejects.toThrow(
        config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.UPDATE
      );
    });
  });

  describe("deleteLesson", () => {
    test("should delete a lesson successfully", async () => {
      const mockLesson = {
        _id: new Types.ObjectId(),
        title: "To be deleted",
        category: "Test Category",
        description: "Lesson to be deleted",
        status: "published" as const,
        archive: {
          status: true,
          date: new Date(),
        },
      } as unknown as ILesson;

      mockLessonRepository.archiveLesson.mockResolvedValue(mockLesson);

      const result = await lessonService.deleteLesson(mockLesson._id.toString());

      expect(result).toBeDefined();
      expect(result?.archive?.status).toBe(true);
      expect(mockLessonRepository.archiveLesson).toHaveBeenCalled();
    });

    test("should throw error when deleting without ID", async () => {
      await expect(lessonService.deleteLesson("")).rejects.toThrow(
        config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.REMOVE
      );
    });
  });

  describe("searchLesson", () => {
    test("should search lessons successfully", async () => {
      const mockLessons = [
        {
          _id: new Types.ObjectId(),
          title: "Lesson about JavaScript",
          category: "Programming",
          description: "JavaScript basics lesson",
          status: "published" as const,
          duration: 60,
          tags: ["javascript", "web development"],
          author: new Types.ObjectId(),
          isDeleted: false,
        },
        {
          _id: new Types.ObjectId(),
          title: "Advanced JavaScript Lesson",
          category: "Programming",
          description: "Advanced JavaScript concepts",
          status: "published" as const,
          duration: 90,
          tags: ["javascript", "advanced"],
          author: new Types.ObjectId(),
          isDeleted: false,
        },
      ] as unknown as ILesson[];

      mockLessonRepository.searchLesson.mockResolvedValue(mockLessons);

      const result = await lessonService.searchLesson({
        query: {
          title: { $regex: "JavaScript", $options: "i" },
        },
      });

      expect(result).toBeDefined();
      expect(result?.length).toBe(2);
      expect(result?.[0].title).toContain("JavaScript");
      expect(result?.[1].title).toContain("JavaScript");
      expect(mockLessonRepository.searchLesson).toHaveBeenCalled();
    });
  });
});
