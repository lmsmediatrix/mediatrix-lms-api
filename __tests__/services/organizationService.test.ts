import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import organizationService from "../../services/organizationService";
import { config } from "../../config/common";
import organizationRepository from "../../repository/organizationRepository";
import cloudinaryService from "../../services/cloudinaryService";
import { IOrganization } from "../../models/organizationModel";
import { Types } from "mongoose";

jest.mock("../../repository/organizationRepository");
jest.mock("../../services/cloudinaryService");

const mockOrganizationRepository = organizationRepository as jest.Mocked<
  typeof organizationRepository
>;
const mockCloudinaryService = cloudinaryService as jest.Mocked<typeof cloudinaryService>;

describe("Organization Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should throw error when getting organization without ID", async () => {
    await expect(organizationService.getOrganization("", {})).rejects.toThrow(
      config.RESPONSE.ERROR.ORGANIZATION.INVALID_PARAMETER.GET
    );
  });

  test("should throw error when getting organizations without params", async () => {
    await expect(organizationService.getOrganizations(null as any)).rejects.toThrow(
      config.RESPONSE.ERROR.ORGANIZATION.INVALID_PARAMETER.GET_ALL
    );
  });

  describe("getOrganization", () => {
    test("should get an organization successfully", async () => {
      const mockOrganization = {
        _id: new Types.ObjectId(),
        name: "Test Organization",
        code: "TESTORG",
        description: "This is a test organization",
        admins: [new Types.ObjectId()],
        students: [new Types.ObjectId()],
        instructors: [new Types.ObjectId()],
        plan: "free",
        status: "active",
      } as unknown as IOrganization;

      mockOrganizationRepository.getOrganization.mockResolvedValue(mockOrganization);

      const result = await organizationService.getOrganization(mockOrganization._id.toString(), {});

      expect(result).toBeDefined();
      expect(result?.name).toBe(mockOrganization.name);
      expect(mockOrganizationRepository.getOrganization).toHaveBeenCalled();
    });
  });

  describe("organizationDashboard", () => {
    test("should get organization dashboard data successfully", async () => {
      const mockOrganization = {
        _id: new Types.ObjectId(),
        name: "Test Organization",
        code: "TESTORG",
        description: "This is a test organization",
        admins: [new Types.ObjectId()],
        students: [new Types.ObjectId()],
        instructors: [new Types.ObjectId()],
        courses: [new Types.ObjectId()],
        plan: "free",
        status: "active",
      } as unknown as IOrganization;

      mockOrganizationRepository.getOrganization.mockResolvedValue(mockOrganization);

      const result = await organizationService.organizationDashboard(
        mockOrganization._id.toString(),
        { populateArray: ["admins", "students", "instructors", "courses"] }
      );

      expect(result).toBeDefined();
      expect(result?.name).toBe(mockOrganization.name);
      expect(mockOrganizationRepository.getOrganization).toHaveBeenCalled();
    });

    test("should throw error when getting dashboard without ID", async () => {
      await expect(organizationService.organizationDashboard("", {})).rejects.toThrow(
        config.RESPONSE.ERROR.ORGANIZATION.INVALID_PARAMETER.GET
      );
    });
  });

  describe("getOrganizations", () => {
    test("should get organizations with pagination successfully", async () => {
      const mockOrganizations = [
        {
          _id: new Types.ObjectId(),
          name: "Organization 1",
          code: "ORG1",
          description: "This is organization 1",
        },
        {
          _id: new Types.ObjectId(),
          name: "Organization 2",
          code: "ORG2",
          description: "This is organization 2",
        },
      ] as unknown as IOrganization[];

      mockOrganizationRepository.getOrganizations.mockResolvedValue(mockOrganizations);
      mockOrganizationRepository.getOrganizationsCount.mockResolvedValue(2);

      const result = await organizationService.getOrganizations({
        limit: 10,
        page: 1,
        document: true,
        pagination: true,
      });

      expect(result).toBeDefined();
      expect(result.organizations.length).toBe(2);
      expect(result.pagination.totalItems).toBe(2);
      expect(mockOrganizationRepository.getOrganizations).toHaveBeenCalled();
      expect(mockOrganizationRepository.getOrganizationsCount).toHaveBeenCalled();
    });
  });

  describe("createOrganization", () => {
    test("should create an organization successfully without files", async () => {
      const mockOrganizationData = {
        name: "New Organization",
        code: "NEWORG",
        description: "This is a new organization",
        admins: [new Types.ObjectId().toString()],
      };

      const mockCreatedOrganization = {
        _id: new Types.ObjectId(),
        ...mockOrganizationData,
        plan: "free",
        status: "active",
      } as unknown as IOrganization;

      mockOrganizationRepository.findOrCreate.mockResolvedValue(null);
      mockOrganizationRepository.createOrganization.mockResolvedValue(mockCreatedOrganization);

      const result = await organizationService.createOrganization(mockOrganizationData);

      expect(result).toBeDefined();
      expect(result.name).toBe(mockOrganizationData.name);
      expect(mockOrganizationRepository.createOrganization).toHaveBeenCalled();
    });

    test("should create an organization with branding when files are provided", async () => {
      const mockOrganizationData = {
        name: "New Organization",
        code: "NEWORG",
        description: "This is a new organization",
        admins: [new Types.ObjectId().toString()],
        path: "assets",
      };

      const files = {
        "branding.logo": [
          {
            filename: "logo.png",
            path: "/tmp/logo.png",
          } as Express.Multer.File,
        ],
        "branding.coverPhoto": [
          {
            filename: "cover.png",
            path: "/tmp/cover.png",
          } as Express.Multer.File,
        ],
      };

      const mockUploadedLogo = "https://example.com/uploaded-logo.png";
      const mockUploadedCover = "https://example.com/uploaded-cover.png";

      mockCloudinaryService.uploadImage
        .mockResolvedValueOnce(mockUploadedLogo)
        .mockResolvedValueOnce(mockUploadedCover);

      const mockCreatedOrganization = {
        _id: new Types.ObjectId(),
        ...mockOrganizationData,
        branding: {
          logo: mockUploadedLogo,
          coverPhoto: mockUploadedCover,
        },
        plan: "free",
        status: "active",
      } as unknown as IOrganization;

      mockOrganizationRepository.findOrCreate.mockResolvedValue(null);
      mockOrganizationRepository.createOrganization.mockResolvedValue(mockCreatedOrganization);

      const result = await organizationService.createOrganization(mockOrganizationData, files);

      expect(result).toBeDefined();
      expect(result.name).toBe(mockOrganizationData.name);
      expect(result.branding?.logo).toBe(mockUploadedLogo);
      expect(result.branding?.coverPhoto).toBe(mockUploadedCover);
      expect(mockCloudinaryService.uploadImage).toHaveBeenCalledTimes(2);
      expect(mockOrganizationRepository.createOrganization).toHaveBeenCalled();
    });

    test("should throw error when creating without data", async () => {
      await expect(organizationService.createOrganization(null as any)).rejects.toThrow(
        config.RESPONSE.ERROR.ORGANIZATION.INVALID_PARAMETER.CREATE
      );
    });

    test("should throw error when organization with same code already exists", async () => {
      const mockOrganizationData = {
        name: "New Organization",
        code: "EXISTINGORG",
        description: "This is a new organization",
      };

      mockOrganizationRepository.findOrCreate.mockResolvedValue({
        _id: new Types.ObjectId(),
        name: "Existing Organization",
        code: "EXISTINGORG",
      } as unknown as IOrganization);

      await expect(organizationService.createOrganization(mockOrganizationData)).rejects.toThrow(
        "Organization with this code already exists"
      );
    });
  });

  describe("updateOrganization", () => {
    test("should update an organization successfully without files", async () => {
      const mockOrganization = {
        _id: new Types.ObjectId(),
        name: "Updated Organization",
        description: "This is an updated organization",
      } as unknown as IOrganization;

      mockOrganizationRepository.updateOrganization.mockResolvedValue(mockOrganization);

      const result = await organizationService.updateOrganization(mockOrganization);

      expect(result).toBeDefined();
      expect(result?.name).toBe(mockOrganization.name);
      expect(mockOrganizationRepository.updateOrganization).toHaveBeenCalled();
    });

    test("should update an organization with branding when files are provided", async () => {
      const organizationId = new Types.ObjectId();
      const mockOrganization = {
        _id: organizationId,
        name: "Updated Organization",
        description: "This is an updated organization",
        code: "UPDORG",
        path: "assets",
        branding: {
          logo: "https://example.com/old-logo.png",
          coverPhoto: "https://example.com/old-cover.png",
        },
      } as unknown as IOrganization;

      const files = {
        "branding.logo": [
          {
            filename: "new-logo.png",
            path: "/tmp/new-logo.png",
          } as Express.Multer.File,
        ],
        "branding.coverPhoto": [
          {
            filename: "new-cover.png",
            path: "/tmp/new-cover.png",
          } as Express.Multer.File,
        ],
      };

      const mockUploadedLogo = "https://example.com/new-uploaded-logo.png";
      const mockUploadedCover = "https://example.com/new-uploaded-cover.png";

      mockOrganizationRepository.getOrganization.mockResolvedValue(mockOrganization);

      mockCloudinaryService.uploadImage
        .mockResolvedValueOnce(mockUploadedLogo)
        .mockResolvedValueOnce(mockUploadedCover);

      const updatedOrganization = {
        ...mockOrganization,
        branding: {
          logo: mockUploadedLogo,
          coverPhoto: mockUploadedCover,
        },
      } as unknown as IOrganization;

      mockOrganizationRepository.updateOrganization.mockResolvedValue(updatedOrganization);

      const result = await organizationService.updateOrganization(mockOrganization, files);

      expect(result).toBeDefined();
      expect(result?.branding?.logo).toBe(mockUploadedLogo);
      expect(result?.branding?.coverPhoto).toBe(mockUploadedCover);
      expect(mockCloudinaryService.uploadImage).toHaveBeenCalledTimes(2);
      expect(mockOrganizationRepository.updateOrganization).toHaveBeenCalled();
    });
  });

  describe("deleteOrganization", () => {
    test("should delete an organization successfully", async () => {
      const mockOrganization = {
        _id: new Types.ObjectId(),
        name: "To be deleted",
        archive: {
          status: true,
          date: new Date(),
        },
      } as unknown as IOrganization;

      // Using archiveOrganization instead of deleteOrganization to match the service implementation
      mockOrganizationRepository.archiveOrganization.mockResolvedValue(mockOrganization);

      const result = await organizationService.deleteOrganization(mockOrganization._id.toString());

      expect(result).toBeDefined();
      expect(result?.archive?.status).toBe(true);
      expect(mockOrganizationRepository.archiveOrganization).toHaveBeenCalled();
    });

    test("should throw error when deleting without ID", async () => {
      await expect(organizationService.deleteOrganization("")).rejects.toThrow(
        config.RESPONSE.ERROR.ORGANIZATION.INVALID_PARAMETER.REMOVE
      );
    });
  });

  describe("searchOrganization", () => {
    test("should search organizations successfully", async () => {
      const mockOrganizations = [
        {
          _id: new Types.ObjectId(),
          name: "Organization 1",
          code: "ORG1",
        },
        {
          _id: new Types.ObjectId(),
          name: "Organization 2",
          code: "ORG2",
        },
      ] as unknown as IOrganization[];

      mockOrganizationRepository.searchOrganization.mockResolvedValue(mockOrganizations);

      const result = await organizationService.searchOrganization({
        query: { name: "Organization" },
      });

      expect(result).toBeDefined();
      expect(result?.length).toBe(2);
      expect(mockOrganizationRepository.searchOrganization).toHaveBeenCalled();
    });
  });
});
