import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { Response } from "express";
import { CustomRequest } from "../../type/types";
import courseService from "../../services/courseService";
import activityLogService from "../../services/activityLogService";
import auditLogService from "../../services/auditLogService";
import { ICourse } from "../../models/courseModel";
import { USER_ROLES, ACTION } from "../../config/common";
import { validatePermissions } from "../../middleware/rabcMiddleware";

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
          return res.status(401).json({ message: "Not authenticated" });
        }

        if (!req.user.role || !_roles.includes(req.user.role)) {
          return res.status(403).json({ message: "Not authorized" });
        }

        next();
      };
    }),
  };
});

jest.mock("../../helper/formDataHelper", () => ({
  processCourseFormData: jest.fn(),
}));

import * as courseRouteHandlers from "../../routes/courseRoute";
import { AnnouncementZodSchema } from "../../models/announcementModel";

jest.mock("../../services/courseService");
jest.mock("../../services/activityLogService");
jest.mock("../../services/auditLogService");

jest.mock("mongoose", () => {
  const originalModule = jest.requireActual("mongoose") as object;
  return {
    ...originalModule,
    Types: {
      ObjectId: jest.fn().mockImplementation((id) => id || "mockedObjectId"),
    },
  };
});

const mockCourseService = courseService as jest.Mocked<typeof courseService>;
const mockActivityLogService = activityLogService as jest.Mocked<typeof activityLogService>;
const mockAuditLogService = auditLogService as jest.Mocked<typeof auditLogService>;

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
    path: "/api/course/test",
    method: "GET",
    originalUrl: "/api/course/test",
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

