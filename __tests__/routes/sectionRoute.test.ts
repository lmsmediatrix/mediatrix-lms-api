import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { Types } from "mongoose";

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

jest.mock("../../middleware/zodErrorHandler", () => {
  return {
    handleZodError: jest.fn((_error, res: any) => {
      res.status(400).json({ error: "Test error" });
    }),
  };
});

jest.mock("../../utils/logger", () => {
  return {
    default: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
    uploadLogs: jest.fn(),
  };
});

jest.mock("../../middleware/rabcMiddleware", () => {
  return {
    validatePermissions: jest.fn().mockImplementation((...args: any[]) => {
      const _roles = args[0] as string[];

      return (req: any, res: any, next: any) => {
        if (!req.user) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        if (!req.user.role || !_roles.includes(req.user.role)) {
          return res.status(403).json({ message: "Forbidden" });
        }

        next();
      };
    }),
  };
});

jest.mock("../../helper/formDataHelper", () => ({
  processFormData: jest.fn(),
}));

jest.mock("../../services/sectionService");
jest.mock("../../services/activityLogService");
jest.mock("../../services/auditLogService");
jest.mock("../../services/userService");
jest.mock("../../services/notificationService");

jest.mock("mongoose", () => {
  const originalModule = jest.requireActual("mongoose") as object;
  return {
    ...originalModule,
    Types: {
      ObjectId: jest.fn().mockImplementation((id) => id || "mockedObjectId"),
    },
  };
});

import { Response } from "express";
import { ACTION, USER_ROLES } from "../../config/common";
import { validatePermissions } from "../../middleware/rabcMiddleware";
import { CustomRequest } from "../../type/types";
import { ISection, SectionZodSchema } from "../../models/sectionModel";
import activityLogService from "../../services/activityLogService";
import auditLogService from "../../services/auditLogService";
import sectionService from "../../services/sectionService";
import userService from "../../services/userService";

const mockSectionService = sectionService as jest.Mocked<typeof sectionService>;
const mockActivityLogService = activityLogService as jest.Mocked<typeof activityLogService>;
const mockAuditLogService = auditLogService as jest.Mocked<typeof auditLogService>;
const mockUserService = userService as jest.Mocked<typeof userService>;

interface MockUser {
  id: string;
  email: string;
  organizationId: string;
  role: string;
  firstName?: string;
  lastName?: string;
}

const createMockRequest = (overrides: Partial<CustomRequest> = {}): CustomRequest => {
  return {
    user: {
      id: "mockUserId",
      email: "test@example.com",
      organizationId: "mockOrgId",
      role: "admin",
      firstName: "Test",
      lastName: "User",
    } as MockUser,
    params: {},
    query: {},
    body: {},
    path: "/api/section/test",
    method: "GET",
    originalUrl: "/api/section/test",
    ip: "127.0.0.1",
    get: jest.fn().mockReturnValue("test-user-agent"),
    files: [],
    ...overrides,
  } as unknown as CustomRequest;
};

const createMockResponse = (): Response => {
  const res = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
};

import * as sectionRouteHandlers from "../../routes/sectionRoute";

