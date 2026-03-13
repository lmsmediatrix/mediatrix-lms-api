import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import announcementService from "../../services/announcementService";
import { config } from "../../config/common";
import announcementRepository from "../../repository/announcementRepository";
import sectionRepository from "../../repository/sectionRepository";
import { IAnnouncement } from "../../models/announcementModel";
import { ISection } from "../../models/sectionModel";
import { Types } from "mongoose";

jest.mock("../../repository/announcementRepository");
jest.mock("../../repository/sectionRepository");

const mockAnnouncementRepository = {
  ...announcementRepository,
  getAnnouncementsCount: jest.fn().mockImplementation(() => Promise.resolve(0)),
} as jest.Mocked<typeof announcementRepository> & {
  getAnnouncementsCount: jest.Mock;
};

const mockSectionRepository = sectionRepository as jest.Mocked<typeof sectionRepository>;

describe("Announcement Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should throw error when getting announcement without ID", async () => {
    await expect(announcementService.getAnnouncement("", {})).rejects.toThrow(
      config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.GET
    );
  });

  test("should throw error when getting announcements without params", async () => {
    await expect(announcementService.getAnnouncements(null as any)).rejects.toThrow(
      config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.GET_ALL
    );
  });

  describe("getAnnouncement", () => {
    test("should get an announcement successfully", async () => {
      const mockAnnouncement = {
        _id: new Types.ObjectId(),
        title: "Test Announcement",
        textBody: "This is a test announcement",
        scope: "section" as const,
        scopeId: new Types.ObjectId(),
        author: new Types.ObjectId(),
        publishDate: new Date(),
        isPublished: true,
        isDeleted: false,
      } as unknown as IAnnouncement;

      mockAnnouncementRepository.getAnnouncement.mockResolvedValue(mockAnnouncement);

      const result = await announcementService.getAnnouncement(mockAnnouncement._id.toString(), {});

      expect(result).toBeDefined();
      expect(result?.title).toBe(mockAnnouncement.title);
      expect(mockAnnouncementRepository.getAnnouncement).toHaveBeenCalled();
    });
  });

  describe("getAnnouncements", () => {
    test("should get announcements successfully", async () => {
      const mockAnnouncements = [
        {
          _id: new Types.ObjectId(),
          title: "Announcement 1",
          textBody: "Content 1",
          scope: "section" as const,
          scopeId: new Types.ObjectId(),
          author: new Types.ObjectId(),
          publishDate: new Date(),
          isPublished: true,
          isDeleted: false,
        },
        {
          _id: new Types.ObjectId(),
          title: "Announcement 2",
          textBody: "Content 2",
          scope: "section" as const,
          scopeId: new Types.ObjectId(),
          author: new Types.ObjectId(),
          publishDate: new Date(),
          isPublished: true,
          isDeleted: false,
        },
      ] as unknown as IAnnouncement[];

      mockAnnouncementRepository.getAnnouncements.mockResolvedValue(mockAnnouncements);

      const result = await announcementService.getAnnouncements({
        limit: 10,
        page: 1,
        document: true,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result.announcements)).toBe(true);
      expect(result.announcements.length).toBe(2);
      expect(mockAnnouncementRepository.getAnnouncements).toHaveBeenCalled();
    });

    test("should handle pagination if implemented", async () => {
      const mockAnnouncements = [
        {
          _id: new Types.ObjectId(),
          title: "Announcement 1",
          textBody: "Content 1",
          scope: "section" as const,
          scopeId: new Types.ObjectId(),
          author: new Types.ObjectId(),
          publishDate: new Date(),
          isPublished: true,
          isDeleted: false,
        },
        {
          _id: new Types.ObjectId(),
          title: "Announcement 2",
          textBody: "Content 2",
          scope: "section" as const,
          scopeId: new Types.ObjectId(),
          author: new Types.ObjectId(),
          publishDate: new Date(),
          isPublished: true,
          isDeleted: false,
        },
      ] as unknown as IAnnouncement[];

      mockAnnouncementRepository.getAnnouncements.mockResolvedValue(mockAnnouncements);
      mockAnnouncementRepository.getAnnouncementsCount.mockImplementation(() => Promise.resolve(2));

      const result = await announcementService.getAnnouncements({
        limit: 10,
        page: 1,
        document: true,
        pagination: true,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result.announcements)).toBe(true);
      expect(result.announcements.length).toBe(2);
      expect(mockAnnouncementRepository.getAnnouncements).toHaveBeenCalled();
    });
  });

  describe("createAnnouncement", () => {
    test("should create an announcement successfully", async () => {
      const mockUser = {
        id: new Types.ObjectId().toString(),
      };

      const mockSection = {
        _id: new Types.ObjectId(),
        announcements: [],
        code: "SECTION1",
        status: "upcoming" as const,
        isDeleted: false,
        course: new Types.ObjectId(),
        name: "Test Section",
        organizationId: new Types.ObjectId(),
        modules: [],
        capacity: 30,
        instructor: new Types.ObjectId(),
        students: [],
        totalStudent: 0,
      } as unknown as ISection;

      const mockAnnouncementData = {
        title: "New Announcement",
        textBody: "New content",
        scope: "section" as const,
        scopeId: mockSection._id,
        publishDate: new Date(),
        isPublished: true,
      };

      const mockCreatedAnnouncement = {
        _id: new Types.ObjectId(),
        ...mockAnnouncementData,
        author: mockUser.id,
        isDeleted: false,
      } as unknown as IAnnouncement;

      mockSectionRepository.getSections.mockResolvedValue([mockSection]);
      mockAnnouncementRepository.createAnnouncement.mockResolvedValue(mockCreatedAnnouncement);
      mockSectionRepository.updateSection.mockResolvedValue({
        ...mockSection,
        announcements: [mockCreatedAnnouncement._id],
      } as any);

      const result = await announcementService.createAnnouncement(
        mockAnnouncementData as Partial<IAnnouncement>,
        mockUser
      );

      expect(result).toBeDefined();
      expect(result.title).toBe(mockAnnouncementData.title);
      expect(result.author).toBe(mockUser.id);
      expect(mockAnnouncementRepository.createAnnouncement).toHaveBeenCalled();
      expect(mockSectionRepository.updateSection).toHaveBeenCalled();
    });

    test("should throw error when creating without data", async () => {
      await expect(announcementService.createAnnouncement(null as any, {})).rejects.toThrow(
        config.ERROR.USER.REQUIRED_FIELDS
      );
    });
  });

  describe("updateAnnouncement", () => {
    test("should update an announcement successfully", async () => {
      const mockAnnouncement = {
        _id: new Types.ObjectId(),
        title: "Updated Title",
        textBody: "Updated content",
        scope: "section" as const,
        scopeId: new Types.ObjectId(),
        author: new Types.ObjectId(),
        publishDate: new Date(),
        isPublished: true,
        isDeleted: false,
      } as unknown as IAnnouncement;

      mockAnnouncementRepository.updateAnnouncement.mockResolvedValue(mockAnnouncement);

      const result = await announcementService.updateAnnouncement(mockAnnouncement);

      expect(result).toBeDefined();
      expect(result?.title).toBe(mockAnnouncement.title);
      expect(mockAnnouncementRepository.updateAnnouncement).toHaveBeenCalled();
    });

    test("should throw error when updating without data", async () => {
      await expect(announcementService.updateAnnouncement(null as any)).rejects.toThrow(
        config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.UPDATE
      );
    });
  });

  describe("deleteAnnouncement", () => {
    test("should delete an announcement successfully", async () => {
      const mockAnnouncement = {
        _id: new Types.ObjectId(),
        title: "To be deleted",
        textBody: "Content to delete",
        scope: "section" as const,
        scopeId: new Types.ObjectId(),
        author: new Types.ObjectId(),
        publishDate: new Date(),
        isPublished: true,
        isDeleted: true,
        archive: {
          status: true,
          date: new Date(),
        },
      } as unknown as IAnnouncement;

      mockAnnouncementRepository.archiveAnnouncement.mockResolvedValue(mockAnnouncement);

      const result = await announcementService.deleteAnnouncement(mockAnnouncement._id.toString());

      expect(result).toBeDefined();
      expect(result?.archive?.status).toBe(true);
      expect(mockAnnouncementRepository.archiveAnnouncement).toHaveBeenCalled();
    });

    test("should throw error when deleting without ID", async () => {
      await expect(announcementService.deleteAnnouncement("")).rejects.toThrow(
        config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.REMOVE
      );
    });
  });

  describe("searchAnnouncement", () => {
    test("should search announcements successfully", async () => {
      const mockAnnouncements = [
        {
          _id: new Types.ObjectId(),
          title: "Important Announcement",
          textBody: "Please read this important information",
          scope: "section" as const,
          scopeId: new Types.ObjectId(),
          author: new Types.ObjectId(),
          publishDate: new Date(),
          isPublished: true,
          isDeleted: false,
        },
        {
          _id: new Types.ObjectId(),
          title: "Another Important Announcement",
          textBody: "More important information",
          scope: "section" as const,
          scopeId: new Types.ObjectId(),
          author: new Types.ObjectId(),
          publishDate: new Date(),
          isPublished: true,
          isDeleted: false,
        },
      ] as unknown as IAnnouncement[];

      mockAnnouncementRepository.searchAnnouncement.mockResolvedValue(mockAnnouncements);

      const result = await announcementService.searchAnnouncement({
        query: { title: { $regex: "Important", $options: "i" } },
      });

      expect(result).toBeDefined();
      if (result) {
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(2);
      }
      expect(mockAnnouncementRepository.searchAnnouncement).toHaveBeenCalled();
    });
  });
});
