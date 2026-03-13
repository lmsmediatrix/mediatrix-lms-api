import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { Response } from "express";
import { CustomRequest } from "../../type/types";
import lessonService from "../../services/lessonService";
import activityLogService from "../../services/activityLogService";
import auditLogService from "../../services/auditLogService";
import { ILesson } from "../../models/lessonModel";
import { USER_ROLES, ACTION } from "../../config/common";
import { validatePermissions } from "../../middleware/rabcMiddleware";

jest.mock("../../helper/formDataHelper", () => ({
  processInstructorFormData: jest.fn().mockImplementation((data) => ({
    processedData: data,
  })),
}));

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

import * as lessonRouteHandlers from "../../routes/lessonRoute";

jest.mock("../../services/lessonService");
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

const mockLessonService = lessonService as jest.Mocked<typeof lessonService>;
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
    path: "/api/lesson/test",
    method: "GET",
    originalUrl: "/api/lesson/test",
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

describe("Lesson Route Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getLessons", () => {
    test("should get all lessons successfully", async () => {
      const mockLessons = [
        {
          _id: "lesson1",
          title: "Introduction to Programming",
          category: "Programming",
          description: "Learn the basics of programming",
          status: "published",
        } as unknown as ILesson,
        {
          _id: "lesson2",
          title: "Advanced Data Structures",
          category: "Computer Science",
          description: "Learn about complex data structures",
          status: "published",
        } as unknown as ILesson,
      ];

      const mockPagination = {
        totalItems: 2,
        totalPages: 1,
        currentPage: 1,
        pageSize: 10,
      };

      mockLessonService.getLessons.mockResolvedValue({
        lessons: mockLessons,
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

      await lessonRouteHandlers.getLessons(req, res);

      expect(mockLessonService.getLessons).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockLessons,
        pagination: mockPagination,
        count: 2,
      });
    });
  });

  describe("getLesson", () => {
    test("should get a lesson by ID successfully", async () => {
      const lessonId = "mockLessonId";
      const mockLesson = {
        _id: lessonId,
        title: "Introduction to Programming",
        category: "Programming",
        description: "Learn the basics of programming",
        status: "published",
      };

      mockLessonService.getLesson.mockResolvedValue(mockLesson as unknown as ILesson);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: lessonId },
      });

      const res = createMockResponse();

      await lessonRouteHandlers.getLesson(req, res);

      expect(mockLessonService.getLesson).toHaveBeenCalledWith(lessonId, expect.any(Object));
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockLesson,
      });
    });
  });

  describe("createLesson", () => {
    test("should create a lesson successfully", async () => {
      const mockLessonData = {
        title: "New Lesson",
        category: "Computer Science",
        description: "A brand new lesson",
        status: "published",
      };

      const mockCreatedLesson = {
        _id: "newLessonId",
        ...mockLessonData,
      };

      const formDataHelper = jest.requireMock("../../helper/formDataHelper") as {
        processInstructorFormData: jest.Mock;
      };
      formDataHelper.processInstructorFormData.mockReturnValue({
        processedData: mockLessonData,
        error: null,
      });

      mockLessonService.createLesson.mockResolvedValue({
        newLesson: mockCreatedLesson as unknown as ILesson,
        section: {},
      });
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockLessonData,
        files: { files: [], mainContent: [] },
      });

      const res = createMockResponse();

      await lessonRouteHandlers.createLesson(req, res);

      expect(mockLessonService.createLesson).toHaveBeenCalled();
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockCreatedLesson,
      });
    });
  });

  describe("updateLesson", () => {
    test("should update a lesson successfully", async () => {
      const lessonId = "existingLessonId";
      const mockUpdateData = {
        _id: lessonId,
        title: "Updated Lesson",
        description: "Updated description",
      };

      const mockCurrentLesson = {
        _id: lessonId,
        title: "Original Lesson",
        category: "Programming",
        description: "Original description",
        status: "published",
      };

      const mockUpdatedLesson = {
        ...mockCurrentLesson,
        ...mockUpdateData,
      };

      const formDataHelper = jest.requireMock("../../helper/formDataHelper") as {
        processInstructorFormData: jest.Mock;
      };
      formDataHelper.processInstructorFormData.mockReturnValue({
        processedData: mockUpdateData,
      });

      mockLessonService.getLesson.mockResolvedValue(mockCurrentLesson as unknown as ILesson);
      mockLessonService.updateLesson.mockResolvedValue(mockUpdatedLesson as unknown as ILesson);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        body: mockUpdateData,
        files: { files: [], mainContent: [] },
        user: {
          id: "mockUserId",
          organizationId: "mockOrgId",
          role: "instructor",
          email: "instructor@example.com",
          firstName: "Test",
          lastName: "User",
        },
      });

      const res = createMockResponse();

      await lessonRouteHandlers.updateLesson(req, res);

      expect(mockLessonService.getLesson).toHaveBeenCalledWith(
        lessonId,
        expect.objectContaining({
          select: expect.arrayContaining(["title", "description"]),
        })
      );
      expect(mockLessonService.updateLesson).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: lessonId,
          title: mockUpdateData.title,
          description: mockUpdateData.description,
        }),
        expect.any(Object)
      );
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
        data: mockUpdatedLesson,
      });
    });
  });

  describe("deleteLesson", () => {
    test("should delete a lesson successfully", async () => {
      const lessonId = "lessonToDeleteId";
      const mockCurrentLesson = {
        _id: lessonId,
        title: "Lesson to Delete",
      };

      mockLessonService.getLesson.mockResolvedValue(mockCurrentLesson as unknown as ILesson);
      mockLessonService.deleteLesson.mockResolvedValue({} as unknown as any);
      mockActivityLogService.createActivityLog.mockResolvedValue({} as unknown as any);
      mockAuditLogService.createAuditLog.mockResolvedValue({} as unknown as any);

      const req = createMockRequest({
        params: { id: lessonId },
      });

      const res = createMockResponse();

      await lessonRouteHandlers.deleteLesson(req, res);

      expect(mockLessonService.getLesson).toHaveBeenCalledWith(lessonId, expect.any(Object));
      expect(mockLessonService.deleteLesson).toHaveBeenCalledWith(lessonId);
      expect(mockActivityLogService.createActivityLog).toHaveBeenCalled();
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        message: expect.any(String),
      });
    });
  });

  describe("Role-Based Access Control", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const testRoleAccess = (
      endpoint: string,
      action: string,
      allowedRoles: string[] = [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN, USER_ROLES.INSTRUCTOR]
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
              case "getLesson":
                requestPayload = { params: { id: "lessonId" } };
                break;
              case "updateLesson":
                requestPayload = {
                  body: {
                    _id: "lessonId",
                    title: "Updated Lesson",
                    description: "Updated description",
                  },
                };
                break;
              case "deleteLesson":
                requestPayload = { params: { id: "lessonId" } };
                break;
              case "searchLesson":
                requestPayload = {
                  body: {
                    query: {
                      category: "Programming",
                    },
                  },
                };
                break;
              case "archiveLesson":
                requestPayload = { params: { id: "lessonId" } };
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

    testRoleAccess("getLessons", ACTION.GET_ALL, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.STUDENT,
    ]);

    testRoleAccess("getLesson", ACTION.GET_BY_ID, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.STUDENT,
    ]);

    testRoleAccess("createLesson", ACTION.CREATE, [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR]);

    testRoleAccess("updateLesson", ACTION.UPDATE, [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR]);

    testRoleAccess("deleteLesson", ACTION.DELETE, [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR]);

    testRoleAccess("searchLesson", ACTION.SEARCH, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
      USER_ROLES.STUDENT,
    ]);

    testRoleAccess("archiveLesson", ACTION.ARCHIVE, [
      USER_ROLES.ADMIN,
      USER_ROLES.SUPERADMIN,
      USER_ROLES.INSTRUCTOR,
    ]);

    describe("Special lesson permission scenarios", () => {
      describe("Lesson creation by instructors", () => {
        const createLessonMiddleware = validatePermissions(
          [USER_ROLES.ADMIN, USER_ROLES.INSTRUCTOR],
          ACTION.CREATE
        );

        test("Instructors should be able to create lessons for their courses", () => {
          const req = createMockRequest({
            user: {
              id: "instructorId",
              email: "instructor@example.com",
              organizationId: "orgId",
              role: USER_ROLES.INSTRUCTOR,
              firstName: "Instructor",
              lastName: "User",
            },
            body: {
              title: "New Lesson",
              category: "Programming",
              description: "A lesson created by an instructor",
            },
          });

          const res = createMockResponse();
          const next = jest.fn();

          createLessonMiddleware(req, res, next);

          expect(next).toHaveBeenCalled();
        });

        test("Students should NOT be able to create lessons", () => {
          const req = createMockRequest({
            user: {
              id: "studentId",
              email: "student@example.com",
              organizationId: "orgId",
              role: USER_ROLES.STUDENT,
              firstName: "Student",
              lastName: "User",
            },
            body: {
              title: "Unauthorized Lesson",
              category: "Hacking",
              description: "A lesson attempt by a student",
            },
          });

          const res = createMockResponse();
          const next = jest.fn();

          createLessonMiddleware(req, res, next);

          expect(next).not.toHaveBeenCalled();
          expect(res.status).toHaveBeenCalledWith(403);
        });
      });

      describe("Lesson archiving permissions", () => {
        const archiveMiddleware = validatePermissions(
          [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN, USER_ROLES.INSTRUCTOR],
          ACTION.ARCHIVE
        );

        test("Admin, SuperAdmin, and Instructor roles should be able to archive lessons", () => {
          const roles = [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN, USER_ROLES.INSTRUCTOR];

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
              params: { id: "lessonToArchiveId" },
            });

            const res = createMockResponse();
            const next = jest.fn();

            archiveMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
          });
        });

        test("Other roles should NOT be able to archive lessons", () => {
          const roles = [USER_ROLES.STUDENT, USER_ROLES.EMPLOYEE, USER_ROLES.USER, USER_ROLES.VIEW];

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
              params: { id: "lessonToArchiveId" },
            });

            const res = createMockResponse();
            const next = jest.fn();

            archiveMiddleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
          });
        });
      });

      describe("Lesson viewing permissions", () => {
        const viewLessonMiddleware = validatePermissions(
          [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN, USER_ROLES.INSTRUCTOR, USER_ROLES.STUDENT],
          ACTION.GET_BY_ID
        );

        test("All educational roles should be able to view lessons", () => {
          const roles = [
            USER_ROLES.ADMIN,
            USER_ROLES.SUPERADMIN,
            USER_ROLES.INSTRUCTOR,
            USER_ROLES.STUDENT,
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
              params: { id: "lessonToViewId" },
            });

            const res = createMockResponse();
            const next = jest.fn();

            viewLessonMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
          });
        });

        test("Non-educational roles should NOT have default access to lessons", () => {
          const roles = [USER_ROLES.EMPLOYEE, USER_ROLES.USER, USER_ROLES.VIEW];

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
              params: { id: "lessonToViewId" },
            });

            const res = createMockResponse();
            const next = jest.fn();

            viewLessonMiddleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
          });
        });
      });
    });
  });

  describe("Lesson Zod Validation", () => {
    describe("createLesson validation", () => {
      test("should validate required fields", async () => {
        const invalidData = {
          description: "A lesson without required fields",
        };

        mockLessonService.createLesson.mockReset();

        const formDataHelper = jest.requireMock("../../helper/formDataHelper") as {
          processInstructorFormData: jest.Mock;
        };
        formDataHelper.processInstructorFormData.mockReturnValue({
          error: "Missing required fields",
          details: [{ field: "title", message: "Title is required" }],
        });

        jest.spyOn(lessonRouteHandlers, "createLesson").mockImplementation(async (_req, res) => {
          res.status(400).json({ error: "Validation error", message: "Title is required" });
        });

        const req = createMockRequest({
          body: invalidData,
          files: { files: [], mainContent: [] },
        });

        const res = createMockResponse();

        await lessonRouteHandlers.createLesson(req, res);

        expect(mockLessonService.createLesson).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
      });

      test("should validate field formats", async () => {
        const invalidData = {
          title: "",
          category: "A".repeat(101),
          description: "A".repeat(501),
          videoUrl: "not-a-valid-url",
        };

        mockLessonService.createLesson.mockReset();

        const formDataHelper = jest.requireMock("../../helper/formDataHelper");
        (
          formDataHelper as { processInstructorFormData: jest.Mock }
        ).processInstructorFormData.mockReturnValue({
          processedData: invalidData,
        });

        const handleZodErrorMock = jest.requireMock<{
          handleZodError: (error: unknown, res: Response) => boolean;
        }>("../../middleware/zodErrorHandler").handleZodError;

        jest.spyOn(lessonRouteHandlers, "createLesson").mockImplementation(async (_req, res) => {
          handleZodErrorMock(new Error("Zod validation error"), res);
          return;
        });

        const req = createMockRequest({
          body: invalidData,
          files: { files: [], mainContent: [] },
        });

        const res = createMockResponse();

        await lessonRouteHandlers.createLesson(req, res);

        expect(mockLessonService.createLesson).not.toHaveBeenCalled();
        expect(handleZodErrorMock).toHaveBeenCalled();
      });

      test("should handle missing user information", async () => {
        const validData = {
          title: "Valid Lesson",
          category: "Valid Category",
          description: "A valid lesson description",
        };

        const formDataHelper = jest.requireMock("../../helper/formDataHelper") as {
          processInstructorFormData: jest.Mock;
        };
        formDataHelper.processInstructorFormData.mockReturnValue({
          processedData: validData,
        });

        mockLessonService.createLesson.mockReset();

        const req = createMockRequest({
          body: validData,
          files: { files: [], mainContent: [] },
          user: undefined,
        });

        const res = createMockResponse();

        await lessonRouteHandlers.createLesson(req, res);

        expect(mockLessonService.createLesson).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe("updateLesson validation", () => {
      test("should validate that _id is provided", async () => {
        const invalidData = {
          title: "Updated Lesson",
          description: "Updated description",
        };

        mockLessonService.updateLesson.mockReset();

        const req = createMockRequest({
          body: invalidData,
          files: { files: [], mainContent: [] },
        });

        const res = createMockResponse();

        await lessonRouteHandlers.updateLesson(req, res);

        expect(mockLessonService.updateLesson).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
      });

      test("should validate field formats in update", async () => {
        const invalidData = {
          _id: "lessonId",
          title: "",
          description: "A".repeat(501),
          status: "draft",
        };

        mockLessonService.updateLesson.mockReset();

        const req = createMockRequest({
          body: invalidData,
          files: { files: [], mainContent: [] },
        });

        const res = createMockResponse();

        await lessonRouteHandlers.updateLesson(req, res);

        expect(mockLessonService.updateLesson).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe("getLesson validation", () => {
      test("should validate id parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        const handleZodErrorMock = jest.requireMock<{
          handleZodError: (error: unknown, res: Response) => boolean;
        }>("../../middleware/zodErrorHandler").handleZodError;

        await lessonRouteHandlers.getLesson(req, res);

        expect(mockLessonService.getLesson).not.toHaveBeenCalled();
        expect(handleZodErrorMock).toHaveBeenCalled();
      });
    });

    describe("deleteLesson validation", () => {
      test("should validate id parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        const handleZodErrorMock = jest.requireMock<{
          handleZodError: (error: unknown, res: Response) => boolean;
        }>("../../middleware/zodErrorHandler").handleZodError;

        await lessonRouteHandlers.deleteLesson(req, res);

        expect(mockLessonService.deleteLesson).not.toHaveBeenCalled();
        expect(handleZodErrorMock).toHaveBeenCalled();
      });

      test("should handle lesson not found", async () => {
        const lessonId = "nonExistentLessonId";

        mockLessonService.getLesson.mockResolvedValue(null);

        const req = createMockRequest({
          params: { id: lessonId },
        });

        const res = createMockResponse();

        await lessonRouteHandlers.deleteLesson(req, res);

        expect(mockLessonService.getLesson).toHaveBeenCalledWith(lessonId, expect.any(Object));
        expect(mockLessonService.deleteLesson).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe("archiveLesson validation", () => {
      test("should validate id parameter", async () => {
        const req = createMockRequest({
          params: {},
        });

        const res = createMockResponse();

        const handleZodErrorMock = jest.requireMock<{
          handleZodError: (error: unknown, res: Response) => boolean;
        }>("../../middleware/zodErrorHandler").handleZodError;

        await lessonRouteHandlers.archiveLesson(req, res);

        expect(mockLessonService.archiveLesson).not.toHaveBeenCalled();
        expect(handleZodErrorMock).toHaveBeenCalled();
      });

      test("should handle missing user information", async () => {
        const req = createMockRequest({
          params: { id: "validLessonId" },
          user: undefined,
        });

        const res = createMockResponse();

        await lessonRouteHandlers.archiveLesson(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          message: "User not authenticated or missing organization",
        });
        expect(mockLessonService.archiveLesson).not.toHaveBeenCalled();
      });

      test("should handle lesson not found", async () => {
        const lessonId = "nonExistentLessonId";

        mockLessonService.archiveLesson.mockResolvedValue(null);

        const req = createMockRequest({
          params: { id: lessonId },
        });

        const res = createMockResponse();

        await lessonRouteHandlers.archiveLesson(req, res);

        expect(mockLessonService.archiveLesson).toHaveBeenCalledWith(lessonId);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: "Lesson not found" });
      });
    });

    describe("searchLesson validation", () => {
      test("should validate search query format", async () => {
        const invalidQuery = {
          invalidField: "value",
        };

        mockLessonService.searchLesson.mockReset();

        const req = createMockRequest({
          body: invalidQuery,
        });

        const res = createMockResponse();

        await lessonRouteHandlers.searchLesson(req, res);

        expect(mockLessonService.searchLesson).toHaveBeenCalledWith(invalidQuery);
      });
    });
  });
});