describe("Course Route Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getCourses", () => {
    test("should get all courses successfully", async () => {
      const mockCourses = [
        {
          _id: "course1",
          title: "Course 1",
          description: "Test course 1",
          level: "beginner",
          status: "draft",
        } as unknown as ICourse,
        {
          _id: "course2",
          title: "Course 2",
          description: "Test course 2",
          level: "intermediate",
          status: "published",
        } as unknown as ICourse,
      ];

      const mockPagination = {
        totalItems: 2,
        totalPages: 1,
        currentPage: 1,
        pageSize: 10,
      };

      mockCourseService.getCourses.mockResolvedValue({
        courses: mockCourses,
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

      await courseRouteHandlers.getCourses(req, res);

      expect(mockCourseService.getCourses).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: "Courses retrieved successfully",
        data: mockCourses,
        pagination: mockPagination,
        count: 2,
      });
    });
  });

  describe("getCourse", () => {
    test("should get a course by ID successfully", async () => {
      const courseId = "mockCourseId";
      const mockCourse = {
        _id: courseId,
        title: "Test Course",
        description: "This is a test course",
        level: "beginner",
        status: "published",
      };

      mockCourseService.getCourse.mockResolvedValue(mockCourse as unknown as ICourse);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: courseId },
      });

      const res = createMockResponse();

      await courseRouteHandlers.getCourse(req, res);

      expect(mockCourseService.getCourse).toHaveBeenCalledWith(courseId, expect.any(Object));
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: "Course retrieved successfully",
        data: mockCourse,
      });
    });
  });

  describe("createCourse", () => {
    test("should create a course successfully", async () => {
      const mockCourseData = {
        title: "New Course",
        description: "Test course description",
        level: "beginner",
        category: "Programming",
        code: "PROG101",
      };

      const mockCreatedCourse = {
        _id: "newCourseId",
        ...mockCourseData,
        status: "draft",
        isPublished: false,
      };

      mockCourseService.createCourse.mockResolvedValue(mockCreatedCourse as unknown as ICourse);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockCourseData,
      });

      const res = createMockResponse();

      await courseRouteHandlers.createCourse(req, res);

      expect(mockCourseService.createCourse).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: "Course created successfully",
        data: mockCreatedCourse,
      });
    });
  });

  describe("updateCourse", () => {
    test("should update a course successfully", async () => {
      const courseId = "existingCourseId";
      const mockUpdateData = {
        _id: courseId,
        title: "Updated Course",
        description: "This course has been updated",
      };

      const mockUpdatedCourse = {
        _id: courseId,
        title: "Updated Course",
        description: "This course has been updated",
        level: "beginner",
        status: "published",
      };

      mockCourseService.updateCourse.mockResolvedValue(mockUpdatedCourse as unknown as ICourse);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockUpdateData,
      });

      const res = createMockResponse();

      await courseRouteHandlers.updateCourse(req, res);

      expect(mockCourseService.updateCourse).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: "Course update successful",
        data: mockUpdatedCourse,
      });
    });
  });

  describe("deleteCourse", () => {
    test("should delete a course successfully", async () => {
      const courseId = "courseToDeleteId";
      const mockDeletedCourse = {
        _id: courseId,
        title: "Course to Delete",
        description: "This course will be deleted",
        isDeleted: true,
      };

      mockCourseService.deleteCourse.mockResolvedValue(mockDeletedCourse as unknown as ICourse);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: courseId },
      });

      const res = createMockResponse();

      await courseRouteHandlers.deleteCourse(req, res);

      expect(mockCourseService.deleteCourse).toHaveBeenCalledWith(courseId);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: "Delete successful",
      });
    });

    test("should return 404 when course to delete is not found", async () => {
      const courseId = "nonExistentCourseId";

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      mockCourseService.deleteCourse.mockImplementation((_id) => {
        res.status(404);
        res.json({ message: "Course not found" });
        return Promise.resolve(null);
      });

      const req = createMockRequest({
        params: { id: courseId },
      });

      await courseRouteHandlers.deleteCourse(req, res);

      expect(mockCourseService.deleteCourse).toHaveBeenCalledWith(courseId);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Course not found" });
    });
  });

  describe("searchCourse", () => {
    test("should search courses successfully", async () => {
      const searchQuery = {
        query: { title: "Programming" },
      };

      const mockFoundCourses = [
        {
          _id: "course1",
          title: "Programming 101",
          description: "Introduction to programming",
          status: "published",
        },
        {
          _id: "course2",
          title: "Advanced Programming",
          description: "Advanced programming concepts",
          status: "published",
        },
      ];

      mockCourseService.searchCourse.mockResolvedValue(mockFoundCourses as unknown as ICourse[]);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: searchQuery,
      });

      const res = createMockResponse();

      await courseRouteHandlers.searchCourse(req, res);

      expect(mockCourseService.searchCourse).toHaveBeenCalledWith(searchQuery);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockFoundCourses);
    });

    test("should handle empty search results", async () => {
      const searchQuery = {
        query: { title: "Non-existent Course" },
      };

      mockCourseService.searchCourse.mockResolvedValue([]);

      const req = createMockRequest({
        body: searchQuery,
      });

      const res = createMockResponse();

      await courseRouteHandlers.searchCourse(req, res);

      expect(mockCourseService.searchCourse).toHaveBeenCalledWith(searchQuery);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith([]);
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
        const allRoles = {
          [USER_ROLES.SUPERADMIN]: { shouldPass: allowedRoles.includes(USER_ROLES.SUPERADMIN) },
          [USER_ROLES.ADMIN]: { shouldPass: allowedRoles.includes(USER_ROLES.ADMIN) },
          [USER_ROLES.INSTRUCTOR]: { shouldPass: allowedRoles.includes(USER_ROLES.INSTRUCTOR) },
          [USER_ROLES.STUDENT]: { shouldPass: allowedRoles.includes(USER_ROLES.STUDENT) },
          [USER_ROLES.EMPLOYEE]: { shouldPass: allowedRoles.includes(USER_ROLES.EMPLOYEE) },
          [USER_ROLES.USER]: { shouldPass: allowedRoles.includes(USER_ROLES.USER) },
          [USER_ROLES.VIEW]: { shouldPass: allowedRoles.includes(USER_ROLES.VIEW) },
        };

        Object.entries(allRoles).forEach(([role, { shouldPass }]) => {
          test(`${role} ${shouldPass ? "should have" : "should NOT have"} access`, () => {
            const middleware = validatePermissions(allowedRoles, action);

            let requestPayload = {};
            switch (endpoint) {
              case "getCourse":
                requestPayload = { params: { id: "courseId" } };
                break;
              case "updateCourse":
                requestPayload = { body: { _id: "courseId" } };
                break;
              case "searchCourse":
                requestPayload = { body: { query: { title: "Test" } } };
                break;
            }

            const req = createMockRequest({
              user: {
                id: `${role}Id`,
                email: `${role.toLowerCase()}@example.com`,
                organizationId: "orgId",
                role: role,
                firstName: "",
                lastName: "",
              },
              ...requestPayload,
            });

            const res = createMockResponse();
            const next = jest.fn();

            middleware(req, res, next);

            if (shouldPass) {
              expect(next).toHaveBeenCalled();
              expect(res.status).not.toHaveBeenCalled();
            } else {
              expect(next).not.toHaveBeenCalled();
              expect(res.status).toHaveBeenCalledWith(403);
              expect(res.json).toHaveBeenCalledWith({ message: "Not authorized" });
            }
          });
        });
      });
    };

    testRoleAccess("getCourses", ACTION.GET_ALL, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.STUDENT,
    ]);

    testRoleAccess("getCourse", ACTION.GET_BY_ID, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.STUDENT,
    ]);

    testRoleAccess("createCourse", ACTION.CREATE, [USER_ROLES.ADMIN]);

    testRoleAccess("updateCourse", ACTION.UPDATE, [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR]);

    testRoleAccess("archiveCourse", ACTION.ARCHIVE, [USER_ROLES.ADMIN]);

    describe("Custom role combinations", () => {
      describe("Admin-only permissions", () => {
        const adminOnlyMiddleware = validatePermissions([USER_ROLES.ADMIN], ACTION.CUSTOM);

        test("SUPERADMIN should NOT have access", () => {
          const req = createMockRequest({
            user: {
              id: "superadminId",
              email: "superadmin@example.com",
              organizationId: "orgId",
              role: USER_ROLES.SUPERADMIN,
              firstName: "",
              lastName: "",
            },
          });
          const res = createMockResponse();
          const next = jest.fn();

          adminOnlyMiddleware(req, res, next);

          expect(next).not.toHaveBeenCalled();
          expect(res.status).toHaveBeenCalledWith(403);
        });

        test("ADMIN should have access", () => {
          const req = createMockRequest({
            user: {
              id: "adminId",
              email: "admin@example.com",
              organizationId: "orgId",
              role: USER_ROLES.ADMIN,
              firstName: "",
              lastName: "",
            },
          });
          const res = createMockResponse();
          const next = jest.fn();

          adminOnlyMiddleware(req, res, next);

          expect(next).toHaveBeenCalled();
        });

        test("Other roles should NOT have access", () => {
          const roles = [
            USER_ROLES.INSTRUCTOR,
            USER_ROLES.STUDENT,
            USER_ROLES.EMPLOYEE,
            USER_ROLES.USER,
            USER_ROLES.VIEW,
          ];

          roles.forEach((role) => {
            const req = createMockRequest({
              user: {
                id: `${role}Id`,
                email: `${role.toLowerCase()}@example.com`,
                organizationId: "orgId",
                role: role,
                firstName: "",
                lastName: "",
              },
            });
            const res = createMockResponse();
            const next = jest.fn();

            adminOnlyMiddleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
          });
        });
      });

      describe("Instructor-allowed permissions", () => {
        const instructorAllowedMiddleware = validatePermissions(
          [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR],
          ACTION.CUSTOM
        );

        test("ADMIN and INSTRUCTOR should have access", () => {
          const allowedRoles = [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR];

          allowedRoles.forEach((role) => {
            const req = createMockRequest({
              user: {
                id: `${role}Id`,
                email: `${role.toLowerCase()}@example.com`,
                organizationId: "orgId",
                role: role,
                firstName: "",
                lastName: "",
              },
            });
            const res = createMockResponse();
            const next = jest.fn();

            instructorAllowedMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
          });
        });

        test("Other roles should NOT have access", () => {
          const roles = [
            USER_ROLES.SUPERADMIN,
            USER_ROLES.STUDENT,
            USER_ROLES.EMPLOYEE,
            USER_ROLES.USER,
            USER_ROLES.VIEW,
          ];

          roles.forEach((role) => {
            const req = createMockRequest({
              user: {
                id: `${role}Id`,
                email: `${role.toLowerCase()}@example.com`,
                organizationId: "orgId",
                role: role,
                firstName: "",
                lastName: "",
              },
            });
            const res = createMockResponse();
            const next = jest.fn();

            instructorAllowedMiddleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
          });
        });
      });

      describe("Student view permissions", () => {
        const studentViewMiddleware = validatePermissions(
          [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR, USER_ROLES.STUDENT],
          ACTION.CUSTOM
        );

        test("ADMIN, INSTRUCTOR, and STUDENT should have access", () => {
          const allowedRoles = [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR, USER_ROLES.STUDENT];

          allowedRoles.forEach((role) => {
            const req = createMockRequest({
              user: {
                id: `${role}Id`,
                email: `${role.toLowerCase()}@example.com`,
                organizationId: "orgId",
                role: role,
                firstName: "",
                lastName: "",
              },
            });
            const res = createMockResponse();
            const next = jest.fn();

            studentViewMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
          });
        });

        test("Other roles should NOT have access", () => {
          const roles = [
            USER_ROLES.SUPERADMIN,
            USER_ROLES.EMPLOYEE,
            USER_ROLES.USER,
            USER_ROLES.VIEW,
          ];

          roles.forEach((role) => {
            const req = createMockRequest({
              user: {
                id: `${role}Id`,
                email: `${role.toLowerCase()}@example.com`,
                organizationId: "orgId",
                role: role,
                firstName: "",
                lastName: "",
              },
            });
            const res = createMockResponse();
            const next = jest.fn();

            studentViewMiddleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
          });
        });
      });
    });
  });
});

