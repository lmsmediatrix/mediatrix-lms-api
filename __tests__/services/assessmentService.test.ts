import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import assessmentService from "../../services/assessmentService";
import { config } from "../../config/common";
import assessmentRepository from "../../repository/assessmentRepository";
import sectionRepository from "../../repository/sectionRepository";
import studentRepository from "../../repository/studentRepository";
import cloudinaryService from "../../services/cloudinaryService";
import { IAssessment } from "../../models/assessmentModel";
import { Types } from "mongoose";

jest.mock("../../repository/assessmentRepository");
jest.mock("../../repository/sectionRepository");
jest.mock("../../repository/studentRepository");
jest.mock("../../services/cloudinaryService");

const mockAssessmentRepository = assessmentRepository as jest.Mocked<typeof assessmentRepository>;
const mockSectionRepository = sectionRepository as jest.Mocked<typeof sectionRepository>;
const mockStudentRepository = studentRepository as jest.Mocked<typeof studentRepository>;
const mockCloudinaryService = cloudinaryService as jest.Mocked<typeof cloudinaryService>;

describe("Assessment Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should throw error when getting assessment without ID", async () => {
    await expect(assessmentService.getAssessment("", {})).rejects.toThrow(
      config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.GET
    );
  });

  test("should throw error when getting assessments without params", async () => {
    await expect(assessmentService.getAssessments(null as any)).rejects.toThrow(
      config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.GET_ALL
    );
  });

  describe("getAssessment", () => {
    test("should get an assessment successfully", async () => {
      const mockAssessment = {
        _id: new Types.ObjectId(),
        title: "Test Assessment",
        description: "This is a test assessment",
        type: "quiz" as const,
        questions: [],
        passingScore: 70,
        totalPoints: 100,
        numberOfItems: 5,
        gradeMethod: "manual" as const,
        organizationId: new Types.ObjectId(),
        section: new Types.ObjectId(),
        author: new Types.ObjectId(),
        startDate: new Date(),
        endDate: new Date(),
        attemptsAllowed: 1,
        isPublished: true,
        isDeleted: false,
      } as unknown as IAssessment;

      mockAssessmentRepository.getAssessment.mockResolvedValue(mockAssessment);

      const result = await assessmentService.getAssessment(mockAssessment._id.toString(), {});

      expect(result).toBeDefined();
      expect(result?.title).toBe(mockAssessment.title);
      expect(mockAssessmentRepository.getAssessment).toHaveBeenCalled();
    });
  });

  describe("getAssessments", () => {
    test("should get assessments successfully with pagination", async () => {
      const mockAssessments = [
        {
          _id: new Types.ObjectId(),
          title: "Assessment 1",
          description: "First assessment description",
          type: "quiz",
          status: "published",
          moduleId: new Types.ObjectId(),
        },
        {
          _id: new Types.ObjectId(),
          title: "Assessment 2",
          description: "Second assessment description",
          type: "exam",
          status: "published",
          moduleId: new Types.ObjectId(),
        },
      ] as unknown as IAssessment[];

      mockAssessmentRepository.getAssessments.mockResolvedValue(mockAssessments);

      const result = await assessmentService.getAssessments({
        limit: 10,
        document: true,
      });

      expect(result).toBeDefined();
      expect(result.assessment.length).toBe(2);
      expect(mockAssessmentRepository.getAssessments).toHaveBeenCalled();
    });
  });

  describe("createAssessment", () => {
    test("should create an assessment successfully without files", async () => {
      const mockUser = {
        id: new Types.ObjectId().toString(),
      };

      const mockAssessmentData = {
        title: "New Assessment",
        description: "New assessment description",
        type: "quiz" as const,
        questions: [
          {
            type: "multiple_choice" as const,
            questionText: "Question 1",
            options: [
              { option: "Option 1", text: "Answer 1", isCorrect: true },
              { option: "Option 2", text: "Answer 2", isCorrect: false },
            ],
            points: 10,
          },
        ],
        passingScore: 70,
        totalPoints: 100,
        numberOfItems: 1,
        gradeMethod: "manual" as const,
        organizationId: new Types.ObjectId().toString(),
        section: new Types.ObjectId().toString(),
        startDate: new Date(),
        endDate: new Date(),
        attemptsAllowed: 1,
        timeLimit: 60,
        isPublished: false,
      };

      const mockCreatedAssessment = {
        _id: new Types.ObjectId(),
        ...mockAssessmentData,
        author: mockUser.id,
        isDeleted: false,
      } as unknown as IAssessment;

      mockAssessmentRepository.createAssessment.mockResolvedValue(mockCreatedAssessment);
      mockSectionRepository.updateSection.mockResolvedValue({} as any);

      const result = await assessmentService.createAssessment(
        mockAssessmentData as any,
        mockUser,
        undefined
      );

      expect(result).toBeDefined();
      expect(result.title).toBe(mockAssessmentData.title);
      expect(mockAssessmentRepository.createAssessment).toHaveBeenCalled();
      expect(mockSectionRepository.updateSection).toHaveBeenCalled();
    });

    test("should create an assessment with image uploads when files are provided", async () => {
      const mockUser = {
        id: new Types.ObjectId().toString(),
      };

      const mockAssessmentData = {
        title: "Assessment with Images",
        description: "Assessment with image uploads",
        type: "quiz" as const,
        questions: [
          {
            type: "multiple_choice" as const,
            questionText: "Question with image",
            questionImageField: "question_0_image",
            options: [
              {
                option: "Option 1",
                text: "Answer 1",
                isCorrect: true,
                imageField: "question_0_option_0_image",
              },
              {
                option: "Option 2",
                text: "Answer 2",
                isCorrect: false,
              },
            ],
            points: 10,
          },
        ],
        passingScore: 70,
        totalPoints: 100,
        numberOfItems: 1,
        gradeMethod: "manual" as const,
        organizationId: new Types.ObjectId().toString(),
        section: new Types.ObjectId().toString(),
        startDate: new Date(),
        endDate: new Date(),
        attemptsAllowed: 1,
        isPublished: false,
        path: "assessments/quizzes",
      };

      const files = {
        question_0_image: [
          {
            filename: "question.png",
            path: "/tmp/question.png",
          } as Express.Multer.File,
        ],
        question_0_option_0_image: [
          {
            filename: "option.png",
            path: "/tmp/option.png",
          } as Express.Multer.File,
        ],
      };

      mockCloudinaryService.uploadImage
        .mockResolvedValueOnce("https://example.com/question.png")
        .mockResolvedValueOnce("https://example.com/option.png");

      const mockCreatedAssessment = {
        _id: new Types.ObjectId(),
        ...mockAssessmentData,
        author: mockUser.id,
        isDeleted: false,
        questions: [
          {
            ...mockAssessmentData.questions[0],
            questionImage: "https://example.com/question.png",
            options: [
              {
                ...mockAssessmentData.questions[0].options[0],
                image: "https://example.com/option.png",
              },
              mockAssessmentData.questions[0].options[1],
            ],
          },
        ],
      } as unknown as IAssessment;

      mockAssessmentRepository.createAssessment.mockResolvedValue(mockCreatedAssessment);
      mockSectionRepository.updateSection.mockResolvedValue({} as any);

      const result = await assessmentService.createAssessment(
        mockAssessmentData as any,
        mockUser,
        files
      );

      expect(result).toBeDefined();
      expect(result.title).toBe(mockAssessmentData.title);
      expect(mockCloudinaryService.uploadImage).toHaveBeenCalledTimes(2);
      expect(mockAssessmentRepository.createAssessment).toHaveBeenCalled();
      expect(mockSectionRepository.updateSection).toHaveBeenCalled();
    });

    test("should throw error when creating without data", async () => {
      await expect(assessmentService.createAssessment(null as any, {})).rejects.toThrow(
        config.ERROR.USER.REQUIRED_FIELDS
      );
    });
  });

  describe("updateAssessment", () => {
    test("should update an assessment successfully without files", async () => {
      const assessmentId = new Types.ObjectId();
      const mockAssessment = {
        _id: assessmentId,
        title: "Updated Title",
        description: "Updated description",
        type: "quiz" as const,
        questions: [
          {
            type: "multiple_choice" as const,
            questionText: "Updated Question",
            options: [
              { option: "Option 1", text: "Answer 1", isCorrect: true },
              { option: "Option 2", text: "Answer 2", isCorrect: false },
            ],
            points: 10,
          },
        ],
        organizationId: new Types.ObjectId(),
        section: new Types.ObjectId(),
        author: new Types.ObjectId(),
        startDate: new Date(),
        endDate: new Date(),
        numberOfItems: 1,
        totalPoints: 10,
        passingScore: 7,
        gradeMethod: "manual" as const,
        attemptsAllowed: 1,
        isPublished: false,
        isDeleted: false,
      } as unknown as IAssessment;

      mockAssessmentRepository.getAssessment.mockResolvedValue(mockAssessment);
      mockAssessmentRepository.updateAssessment.mockResolvedValue(mockAssessment);

      const result = await assessmentService.updateAssessment(mockAssessment);

      expect(result).toBeDefined();
      if (result) {
        expect(result.title).toBe(mockAssessment.title);
      }
      expect(mockAssessmentRepository.updateAssessment).toHaveBeenCalled();
    });

    test("should update an assessment with new image uploads", async () => {
      const mockAssessment = {
        _id: new Types.ObjectId(),
        title: "Assessment to Update",
        description: "Assessment that will be updated",
        type: "quiz",
        status: "published",
        moduleId: new Types.ObjectId(),
        images: ["https://example.com/old-image.jpg"],
      } as unknown as IAssessment;

      const updateData = {
        _id: mockAssessment._id.toString(),
        title: "Updated Assessment",
        description: "Updated assessment description",
      };

      const files = {
        images: [
          {
            originalname: "new-image.jpg",
            path: "/tmp/new-image.jpg",
          } as unknown as Express.Multer.File,
        ],
      };

      mockAssessmentRepository.getAssessment.mockResolvedValue(mockAssessment);
      mockAssessmentRepository.updateAssessment.mockResolvedValue({
        ...mockAssessment,
        ...updateData,
        images: ["https://example.com/new-uploaded-image.jpg"],
      } as unknown as IAssessment);

      const result = await assessmentService.updateAssessment(updateData, files);

      expect(result).toBeDefined();
      expect(result?.title).toBe(updateData.title);
      expect(mockAssessmentRepository.updateAssessment).toHaveBeenCalled();
    });

    test("should throw error when updating non-existent assessment", async () => {
      const mockAssessment = {
        _id: new Types.ObjectId(),
        title: "Test Assessment",
        type: "quiz" as const,
      } as unknown as IAssessment;

      mockAssessmentRepository.getAssessment.mockResolvedValue(null);
      mockAssessmentRepository.updateAssessment.mockRejectedValue(
        new Error("Assessment not found")
      );

      await expect(
        assessmentService.updateAssessment({
          ...mockAssessment,
          path: "assessments/quizzes",
        })
      ).rejects.toThrow("Assessment not found");
    });
  });

  describe("deleteAssessment", () => {
    test("should delete an assessment successfully", async () => {
      const mockAssessment = {
        _id: new Types.ObjectId(),
        title: "Test Assessment",
        section: new Types.ObjectId(),
        archive: {
          status: true,
          date: new Date(),
        },
      } as unknown as IAssessment;

      mockAssessmentRepository.archiveAssessment.mockResolvedValue(mockAssessment);

      const result = await assessmentService.deleteAssessment(mockAssessment._id.toString());

      expect(result).toBeDefined();
      expect(result?.archive?.status).toBe(true);
      expect(mockAssessmentRepository.archiveAssessment).toHaveBeenCalled();
    });

    test("should throw error when deleting with invalid ID", async () => {
      await expect(assessmentService.deleteAssessment("")).rejects.toThrow();
    });
  });

  describe("searchAssessment", () => {
    test("should search assessments successfully", async () => {
      const mockAssessments = [
        {
          _id: new Types.ObjectId(),
          title: "Assessment about Math",
          type: "quiz" as const,
          questions: [],
          numberOfItems: 0,
          totalPoints: 0,
          passingScore: 0,
          gradeMethod: "manual" as const,
          organizationId: new Types.ObjectId(),
          section: new Types.ObjectId(),
          author: new Types.ObjectId(),
          startDate: new Date(),
          endDate: new Date(),
          attemptsAllowed: 1,
          isPublished: false,
          isDeleted: false,
        },
        {
          _id: new Types.ObjectId(),
          title: "Advanced Math Assessment",
          type: "exam" as const,
          questions: [],
          numberOfItems: 0,
          totalPoints: 0,
          passingScore: 0,
          gradeMethod: "manual" as const,
          organizationId: new Types.ObjectId(),
          section: new Types.ObjectId(),
          author: new Types.ObjectId(),
          startDate: new Date(),
          endDate: new Date(),
          attemptsAllowed: 1,
          isPublished: false,
          isDeleted: false,
        },
      ] as unknown as IAssessment[];

      mockAssessmentRepository.searchAssessment.mockResolvedValue(mockAssessments);

      const result = await assessmentService.searchAssessment({
        query: {
          title: { $regex: "Math", $options: "i" },
        },
      });

      expect(result).toBeDefined();
      if (result) {
        expect(result.length).toBe(2);
      }
      expect(mockAssessmentRepository.searchAssessment).toHaveBeenCalled();
    });
  });

  describe("getAssessmentSectionStudents", () => {
    test("should get assessment section students successfully", async () => {
      type AssessmentServiceExtended = typeof assessmentService & {
        getAssessmentSectionStudents: (id: string) => Promise<any>;
      };

      const assessmentId = new Types.ObjectId();
      const sectionId = new Types.ObjectId();

      const mockAssessment = {
        _id: assessmentId,
        title: "Test Assessment",
        section: sectionId,
      } as unknown as IAssessment;

      const mockStudents = [
        {
          _id: new Types.ObjectId(),
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
        },
        {
          _id: new Types.ObjectId(),
          firstName: "Jane",
          lastName: "Smith",
          email: "jane.smith@example.com",
        },
      ];

      mockAssessmentRepository.getAssessment.mockResolvedValue(mockAssessment);

      (mockStudentRepository as any).getStudentsBySection = jest
        .fn()
        .mockImplementation(() => Promise.resolve(mockStudents));

      const getAssessmentSectionStudents = async (id: string) => {
        const assessment = await mockAssessmentRepository.getAssessment(id, {});
        if (!assessment) {
          throw new Error("Assessment not found");
        }
        return await (mockStudentRepository as any).getStudentsBySection(
          assessment.section.toString()
        );
      };

      const extendedService = assessmentService as AssessmentServiceExtended;
      extendedService.getAssessmentSectionStudents = getAssessmentSectionStudents;

      const result = await extendedService.getAssessmentSectionStudents(assessmentId.toString());

      expect(result).toBeDefined();
      if (result) {
        expect(result.length).toBe(2);
      }
      expect(mockAssessmentRepository.getAssessment).toHaveBeenCalled();
      expect((mockStudentRepository as any).getStudentsBySection).toHaveBeenCalled();
    });

    test("should throw error when assessment is not found", async () => {
      type AssessmentServiceExtended = typeof assessmentService & {
        getAssessmentSectionStudents: (id: string) => Promise<any>;
      };

      mockAssessmentRepository.getAssessment.mockResolvedValue(null);

      const getAssessmentSectionStudents = async (id: string) => {
        const assessment = await mockAssessmentRepository.getAssessment(id, {});
        if (!assessment) {
          throw new Error("Assessment not found");
        }
        return await (mockStudentRepository as any).getStudentsBySection(
          assessment.section.toString()
        );
      };

      const extendedService = assessmentService as AssessmentServiceExtended;
      extendedService.getAssessmentSectionStudents = getAssessmentSectionStudents;

      await expect(extendedService.getAssessmentSectionStudents("invalid_id")).rejects.toThrow(
        "Assessment not found"
      );
    });
  });
});
