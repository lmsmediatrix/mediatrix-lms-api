import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import gradeService from "../../services/gradeService";
import { config } from "../../config/common";
import gradeRepository from "../../repository/gradeRepository";
import sectionRepository from "../../repository/sectionRepository";
import { IGrade } from "../../models/gradeModel";
import { Types } from "mongoose";

jest.mock("../../repository/gradeRepository");
jest.mock("../../repository/sectionRepository");

const mockGradeRepository = gradeRepository as jest.Mocked<typeof gradeRepository>;
const mockSectionRepository = sectionRepository as jest.Mocked<typeof sectionRepository>;

describe("Grade Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should throw error when getting grade without ID", async () => {
    await expect(gradeService.getGrade("", {})).rejects.toThrow(
      config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.GET
    );
  });

  test("should throw error when getting grades without params", async () => {
    await expect(gradeService.getGrades(null as any)).rejects.toThrow(
      config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.GET_ALL
    );
  });

  describe("getGrade", () => {
    test("should get a grade successfully", async () => {
      const mockGrade = {
        _id: new Types.ObjectId(),
        organizationId: new Types.ObjectId(),
        sectionId: new Types.ObjectId(),
        gradingMethod: "points_based",
        totalCoursePoints: 100,
        minPassingGrade: 60,
        lateSubmissionPenalty: 10,
        gradeDistribution: [
          { category: "Quizzes", weight: 30 },
          { category: "Assignments", weight: 20 },
          { category: "Exams", weight: 50 },
        ],
        gradingScale: [
          {
            gradeLabel: "A",
            percentageRange: {
              startRange: 90,
              endRange: 100,
            },
          },
          {
            gradeLabel: "B",
            percentageRange: {
              startRange: 80,
              endRange: 89,
            },
          },
        ],
      } as unknown as IGrade;

      mockGradeRepository.getGrading.mockResolvedValue(mockGrade);

      const result = await gradeService.getGrade(mockGrade._id.toString(), {});

      expect(result).toBeDefined();
      expect(result?.gradingMethod).toBe(mockGrade.gradingMethod);
      expect(mockGradeRepository.getGrading).toHaveBeenCalled();
    });
  });

  describe("getGrades", () => {
    test("should get grades successfully", async () => {
      const mockGrades = [
        {
          _id: new Types.ObjectId(),
          student: new Types.ObjectId(),
          assessment: new Types.ObjectId(),
          score: 85,
          feedback: "Good work!",
        },
        {
          _id: new Types.ObjectId(),
          student: new Types.ObjectId(),
          assessment: new Types.ObjectId(),
          score: 92,
          feedback: "Excellent work!",
        },
      ] as unknown as IGrade[];

      mockGradeRepository.getGradings.mockResolvedValue(mockGrades);

      const result = await gradeService.getGrades({
        document: true,
        pagination: false,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result.grades)).toBe(true);
    });
  });

  describe("createGrade", () => {
    test("should create a grade successfully", async () => {
      const mockUser = {
        id: new Types.ObjectId().toString(),
        organizationId: new Types.ObjectId(),
      };

      const mockGradeData = {
        sectionId: new Types.ObjectId(),
        gradingMethod: "points_based" as "points_based" | "percentage_based" | "letter_grade",
        totalCoursePoints: 100,
        minPassingGrade: 60,
        lateSubmissionPenalty: 5,
        gradeDistribution: [
          { category: "Quizzes", weight: 30 },
          { category: "Assignments", weight: 20 },
          { category: "Exams", weight: 50 },
        ],
      };

      const mockCreatedGrade = {
        _id: new Types.ObjectId(),
        ...mockGradeData,
        organizationId: mockUser.organizationId,
      } as unknown as IGrade;

      mockGradeRepository.createGrading.mockResolvedValue(mockCreatedGrade);
      mockSectionRepository.updateSection.mockResolvedValue({} as any);

      const result = await gradeService.createGrade(mockGradeData, mockUser);

      expect(result).toBeDefined();
      expect(result.gradingMethod).toBe(mockGradeData.gradingMethod);
      expect(result.organizationId).toBe(mockUser.organizationId);
      expect(mockGradeRepository.createGrading).toHaveBeenCalled();
      expect(mockSectionRepository.updateSection).toHaveBeenCalled();
    });

    test("should throw error when creating without data", async () => {
      await expect(gradeService.createGrade(null as any)).rejects.toThrow(
        config.ERROR.USER.REQUIRED_FIELDS
      );
    });
  });

  describe("updateGrade", () => {
    test("should update a grade successfully", async () => {
      const mockGrade = {
        _id: new Types.ObjectId(),
        organizationId: new Types.ObjectId(),
        sectionId: new Types.ObjectId(),
        gradingMethod: "letter_grade" as "points_based" | "percentage_based" | "letter_grade",
        totalCoursePoints: 200,
        minPassingGrade: 65,
      } as unknown as IGrade;

      mockGradeRepository.updateGrading.mockResolvedValue(mockGrade);

      const result = await gradeService.updateGrade(mockGrade);

      expect(result).toBeDefined();
      expect(result?.gradingMethod).toBe(mockGrade.gradingMethod);
      expect(mockGradeRepository.updateGrading).toHaveBeenCalled();
    });

    test("should throw error when updating without data", async () => {
      await expect(gradeService.updateGrade(null as any)).rejects.toThrow(
        config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.UPDATE
      );
    });
  });

  describe("deleteGrade", () => {
    test("should delete a grade successfully", async () => {
      const mockGrade = {
        _id: new Types.ObjectId(),
        organizationId: new Types.ObjectId(),
        sectionId: new Types.ObjectId(),
        isDeleted: true,
        archive: {
          status: true,
          date: new Date(),
        },
      } as unknown as IGrade;
      mockGradeRepository.archiveGrade.mockResolvedValue(mockGrade);

      const result = await gradeService.deleteGrade(mockGrade._id.toString());

      expect(result).toBeDefined();
      expect(result?.archive?.status).toBe(true);
      expect(mockGradeRepository.archiveGrade).toHaveBeenCalled();
    });

    test("should throw error when deleting without ID", async () => {
      await expect(gradeService.deleteGrade("")).rejects.toThrow(
        config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.REMOVE
      );
    });
  });

  describe("searchGrade", () => {
    test("should search grades successfully", async () => {
      const mockGrades = [
        {
          _id: new Types.ObjectId(),
          organizationId: new Types.ObjectId(),
          sectionId: new Types.ObjectId(),
          gradingMethod: "points_based",
          totalCoursePoints: 100,
        },
        {
          _id: new Types.ObjectId(),
          organizationId: new Types.ObjectId(),
          sectionId: new Types.ObjectId(),
          gradingMethod: "percentage_based",
          totalCoursePoints: 1000,
        },
      ] as unknown as IGrade[];

      mockGradeRepository.searchGrading.mockResolvedValue(mockGrades);

      const result = await gradeService.searchGrade({
        query: {
          gradingMethod: "points_based",
        },
      });

      expect(result).toBeDefined();
      expect(result?.length).toBe(2);
      expect(mockGradeRepository.searchGrading).toHaveBeenCalled();
    });
  });
});