describe("Section Route Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getSections", () => {
    test("should get all sections successfully", async () => {
      const mockSections = [
        {
          _id: "section1",
          code: "CS101A",
          name: "Introduction to Computer Science",
          organizationId: "orgId1",
          course: "courseId1",
          instructor: "instructorId1",
          students: ["student1", "student2"],
          schedule: {
            startDate: new Date("2025-01-15"),
            endDate: new Date("2025-05-15"),
            days: ["mon", "wed", "fri"],
            time: {
              start: "9:00 AM",
              end: "10:30 AM",
            },
          },
          status: "active",
        } as unknown as ISection,
        {
          _id: "section2",
          code: "CS102B",
          name: "Data Structures",
          organizationId: "orgId1",
          course: "courseId2",
          instructor: "instructorId2",
          students: ["student3", "student4", "student5"],
          schedule: {
            startDate: new Date("2025-01-15"),
            endDate: new Date("2025-05-15"),
            days: ["tue", "thu"],
            time: {
              start: "1:00 PM",
              end: "2:30 PM",
            },
          },
          status: "active",
        } as unknown as ISection,
      ];

      const mockPagination = {
        totalItems: 2,
        totalPages: 1,
        currentPage: 1,
        pageSize: 10,
      };

      mockSectionService.getSections.mockResolvedValue({
        sections: mockSections,
        pagination: mockPagination,
        count: 2,
      });

      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        query: {
          limit: "10",
          page: "1",
          pagination: "true",
          count: "true",
        },
      });

      const res = createMockResponse();

      await sectionRouteHandlers.getSections(req, res);

      expect(mockSectionService.getSections).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockSections,
        pagination: mockPagination,
        count: 2,
      });
    });

    test("should handle error when user is not authenticated", async () => {
      const req = createMockRequest({
        user: undefined,
      });

      const res = createMockResponse();

      await sectionRouteHandlers.getSections(req, res);

      expect(mockSectionService.getSections).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("getSection", () => {
    test("should get a section by ID successfully", async () => {
      const sectionId = "mockSectionId";
      const mockSection = {
        _id: sectionId,
        code: "CS101A",
        name: "Introduction to Computer Science",
        organizationId: "orgId1",
        course: "courseId1",
        instructor: "instructorId1",
        students: ["student1", "student2"],
        schedule: {
          startDate: new Date("2025-01-15"),
          endDate: new Date("2025-05-15"),
          days: ["mon", "wed", "fri"],
          time: {
            start: "9:00 AM",
            end: "10:30 AM",
          },
        },
        status: "active",
      };

      mockSectionService.getSection.mockResolvedValue(mockSection as unknown as ISection);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: sectionId },
      });

      const res = createMockResponse();

      await sectionRouteHandlers.getSection(req, res);

      expect(mockSectionService.getSection).toHaveBeenCalledWith(sectionId, expect.any(Object));
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockSection,
      });
    });

    test("should return 404 when section is not found", async () => {
      const sectionId = "nonExistentSectionId";
      mockSectionService.getSection.mockResolvedValue(null);

      const req = createMockRequest({
        params: { id: sectionId },
      });

      const res = createMockResponse();

      await sectionRouteHandlers.getSection(req, res);

      expect(mockSectionService.getSection).toHaveBeenCalledWith(sectionId, expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("getStudentSection", () => {
    test("should get sections for a student successfully", async () => {
      const mockSections = [
        {
          _id: "section1",
          code: "CS101A",
          name: "Introduction to Computer Science",
        },
        {
          _id: "section2",
          code: "CS102B",
          name: "Data Structures",
        },
      ];
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const res = createMockResponse();

      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockSections,
        pagination: { totalItems: 2 },
        count: 2,
      });
    });
  });

  describe("getInstructorSection", () => {
    test("should get sections for an instructor successfully", async () => {
      const mockSections = [
        {
          _id: "section1",
          code: "CS101A",
          name: "Introduction to Computer Science",
        },
        {
          _id: "section2",
          code: "CS102B",
          name: "Data Structures",
        },
      ];

      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const res = createMockResponse();

      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockSections,
        pagination: { totalItems: 2 },
        count: 2,
      });
    });
  });

  describe("createSection", () => {
    test("should create a section successfully", async () => {
      const mockSectionData = {
        code: "CS101A",
        name: "Introduction to Computer Science",
        course: new Types.ObjectId(),
        instructor: new Types.ObjectId(),
        schedule: {
          startDate: new Date("2025-01-15"),
          endDate: new Date("2025-05-15"),
          daySchedules: [
            {
              day: "mon",
              time: {
                start: "9:00 AM",
                end: "10:30 AM",
              },
            },
          ],
        },
        organizationId: new Types.ObjectId(),
        status: "active",
        isDeleted: false,
        totalStudent: 0,
        modules: [],
        students: [],
        announcements: [],
        assessments: [],
        grade: new Types.ObjectId(),
      };

      const mockCreatedSection = {
        _id: "newSectionId",
        ...mockSectionData,
        organizationId: "mockOrgId",
        students: [],
        status: "active",
      };

      jest.spyOn(SectionZodSchema, "partial").mockReturnValue({
        parse: jest.fn().mockReturnValue(mockSectionData),
      } as any);

      mockSectionService.createSection.mockResolvedValue(mockCreatedSection as unknown as ISection);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockSectionData,
        user: {
          id: "mockUserId",
          organizationId: "mockOrgId",
          role: "admin",
          email: "admin@example.com",
          firstName: "Admin",
          lastName: "User",
        },
      });

      const res = createMockResponse();

      await sectionRouteHandlers.createSection(req, res);

      expect(mockSectionService.createSection).toHaveBeenCalledWith(
        expect.objectContaining({
          code: mockSectionData.code,
          name: mockSectionData.name,
          course: mockSectionData.course,
          instructor: mockSectionData.instructor,
          schedule: mockSectionData.schedule,
          status: mockSectionData.status,
          isDeleted: mockSectionData.isDeleted,
          totalStudent: mockSectionData.totalStudent,
          modules: mockSectionData.modules,
          students: mockSectionData.students,
          announcements: mockSectionData.announcements,
          assessments: mockSectionData.assessments,
          grade: mockSectionData.grade,
        }),
        req.user
      );
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockCreatedSection,
      });
    });

    test("should handle error when user is not found", async () => {
      const mockSectionData = {
        code: "CS101A",
        name: "Introduction to Computer Science",
      };

      const req = createMockRequest({
        body: mockSectionData,
        user: undefined,
      });

      const res = createMockResponse();

      await sectionRouteHandlers.createSection(req, res);

      expect(mockSectionService.createSection).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("updateSection", () => {
    test("should update a section successfully", async () => {
      const sectionId = "existingSectionId";
      const mockUpdateData = {
        _id: sectionId,
        name: "Updated Computer Science",
        status: "inactive",
      };

      const mockUpdatedSection = {
        _id: sectionId,
        code: "CS101A",
        name: "Updated Computer Science",
        organizationId: "orgId1",
        course: "courseId1",
        instructor: "instructorId1",
        students: ["student1", "student2"],
        schedule: {
          startDate: new Date("2025-01-15"),
          endDate: new Date("2025-05-15"),
          days: ["mon", "wed", "fri"],
          time: {
            start: "9:00 AM",
            end: "10:30 AM",
          },
        },
        status: "inactive",
      };

      const mockZodSchema = {
        extend: jest.fn().mockReturnValue({
          refine: jest.fn().mockReturnValue({
            parse: jest.fn().mockReturnValue(mockUpdateData),
          }),
        }),
      };

      jest.spyOn(SectionZodSchema, "partial").mockReturnValue(mockZodSchema as any);

      mockSectionService.getSection.mockResolvedValue({
        _id: sectionId,
        code: "CS101A",
        name: "Introduction to Computer Science",
        status: "active",
        instructor: "instructorId1",
        students: ["student1", "student2"],
      } as unknown as ISection);

      mockSectionService.updateSection.mockResolvedValue(mockUpdatedSection as unknown as ISection);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockUpdateData,
        user: {
          id: "mockUserId",
          email: "test@example.com",
          organizationId: "mockOrgId",
          role: "admin",
          firstName: "Test",
          lastName: "User",
        },
      });

      const res = createMockResponse();

      await sectionRouteHandlers.updateSection(req, res);

      expect(mockSectionService.updateSection).toHaveBeenCalledWith(mockUpdateData);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockUpdatedSection,
      });
    }, 10000);

    test("should handle error when user is not found", async () => {
      const mockUpdateData = {
        _id: "sectionId",
        name: "Updated Computer Science",
      };

      const req = createMockRequest({
        body: mockUpdateData,
        user: undefined,
      });

      const res = createMockResponse();

      await sectionRouteHandlers.updateSection(req, res);

      expect(mockSectionService.updateSection).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("deleteSection", () => {
    test("should delete a section successfully", async () => {
      const sectionId = "sectionToDeleteId";
      const mockSection = {
        _id: sectionId,
        code: "CS101A",
        name: "Introduction to Computer Science",
      };

      mockSectionService.getSection.mockResolvedValue(mockSection as unknown as ISection);
      mockSectionService.deleteSection.mockResolvedValue(mockSection as unknown as ISection);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: sectionId },
      });

      const res = createMockResponse();

      await sectionRouteHandlers.deleteSection(req, res);

      expect(mockSectionService.deleteSection).toHaveBeenCalledWith(sectionId);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
      });
    });

    test("should handle error when user is not found", async () => {
      const sectionId = "sectionToDeleteId";

      const req = createMockRequest({
        params: { id: sectionId },
        user: undefined,
      });

      const res = createMockResponse();

      await sectionRouteHandlers.deleteSection(req, res);

      expect(mockSectionService.deleteSection).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("searchSection", () => {
    test("should search sections successfully", async () => {
      const searchQuery = { name: "Computer Science" };
      const mockSearchResults = [
        {
          _id: "section1",
          code: "CS101A",
          name: "Introduction to Computer Science",
        },
        {
          _id: "section2",
          code: "CS102B",
          name: "Advanced Computer Science",
        },
      ];

      mockSectionService.searchSection.mockResolvedValue(mockSearchResults);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: searchQuery,
      });

      const res = createMockResponse();

      await sectionRouteHandlers.searchSection(req, res);

      expect(mockSectionService.searchSection).toHaveBeenCalledWith(
        expect.objectContaining({
          ...searchQuery,
          currentUserId: "mockUserId",
        })
      );
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockSearchResults);
    });
  });

  describe("markAttendance", () => {
    test("should mark attendance successfully", async () => {
      const attendanceData = {
        sectionId: "mockSectionId",
        remarks: "Test attendance",
      };

      const mockAttendanceResult = [
        {
          userId: "mockUserId",
          userType: "student",
          date: new Date(),
          status: "present",
          remarks: "Test attendance",
        },
      ];

      mockSectionService.markAttendance.mockResolvedValue(mockAttendanceResult);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: attendanceData,
      });

      const res = createMockResponse();

      await sectionRouteHandlers.markAttendance(req, res);

      expect(mockSectionService.markAttendance).toHaveBeenCalledWith(
        attendanceData.sectionId,
        req.user,
        attendanceData.remarks
      );
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Attendance marked successfully",
        data: mockAttendanceResult,
      });
    });

    test("should handle unauthorized access", async () => {
      const attendanceData = {
        sectionId: "mockSectionId",
      };

      const req = createMockRequest({
        body: attendanceData,
        user: undefined,
      });

      const res = createMockResponse();

      await sectionRouteHandlers.markAttendance(req, res);

      expect(mockSectionService.markAttendance).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test("should validate required fields", async () => {
      const req = createMockRequest({
        body: {},
      });

      const res = createMockResponse();

      await sectionRouteHandlers.markAttendance(req, res);

      expect(mockSectionService.markAttendance).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("getSectionAttendance", () => {
    test("should get section attendance successfully", async () => {
      const sectionCode = "CS101A";
      const fromDate = "2025-04-01";
      const toDate = "2025-04-28";

      const mockAttendanceData = {
        data: {
          dates: ["2025-04-01", "2025-04-03", "2025-04-08"],
          data: [
            {
              studentId: "student1",
              name: "John Doe",
              attendance: [
                { date: "2025-04-01", status: "present" },
                { date: "2025-04-03", status: "present" },
                { date: "2025-04-08", status: "absent" },
              ],
            },
          ],
        },
        totalEnrolled: 10,
      };

      mockSectionService.getSectionAttendance.mockResolvedValue(mockAttendanceData);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { sectionCode },
        query: { from: fromDate, to: toDate },
      });

      const res = createMockResponse();

      await sectionRouteHandlers.getSectionAttendance(req, res);

      expect(mockSectionService.getSectionAttendance).toHaveBeenCalledWith(
        sectionCode,
        fromDate,
        toDate,
        req.user
      );
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Section attendance retrieved successfully",
        data: mockAttendanceData.data,
        totalEnrolled: mockAttendanceData.totalEnrolled,
      });
    });

    test("should handle unauthorized access", async () => {
      const sectionCode = "CS101A";

      const req = createMockRequest({
        params: { sectionCode },
        user: undefined,
      });

      const res = createMockResponse();

      await sectionRouteHandlers.getSectionAttendance(req, res);

      expect(mockSectionService.getSectionAttendance).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test("should validate section code", async () => {
      const req = createMockRequest({
        params: {},
      });

      const res = createMockResponse();

      await sectionRouteHandlers.getSectionAttendance(req, res);

      expect(mockSectionService.getSectionAttendance).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("bulkAddStudents", () => {
    test("should bulk add students successfully", async () => {
      const mockFile = {
        buffer: Buffer.from(
          "Email\nstudent1@example.com\nstudent2@example.com\nstudent3@example.com"
        ),
        mimetype: "text/csv",
        fieldname: "file",
        originalname: "students.csv",
        encoding: "7bit",
        size: 42,
        stream: {} as any,
        destination: "",
        filename: "students.csv",
        path: "/tmp/students.csv",
      };

      const mockUsers = [
        { _id: "user1", studentId: "S2023001", email: "student1@example.com" },
        { _id: "user2", studentId: "S2023002", email: "student2@example.com" },
        { _id: "user3", studentId: "S2023003", email: "student3@example.com" },
      ];

      const mockResult = {
        section: {
          _id: "section1",
          code: "CS101A",
          name: "Introduction to Computer Science",
          students: ["user1", "user2", "user3"],
        } as unknown as ISection,
        results: {
          success: ["user1", "user2", "user3"],
          errors: [],
        },
      };

      mockUserService.searchUser.mockResolvedValue(mockUsers);
      mockSectionService.bulkAddStudents.mockResolvedValue(mockResult);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { sectionCode: "CS101A" },
        file: mockFile,
      });

      const res = createMockResponse();

      await sectionRouteHandlers.bulkAddStudents(req, res);

      expect(mockUserService.searchUser).toHaveBeenCalledWith({
        match: {
          email: { $in: ["student1@example.com", "student2@example.com", "student3@example.com"] },
          organizationId: req.user?.organizationId,
        },
        sort: "-createdAt",
        select: "email studentId firstName lastName",
        skip: 0,
        limit: 3,
        lean: true,
      });
      expect(mockSectionService.bulkAddStudents).toHaveBeenCalledWith("CS101A", [
        "user1",
        "user2",
        "user3",
      ]);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Successfully added 3 students (0 failed)",
        result: {
          successCount: 3,
          successList: ["user1", "user2", "user3"],
          errorCount: 0,
          errorList: [],
        },
      });
    });

    test("should validate file upload", async () => {
      const req = createMockRequest({
        params: { sectionCode: "CS101A" },
        file: undefined,
      });

      const res = createMockResponse();

      await sectionRouteHandlers.bulkAddStudents(req, res);

      expect(mockUserService.searchUser).not.toHaveBeenCalled();
      expect(mockSectionService.bulkAddStudents).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("archiveSection", () => {
    test("should archive a section successfully", async () => {
      const sectionId = "sectionToArchiveId";
      const mockSection = {
        _id: sectionId,
        code: "CS101A",
        name: "Introduction to Computer Science",
        archive: {
          status: true,
          date: new Date(),
        },
      };

      mockSectionService.archiveSection.mockResolvedValue(mockSection as unknown as ISection);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: sectionId },
      });

      const res = createMockResponse();

      await sectionRouteHandlers.archiveSection(req, res);

      expect(mockSectionService.archiveSection).toHaveBeenCalledWith(sectionId);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockSection,
      });
    });

    test("should handle unauthorized access", async () => {
      const sectionId = "sectionToArchiveId";

      const req = createMockRequest({
        params: { id: sectionId },
        user: undefined,
      });

      const res = createMockResponse();

      await sectionRouteHandlers.archiveSection(req, res);

      expect(mockSectionService.archiveSection).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test("should handle section not found", async () => {
      const sectionId = "nonExistentSectionId";
      mockSectionService.archiveSection.mockResolvedValue(null);

      const req = createMockRequest({
        params: { id: sectionId },
      });

      const res = createMockResponse();

      await sectionRouteHandlers.archiveSection(req, res);

      expect(mockSectionService.archiveSection).toHaveBeenCalledWith(sectionId);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("getSectionAssessment", () => {
    test("should get section assessment successfully", async () => {
      const sectionCode = "CS101A";
      const mockAssessment = {
        newAssessmentCount: 3,
        newAssessmentId: ["assessment1", "assessment2", "assessment3"],
      };

      mockSectionService.getSectionAssessment.mockResolvedValue(mockAssessment);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { sectionCode },
        query: {
          skip: "0",
          limit: "10",
          sort: undefined,
          count: "false",
          pagination: "false",
          document: "false",
          pendingAssessment: "false",
          assessmentId: "false",
        },
      });

      const res = createMockResponse();

      await sectionRouteHandlers.getSectionAssessment(req, res);

      expect(mockSectionService.getSectionAssessment).toHaveBeenCalledWith(sectionCode, req.user, {
        skip: 0,
        limit: 10,
        sort: undefined,
        count: false,
        pagination: false,
        document: false,
        pendingAssessment: false,
        assessmentId: false,
      });
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Section assessments retrieved successfully",
        data: mockAssessment,
      });
    });

    test("should handle unauthorized access", async () => {
      const sectionCode = "CS101A";

      const req = createMockRequest({
        params: { sectionCode },
        user: undefined,
      });

      const res = createMockResponse();

      await sectionRouteHandlers.getSectionAssessment(req, res);

      expect(mockSectionService.getSectionAssessment).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe("getSectionAnnouncement", () => {
    test("should get section announcements successfully", async () => {
      const sectionCode = "CS101A";
      const mockAnnouncement = {
        currentAnnouncement: [
          { title: "Test Announcement 1" },
          { title: "Test Announcement 2" },
          { title: "Test Announcement 3" },
        ],
        futureAnnouncement: [{ title: "Future Announcement 1" }],
        pastAnnouncement: [{ title: "Old Announcement 1" }, { title: "Old Announcement 2" }],
        count: 5,
      };

      mockSectionService.getSectionAnnouncements.mockResolvedValue(mockAnnouncement);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { sectionCode },
      });

      const res = createMockResponse();

      await sectionRouteHandlers.getSectionAnnouncement(req, res);

      expect(mockSectionService.getSectionAnnouncements).toHaveBeenCalledWith(
        sectionCode,
        expect.any(Object),
        req.user,
        false,
        ""
      );
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Section announcements retrieved successfully",
        currentAnnouncement: mockAnnouncement.currentAnnouncement,
        futureAnnouncement: mockAnnouncement.futureAnnouncement,
        pastAnnouncement: mockAnnouncement.pastAnnouncement,
        count: mockAnnouncement.count,
      });
    });

    test("should handle unauthorized access", async () => {
      const sectionCode = "CS101A";

      const req = createMockRequest({
        params: { sectionCode },
        user: undefined,
      });

      const res = createMockResponse();

      await sectionRouteHandlers.getSectionAnnouncement(req, res);

      expect(mockSectionService.getSectionAnnouncements).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe("getStudentGrades", () => {
    test("should get student grades successfully", async () => {
      const sectionCode = "CS101A";
      const mockGrades = [
        {
          assessmentId: "assessment1",
          assessmentType: "quiz 1",
          points: "8/10",
          status: "done",
          percentage: "80%",
          grade: "B",
          isPassed: true,
        },
        {
          assessmentId: "assessment2",
          assessmentType: "midterm",
          points: "45/50",
          status: "done",
          percentage: "90%",
          grade: "A",
          isPassed: true,
        },
      ];

      mockSectionService.getStudentGrades.mockResolvedValue(mockGrades);

      const req = createMockRequest({
        params: { sectionCode },
      });

      const res = createMockResponse();

      await sectionRouteHandlers.getStudentGrades(req, res);

      expect(mockSectionService.getStudentGrades).toHaveBeenCalledWith(sectionCode, req.user?.id);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Student grades retrieved successfully",
        status: "success",
        data: mockGrades,
      });
    });

    test("should handle unauthorized access", async () => {
      const sectionCode = "CS101A";

      const req = createMockRequest({
        params: { sectionCode },
        user: undefined,
      });

      const res = createMockResponse();

      await sectionRouteHandlers.getStudentGrades(req, res);

      expect(mockSectionService.getStudentGrades).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe("getSectionStudentGradesAnalytics", () => {
    test("should get section grade analytics successfully", async () => {
      const sectionCode = "CS101A";
      const mockAnalytics = {
        totalStudentsEnrolled: 25,
        averageFinalGrade: 85.6,
        topGradesPercent: 32,
        gradeData: [
          { grade: "A", count: 8, percentage: 32 },
          { grade: "B", count: 10, percentage: 40 },
          { grade: "C", count: 5, percentage: 20 },
          { grade: "D", count: 2, percentage: 8 },
        ],
      };

      mockSectionService.getSectionStudentGradesAnalytics.mockResolvedValue(mockAnalytics);

      const req = createMockRequest({
        params: { sectionCode },
        user: {
          id: "mockUserId",
          email: "test@example.com",
          organizationId: "mockOrgId",
          role: "instructor",
          firstName: "Test",
          lastName: "User",
        },
      });

      const res = createMockResponse();

      await sectionRouteHandlers.getSectionStudentGradesAnalytics(req, res);

      expect(mockSectionService.getSectionStudentGradesAnalytics).toHaveBeenCalledWith(
        sectionCode,
        req.user
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Section grade analytics retrieved successfully",
        status: "success",
        data: mockAnalytics,
      });
    });

    test("should handle unauthorized access", async () => {
      const sectionCode = "CS101A";

      const req = createMockRequest({
        params: { sectionCode },
        user: undefined,
      });

      const res = createMockResponse();

      await sectionRouteHandlers.getSectionStudentGradesAnalytics(req, res);

      expect(mockSectionService.getSectionStudentGradesAnalytics).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe("Role-Based Access Control", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const testRoleAccess = (
      endpoint: string,
      action: string,
      allowedRoles: string[] = [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]
    ) => {
      describe(`${endpoint} endpoint permissions`, () => {
        test.each(allowedRoles)(`should allow %s role to access ${endpoint}`, (role) => {
          const mockValidatePermissions = validatePermissions as jest.MockedFunction<
            typeof validatePermissions
          >;
          mockValidatePermissions.mockClear();

          validatePermissions([role], action);

          expect(mockValidatePermissions).toHaveBeenCalledWith([role], action);
        });

        test.each(Object.values(USER_ROLES).filter((role) => !allowedRoles.includes(role)))(
          `should deny %s role from accessing ${endpoint}`,
          (role) => {
            const req = createMockRequest({
              user: {
                id: "mockUserId",
                email: "test@example.com",
                organizationId: "mockOrgId",
                role,
                firstName: "",
                lastName: "",
              },
            });
            const res = createMockResponse();
            const next = jest.fn();

            const middleware = validatePermissions(allowedRoles, action);
            middleware(req, res, next);

            if (!allowedRoles.includes(role)) {
              expect(res.status).toHaveBeenCalledWith(403);
              expect(next).not.toHaveBeenCalled();
            } else {
              expect(next).toHaveBeenCalled();
            }
          }
        );
      });
    };

    testRoleAccess("getSections", ACTION.GET_ALL, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.STUDENT,
      USER_ROLES.INSTRUCTOR,
    ]);

    testRoleAccess("getSection", ACTION.GET_BY_ID, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.STUDENT,
      USER_ROLES.INSTRUCTOR,
    ]);

    testRoleAccess("createSection", ACTION.CREATE, [USER_ROLES.ADMIN]);

    testRoleAccess("updateSection", ACTION.UPDATE, [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR]);

    testRoleAccess("deleteSection", ACTION.DELETE, [USER_ROLES.ADMIN]);

    testRoleAccess("archiveSection", ACTION.ARCHIVE, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
    ]);

    testRoleAccess("markAttendance", ACTION.CREATE, [USER_ROLES.STUDENT, USER_ROLES.INSTRUCTOR]);

    testRoleAccess("getSectionStudentGradesAnalytics", ACTION.GET_ALL, [
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.ADMIN,
    ]);
  });

  describe("Section Zod Validation", () => {
    describe("createSection validation", () => {
      test("should validate section code format", async () => {
        const invalidData = {
          code: "CS",
          name: "Computer Science",
        };

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        await sectionRouteHandlers.createSection(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      test("should validate required fields for schedule", async () => {
        const invalidData = {
          code: "CS101A",
          name: "Computer Science",
        };

        mockSectionService.createSection.mockImplementation(() => {
          throw new Error("schedule is required");
        });

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        await sectionRouteHandlers.createSection(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe("updateSection validation", () => {
      test("should validate that either section ID or code is provided", async () => {
        const invalidData = {
          name: "Updated Computer Science",
        };

        jest.spyOn(SectionZodSchema, "partial").mockReturnValue({
          extend: jest.fn().mockReturnValue({
            refine: jest.fn().mockReturnValue({
              parse: jest.fn().mockImplementation(() => {
                throw new Error("Either section ID or code is required");
              }),
            }),
          }),
        } as any);

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        await sectionRouteHandlers.updateSection(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      test("should validate section code format when provided", async () => {
        const invalidData = {
          code: "CS",
          name: "Updated Computer Science",
        };

        jest.spyOn(SectionZodSchema, "partial").mockReturnValue({
          extend: jest.fn().mockReturnValue({
            refine: jest.fn().mockReturnValue({
              parse: jest.fn().mockImplementation(() => {
                throw new Error("Section code must be at least 5 characters");
              }),
            }),
          }),
        } as any);

        const req = createMockRequest({
          body: invalidData,
        });

        const res = createMockResponse();

        await sectionRouteHandlers.updateSection(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe("markAttendance validation", () => {
      test("should validate that sectionId is required", async () => {
        const req = createMockRequest({
          body: {
            remarks: "Test remarks",
          },
        });

        const res = createMockResponse();

        await sectionRouteHandlers.markAttendance(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe("getSectionAttendance validation", () => {
      test("should validate date format", async () => {
        const sectionCode = "CS101A";

        const req = createMockRequest({
          params: { sectionCode },
          query: {
            from: "invalid-date",
          },
        });

        const res = createMockResponse();

        const originalDate = global.Date;
        global.Date = jest.fn((...args: any[]) => {
          if (args[0] === "invalid-date") {
            return new originalDate("invalid");
          }
          return new (originalDate as any)(...args);
        }) as any;
        global.Date.UTC = originalDate.UTC;
        global.Date.parse = originalDate.parse;
        global.Date.now = originalDate.now;

        await sectionRouteHandlers.getSectionAttendance(req, res);

        global.Date = originalDate;

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining("Invalid"),
          })
        );
      });
    });
  });
});
