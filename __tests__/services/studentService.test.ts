import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { Types } from "mongoose";
import { config } from "../../config/common";
import studentService from "../../services/studentService";
import studentRepository from "../../repository/studentRepository";
import userRepository from "../../repository/userRepository";
import sectionRepository from "../../repository/sectionRepository";
import { IStudent } from "../../models/studentModel";
import gradeRepository from "../../repository/gradeRepository";
import organizationRepository from "../../repository/organizationRepository";
import { ISection } from "../../models/sectionModel";
import assessmentRepository from "../../repository/assessmentRepository";

jest.mock("../../repository/studentRepository");
jest.mock("../../repository/userRepository");
jest.mock("../../repository/sectionRepository");
jest.mock("../../repository/gradeRepository");
jest.mock("../../repository/organizationRepository");
jest.mock("../../repository/assessmentRepository");

const mockStudentRepository = {
  getStudent: jest.fn(),
  getStudents: jest.fn(),
  createStudent: jest.fn(),
  updateStudent: jest.fn(),
  deleteStudent: jest.fn(),
  searchStudent: jest.fn(),
  searchAndUpdate: jest.fn(),
  findOrCreate: jest.fn(),
  getStudentsCount: jest.fn(),
  studentDashboard: jest.fn(),
  studentCalendar: jest.fn(),
  bulkCreate: jest.fn(),
  getStudentGradeBySection: jest.fn(),
  archiveStudent: jest.fn(),
} as jest.Mocked<typeof studentRepository>;

const mockUserRepository = {
  getUser: jest.fn(),
  getUsers: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
  searchUser: jest.fn(),
  searchAndUpdate: jest.fn(),
  countUsers: jest.fn(),
  getUserMetrics: jest.fn(),
  bulkCreate: jest.fn(),
  archiveUser: jest.fn(),
} as jest.Mocked<typeof userRepository>;

const mockSectionRepository = {
  getSection: jest.fn(),
  getSections: jest.fn(),
  createSection: jest.fn(),
  updateSection: jest.fn(),
  deleteSection: jest.fn(),
  searchSection: jest.fn(),
  searchAndUpdate: jest.fn(),
  findOrCreate: jest.fn(),
  getStudentSection: jest.fn(),
  getInstructorSection: jest.fn(),
  getSectionCount: jest.fn(),
  getSectionAttendance: jest.fn(),
  bulkAddStudents: jest.fn(),
  archiveSection: jest.fn(),
  getSectionAssessment: jest.fn(),
  getSectionAnnouncement: jest.fn(),
} as unknown as jest.Mocked<typeof sectionRepository>;

const mockOrganizationRepository = {
  getOrganization: jest.fn(),
  getOrganizations: jest.fn(),
  createOrganization: jest.fn(),
  updateOrganization: jest.fn(),
  deleteOrganization: jest.fn(),
  searchOrganization: jest.fn(),
  searchAndUpdate: jest.fn(),
  findOrCreate: jest.fn(),
  getOrganizationCount: jest.fn(),
  getOrganizationDashboard: jest.fn(),
  getOrganizationsCount: jest.fn(),
} as unknown as jest.Mocked<typeof organizationRepository>;

const mockGradeRepository = {
  getGrade: jest.fn(),
  getGradings: jest.fn(),
} as unknown as jest.Mocked<typeof gradeRepository>;

const mockAssessmentRepository = {
  getAssessments: jest.fn(),
} as unknown as jest.Mocked<typeof assessmentRepository>;

(studentRepository as jest.Mocked<typeof studentRepository>) = mockStudentRepository;
(userRepository as jest.Mocked<typeof userRepository>) = mockUserRepository;
(sectionRepository as jest.Mocked<typeof sectionRepository>) = mockSectionRepository;
(organizationRepository as jest.Mocked<typeof organizationRepository>) = mockOrganizationRepository;
(gradeRepository as jest.Mocked<typeof gradeRepository>) = mockGradeRepository;
(assessmentRepository as jest.Mocked<typeof assessmentRepository>) = mockAssessmentRepository;