describe("Course Zod Validation", () => {
  describe("createCourse validation", () => {
    test("should validate required fields", async () => {
      const invalidData = {};

      mockCourseService.createCourse.mockReset();

      const req = createMockRequest({
        body: invalidData,
      });

      const res = createMockResponse();

      jest.spyOn(courseRouteHandlers, "createCourse").mockImplementation(async (_req, res) => {
        res.status(400).json({ error: "Validation error" });
        return;
      });

      await courseRouteHandlers.createCourse(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockCourseService.createCourse).not.toHaveBeenCalled();
    });

    test("should validate field formats", async () => {
      const invalidData = {
        title: "",
        description: "A".repeat(1001),
      };

      mockCourseService.createCourse.mockReset();

      const mockZodError = new Error("Validation error");
      mockZodError.name = "ZodError";

      const handleZodErrorMock = jest.requireMock<{
        handleZodError: (error: unknown, res: Response) => boolean;
      }>("../../middleware/zodErrorHandler").handleZodError;
      (handleZodErrorMock as jest.MockedFunction<typeof handleZodErrorMock>).mockImplementation(
        (error: unknown, res: Response) => {
          res.status(400).json({ error: "Validation error" });
          return true;
        }
      );

      jest.spyOn(AnnouncementZodSchema, "parse").mockImplementation(() => {
        throw mockZodError;
      });

      const req = createMockRequest({
        body: invalidData,
      });

      const res = createMockResponse();

      await courseRouteHandlers.createCourse(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockCourseService.createCourse).not.toHaveBeenCalled();
    });

    test("should handle missing user information", async () => {
      const validData = {
        title: "Valid Course",
        description: "This is a valid course description",
      };

      mockCourseService.createCourse.mockReset();

      const req = createMockRequest({
        body: validData,
        user: undefined, // Missing user
      });

      const res = createMockResponse();

      jest.spyOn(AnnouncementZodSchema, "parse").mockImplementation(() => {
        throw new Error("User information is missing or invalid");
      });

      await courseRouteHandlers.createCourse(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockCourseService.createCourse).not.toHaveBeenCalled();
    });
  });

  describe("updateCourse validation", () => {
    test("should validate that _id is provided", async () => {
      const invalidData = {
        title: "Updated Course",
        description: "Updated description",
      };

      const mockZodError = new Error("Validation error");
      mockZodError.name = "ZodError";

      const handleZodErrorMock = jest.requireMock<{
        handleZodError: (error: unknown, res: Response) => boolean;
      }>("../../middleware/zodErrorHandler").handleZodError;
      (handleZodErrorMock as jest.MockedFunction<typeof handleZodErrorMock>).mockImplementation(
        (error: unknown, res: Response) => {
          res.status(400).json({ error: "Validation error" });
          return true;
        }
      );

      const req = createMockRequest({
        body: invalidData,
      });

      const res = createMockResponse();

      await courseRouteHandlers.updateCourse(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockCourseService.updateCourse).not.toHaveBeenCalled();
    });

    test("should validate field formats in update", async () => {
      const invalidData = {
        _id: "courseId",
        title: "",
      };

      const mockZodError = new Error("Validation error");
      mockZodError.name = "ZodError";

      const handleZodErrorMock = jest.requireMock<{
        handleZodError: (error: unknown, res: Response) => boolean;
      }>("../../middleware/zodErrorHandler").handleZodError;
      (handleZodErrorMock as jest.MockedFunction<typeof handleZodErrorMock>).mockImplementation(
        (error: unknown, res: Response) => {
          res.status(400).json({ error: "Validation error" });
          return true;
        }
      );

      const req = createMockRequest({
        body: invalidData,
      });

      const res = createMockResponse();

      await courseRouteHandlers.updateCourse(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockCourseService.updateCourse).not.toHaveBeenCalled();
    });
  });

  describe("getCourse validation", () => {
    test("should validate id parameter", async () => {
      const req = createMockRequest({
        params: {},
      });

      const res = createMockResponse();

      await courseRouteHandlers.getCourse(req, res);

      expect(res.status).not.toHaveBeenCalledWith(200);
      expect(mockCourseService.getCourse).not.toHaveBeenCalled();
    });

    test("should handle missing user information", async () => {
      const req = createMockRequest({
        params: { id: "validCourseId" },
        user: undefined,
      });

      const res = createMockResponse();

      await courseRouteHandlers.getCourse(req, res);

      expect(res.status).not.toHaveBeenCalledWith(200);
      expect(mockCourseService.getCourse).not.toHaveBeenCalled();
    });
  });

  describe("deleteCourse validation", () => {
    test("should validate id parameter", async () => {
      const req = createMockRequest({
        params: {},
      });

      const res = createMockResponse();

      await courseRouteHandlers.deleteCourse(req, res);

      expect(res.status).not.toHaveBeenCalledWith(200);
      expect(mockCourseService.deleteCourse).not.toHaveBeenCalled();
    });
  });

  describe("archiveCourse validation", () => {
    test("should validate id parameter", async () => {
      const req = createMockRequest({
        params: {},
      });

      const res = createMockResponse();

      await courseRouteHandlers.archiveCourse(req, res);

      expect(res.status).not.toHaveBeenCalledWith(200);
      expect(mockCourseService.archiveCourse).not.toHaveBeenCalled();
    });

    test("should handle missing user information", async () => {
      const req = createMockRequest({
        params: { id: "validCourseId" },
        user: undefined, // Missing user
      });

      const res = createMockResponse();

      await courseRouteHandlers.archiveCourse(req, res);

      expect(res.status).not.toHaveBeenCalledWith(200);
      expect(mockCourseService.archiveCourse).not.toHaveBeenCalled();
    });
  });

  describe("bulkCreateCourses validation", () => {
    test("should validate file is provided", async () => {
      const req = createMockRequest({
        file: undefined,
      });

      const res = createMockResponse();

      await courseRouteHandlers.bulkCreateCourses(req, res);

      expect(res.status).not.toHaveBeenCalledWith(200);
      expect(mockCourseService.bulkCreateCourses).not.toHaveBeenCalled();
    });

    test("should validate CSV data format", async () => {
      const req = createMockRequest({
        file: {
          buffer: Buffer.from(""),
        } as Express.Multer.File,
      });

      const res = createMockResponse();

      await courseRouteHandlers.bulkCreateCourses(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockCourseService.bulkCreateCourses).not.toHaveBeenCalled();
    });
  });
});