describe("Student Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should throw error when getting student without ID", async () => {
    await expect(studentService.getStudent("", {})).rejects.toThrow(
      config.RESPONSE.ERROR.STUDENT.ID
    );
  });

  test("should throw error when getting students without params", async () => {
    await expect(studentService.getStudents(null as any)).rejects.toThrow(
      config.RESPONSE.ERROR.STUDENT.INVALID_PARAMETER.GET_ALL
    );
  });

  describe("getStudent", () => {
    test("should get a student successfully", async () => {
      const organizationId = new Types.ObjectId();
      const mockStudent = {
        _id: new Types.ObjectId(),
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        password: "hashedpassword123",
        role: "student" as const,
        status: "active" as const,
        organizationId,
      } as unknown as IStudent;

      mockStudentRepository.getStudent.mockResolvedValue(mockStudent);

      const result = await studentService.getStudent(mockStudent._id.toString(), {
        query: { organizationId: organizationId.toString() },
      });

      expect(result).toBeDefined();
      expect(mockStudentRepository.getStudent).toHaveBeenCalled();
    });

    test("should return null when organizationId is not provided", async () => {
      const result = await studentService.getStudent("123", {});
      expect(result).toBeNull();
    });
  });

  describe("getStudents", () => {
    test("should get students successfully with pagination", async () => {
      const organizationId = new Types.ObjectId();
      const mockStudents = [
        {
          _id: new Types.ObjectId(),
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          password: "hashedpassword123",
          role: "student" as const,
          status: "active" as const,
          organizationId,
        },
      ] as unknown as IStudent[];

      mockStudentRepository.getStudents.mockResolvedValue(mockStudents);
      mockStudentRepository.getStudentsCount.mockResolvedValue(1);

      const result = await studentService.getStudents({
        limit: 10,
        page: 1,
        query: { organizationId: organizationId.toString() },
        document: true,
        pagination: true,
      });

      expect(result).toBeDefined();
      expect(result.students).toEqual(mockStudents);
      expect(result.pagination).toBeDefined();
      expect(mockStudentRepository.getStudents).toHaveBeenCalled();
      expect(mockStudentRepository.getStudentsCount).toHaveBeenCalled();
    });

    test("should return empty result when organizationId is not provided", async () => {
      const result = await studentService.getStudents({});
      expect(result.students).toEqual([]);
      expect(result.pagination).toEqual({});
    });
  });

  describe("createStudent", () => {
    test("should create a student successfully", async () => {
      const organizationId = new Types.ObjectId();
      const mockStudentData = {
        _id: new Types.ObjectId(),
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        password: "password123",
        role: "student" as const,
        status: "active" as const,
        organizationId,
      } as unknown as IStudent;

      mockUserRepository.getUser.mockResolvedValue(mockStudentData);
      mockStudentRepository.searchAndUpdate.mockResolvedValue(null);
      mockStudentRepository.createStudent.mockResolvedValue(mockStudentData);
      mockOrganizationRepository.updateOrganization.mockResolvedValue({} as any);

      const result = await studentService.createStudent(mockStudentData);

      expect(result).toBeDefined();
      expect(mockStudentRepository.searchAndUpdate).toHaveBeenCalledWith({
        email: mockStudentData.email,
      });
      expect(mockStudentRepository.createStudent).toHaveBeenCalled();
      expect(mockOrganizationRepository.updateOrganization).toHaveBeenCalledWith({
        _id: organizationId,
        $push: { students: mockStudentData._id },
      });
    });

    test("should throw error when user does not exist", async () => {
      const organizationId = new Types.ObjectId();
      const mockStudentData = {
        _id: new Types.ObjectId(),
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        password: "password123",
        role: "student" as const,
        status: "active" as const,
        organizationId,
      } as unknown as IStudent;

      mockUserRepository.getUser.mockResolvedValue(null);
      mockStudentRepository.searchAndUpdate.mockResolvedValue(null);
      mockStudentRepository.createStudent.mockRejectedValue(new Error(config.ERROR.USER.NOT_FOUND));

      await expect(studentService.createStudent(mockStudentData)).rejects.toThrow(
        config.ERROR.USER.NOT_FOUND
      );

      expect(mockStudentRepository.searchAndUpdate).toHaveBeenCalledWith({
        email: mockStudentData.email,
      });
    });
  });

  describe("updateStudent", () => {
    test("should update a student successfully", async () => {
      const organizationId = new Types.ObjectId();
      const mockStudent = {
        _id: new Types.ObjectId(),
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        password: "hashedpassword123",
        role: "student" as const,
        status: "active" as const,
        organizationId,
      } as unknown as IStudent;

      mockStudentRepository.updateStudent.mockResolvedValue(mockStudent);

      const result = await studentService.updateStudent(mockStudent);

      expect(result).toBeDefined();
      expect(mockStudentRepository.updateStudent).toHaveBeenCalled();
    });

    test("should throw error when updating without data", async () => {
      await expect(studentService.updateStudent(null as any)).rejects.toThrow(
        config.RESPONSE.ERROR.STUDENT.INVALID_PARAMETER.UPDATE
      );
    });
  });

  describe("deleteStudent", () => {
    test("should delete a student successfully", async () => {
      const mockStudent = {
        _id: new Types.ObjectId(),
        archive: {
          status: true,
          date: new Date(),
        },
      } as unknown as IStudent;

      mockStudentRepository.archiveStudent.mockResolvedValue(mockStudent);

      const result = await studentService.deleteStudent(mockStudent._id.toString());

      expect(result).toBeDefined();
      expect(result?.archive?.status).toBe(true);
      expect(mockStudentRepository.archiveStudent).toHaveBeenCalled();
    });

    test("should throw error when deleting without ID", async () => {
      await expect(studentService.deleteStudent("")).rejects.toThrow(
        config.RESPONSE.ERROR.STUDENT.INVALID_PARAMETER.REMOVE
      );
    });
  });

  describe("searchStudent", () => {
    test("should search students successfully", async () => {
      const organizationId = new Types.ObjectId();
      const mockStudents = [
        {
          _id: new Types.ObjectId(),
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          password: "hashedpassword123",
          role: "student" as const,
          status: "active" as const,
          organizationId,
        },
      ] as unknown as IStudent[];

      mockStudentRepository.searchStudent.mockResolvedValue(mockStudents);

      const result = await studentService.searchStudent({
        query: { organizationId: organizationId.toString() },
      });

      expect(result).toBeDefined();
      expect(mockStudentRepository.searchStudent).toHaveBeenCalled();
    });

    test("should return empty array when organizationId is not provided", async () => {
      mockStudentRepository.searchStudent.mockResolvedValue([]);

      const result = await studentService.searchStudent({});
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
      expect(mockStudentRepository.searchStudent).toHaveBeenCalled();
    });
  });

  describe("studentDashboard", () => {
    test("should get student dashboard data successfully", async () => {
      const organizationId = new Types.ObjectId();
      const mockStudent = {
        _id: new Types.ObjectId(),
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        password: "hashedpassword123",
        role: "student" as const,
        status: "active" as const,
        organizationId,
      } as unknown as IStudent;

      mockStudentRepository.studentDashboard.mockResolvedValue(mockStudent);

      const result = await studentService.studentDashboard(mockStudent._id.toString(), {
        query: { organizationId: organizationId.toString() },
      });

      expect(result).toBeDefined();
      expect(mockStudentRepository.studentDashboard).toHaveBeenCalled();
    });

    test("should return null when organizationId is not provided", async () => {
      const result = await studentService.studentDashboard("123", {});
      expect(result).toBeNull();
    });
  });

  describe("studentCalendar", () => {
    test("should get student calendar data successfully", async () => {
      const organizationId = new Types.ObjectId();
      const mockStudent = {
        _id: new Types.ObjectId(),
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        password: "hashedpassword123",
        role: "student" as const,
        status: "active" as const,
        organizationId,
      } as unknown as IStudent;

      mockStudentRepository.studentCalendar.mockResolvedValue(mockStudent);

      const result = await studentService.studentCalendar(mockStudent._id.toString(), {
        query: { organizationId: organizationId.toString() },
      });

      expect(result).toBeDefined();
      expect(mockStudentRepository.studentCalendar).toHaveBeenCalled();
    });

    test("should return null when organizationId is not provided", async () => {
      const result = await studentService.studentCalendar("123", {});
      expect(result).toBeNull();
    });
  });

  describe("getStudentGradeBySection", () => {
    test("should get student grades by section successfully", async () => {
      const organizationId = new Types.ObjectId();
      const studentId = new Types.ObjectId();
      const sectionId = new Types.ObjectId();
      const mockSection = {
        _id: sectionId,
        code: "SEC101",
        status: "ongoing" as const,
        instructor: new Types.ObjectId(),
        organizationId: organizationId,
        isDeleted: false,
        course: new Types.ObjectId(),
        name: "Test Section",
        students: [],
        modules: [],
        grade: new Types.ObjectId(),
        announcements: [],
        assessments: [],
        schedule: {
          startDate: new Date(),
          endDate: new Date(),
          daySchedules: [
            {
              day: "mon",
              time: { start: "09:00", end: "10:00" },
            },
          ],
        },
        totalStudent: 0,
        attendance: [],
      } as unknown as ISection;
      const mockGrade = {
        _id: new Types.ObjectId(),
        sectionId: sectionId,
        organizationId: organizationId,
        gradingMethod: "points_based" as const,
        totalCoursePoints: 100,
        minPassingGrade: 60,
        isDeleted: false,
        lateSubmissionPenalty: 0,
        gradeDistribution: [],
        gradingScale: [
          { gradeLabel: "1.00", percentageRange: { startRange: 96, endRange: 100 } },
          { gradeLabel: "1.25", percentageRange: { startRange: 94, endRange: 95 } },
          { gradeLabel: "1.50", percentageRange: { startRange: 92, endRange: 93 } },
          { gradeLabel: "1.75", percentageRange: { startRange: 89, endRange: 91 } },
          { gradeLabel: "2.00", percentageRange: { startRange: 87, endRange: 88 } },
          { gradeLabel: "2.25", percentageRange: { startRange: 85, endRange: 86 } },
          { gradeLabel: "2.50", percentageRange: { startRange: 83, endRange: 84 } },
          { gradeLabel: "2.75", percentageRange: { startRange: 80, endRange: 82 } },
          { gradeLabel: "3.00", percentageRange: { startRange: 75, endRange: 79 } },
          { gradeLabel: "5.00", percentageRange: { startRange: 0, endRange: 74 } },
        ],
      };

      const mockStudent = {
        _id: studentId,
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        password: "hashedpassword123",
        role: "student" as const,
        status: "active" as const,
        organizationId,
        studentId: "STU001",
        avatar: "",
        studentAssessmentResults: [],
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as IStudent;

      const mockAssessments = [
        {
          _id: new Types.ObjectId(),
          title: "Test Assessment",
          type: "quiz" as const,
          totalPoints: 100,
          assessmentNo: 1,
          numberOfItems: 10,
          startDate: new Date(),
          endDate: new Date(),
          organizationId,
          isDeleted: false,
          section: sectionId,
          attemptsAllowed: 1,
          isShuffled: false,
          isPublished: true,
          passingScore: 60,
          questions: [],
          archive: { status: false, date: null },
        },
      ];

      mockSectionRepository.searchSection.mockResolvedValueOnce([mockSection]);
      mockGradeRepository.getGradings.mockResolvedValueOnce([mockGrade]);
      mockSectionRepository.getSection.mockResolvedValueOnce({
        _id: sectionId,
        code: "SEC101",
        status: "ongoing",
        instructor: new Types.ObjectId(),
        organizationId,
        isDeleted: false,
        course: new Types.ObjectId(),
        name: "Test Section",
        students: [mockStudent],
        modules: [],
        grade: new Types.ObjectId(),
        announcements: [],
        assessments: mockAssessments.map((assessment) => assessment._id),
        schedule: {
          startDate: new Date(),
          endDate: new Date(),
          daySchedules: [
            {
              day: "mon",
              time: { start: "09:00", end: "10:00" },
            },
          ],
        },
        totalStudent: 1,
        attendance: [],
      } as unknown as ISection);
      mockAssessmentRepository.getAssessments.mockResolvedValueOnce(
        mockAssessments.map((assessment) => ({
          ...assessment,
          author: new Types.ObjectId("507f1f77bcf86cd799439011"),
          gradeMethod: "auto",
          numberOfQuestionsToShow: 10,
          archive: { status: false, date: null },
        }))
      );

      const result = await studentService.getStudentGradeBySection(mockSection.code, {
        query: { organizationId: organizationId.toString(), sectionId: sectionId.toString() },
      });

      expect(result).toBeDefined();
      expect(mockSectionRepository.searchSection).toHaveBeenCalled();
      expect(mockGradeRepository.getGradings).toHaveBeenCalled();
      expect(mockSectionRepository.getSection).toHaveBeenCalled();
      expect(mockAssessmentRepository.getAssessments).toHaveBeenCalled();
    }, 10000);
  });
});
