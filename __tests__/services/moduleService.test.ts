import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import moduleService from "../../services/moduleService";
import { config } from "../../config/common";
import moduleRepository from "../../repository/moduleRepository";
import sectionRepository from "../../repository/sectionRepository";
import { IModule } from "../../models/moduleModel";
import { Types } from "mongoose";
import { ISection } from "../../models/sectionModel";

jest.mock("../../repository/moduleRepository");
jest.mock("../../repository/sectionRepository");

const mockModuleRepository = moduleRepository as jest.Mocked<typeof moduleRepository>;
const mockSectionRepository = sectionRepository as jest.Mocked<typeof sectionRepository>;

describe("Module Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should throw error when getting module without ID", async () => {
    await expect(moduleService.getModule("", {})).rejects.toThrow(
      config.RESPONSE.ERROR.MODULE.INVALID_PARAMETER.GET
    );
  });

  test("should throw error when getting modules without params", async () => {
    await expect(moduleService.getModules(null as any)).rejects.toThrow(
      config.RESPONSE.ERROR.MODULE.INVALID_PARAMETER.GET_ALL
    );
  });

  describe("getModule", () => {
    test("should get a module successfully", async () => {
      const mockModule = {
        _id: new Types.ObjectId(),
        title: "Test Module",
        description: "This is a test module",
        organizationId: new Types.ObjectId(),
        lessons: [new Types.ObjectId()],
        isPublished: true,
      } as unknown as IModule;

      mockModuleRepository.getModule.mockResolvedValue(mockModule);

      const result = await moduleService.getModule(mockModule._id.toString(), {});

      expect(result).toBeDefined();
      expect(result?.title).toBe(mockModule.title);
      expect(mockModuleRepository.getModule).toHaveBeenCalled();
    });
  });

  describe("getModules", () => {
    test("should get modules with pagination successfully", async () => {
      const mockModules = [
        {
          _id: new Types.ObjectId(),
          title: "Module 1",
          description: "Description of module 1",
          sectionId: new Types.ObjectId(),
        },
        {
          _id: new Types.ObjectId(),
          title: "Module 2",
          description: "Description of module 2",
          sectionId: new Types.ObjectId(),
        },
      ] as unknown as IModule[];

      mockModuleRepository.getModules.mockResolvedValue(mockModules);
      mockModuleRepository.getModulesCount.mockResolvedValue(2);

      const result = await moduleService.getModules({
        limit: 10,
        page: 1,
        document: true,
        pagination: true,
      });

      expect(result).toBeDefined();
      expect(result.modules.length).toBe(2);
      expect(result.pagination.totalItems).toBe(2);
      expect(mockModuleRepository.getModules).toHaveBeenCalled();
      expect(mockModuleRepository.getModulesCount).toHaveBeenCalled();
    });
  });

  describe("createModule", () => {
    test("should create a module successfully", async () => {
      const mockSection = {
        _id: new Types.ObjectId(),
        code: "SEC101",
        name: "Test Section",
      } as unknown as ISection;

      const mockModuleData = {
        title: "Test Module",
        description: "Test Description",
        sectionCode: "SEC101",
        order: 1,
        content: [],
        status: "draft",
      };

      mockSectionRepository.getSection.mockImplementation(async () => mockSection);
      mockModuleRepository.createModule.mockImplementation(
        async () =>
          ({
            _id: new Types.ObjectId(),
            ...mockModuleData,
          }) as unknown as IModule
      );

      const result = await moduleService.createModule(mockModuleData);

      expect(result).toBeDefined();
      expect(result.newSection.title).toBe(mockModuleData.title);
      expect(mockModuleRepository.createModule).toHaveBeenCalled();
      expect(mockSectionRepository.updateSection).toHaveBeenCalledWith(
        { code: mockSection.code },
        { $push: { modules: expect.any(Types.ObjectId) } }
      );
    });

    test("should throw error when creating without section ID", async () => {
      const mockModuleData = {
        title: "Test Module",
        description: "Test Description",
        order: 1,
        content: [],
        status: "draft",
      };

      await expect(moduleService.createModule(mockModuleData as any)).rejects.toThrow(
        "Section code is required to create a module"
      );
    });
  });

  describe("updateModule", () => {
    test("should update a module successfully", async () => {
      const moduleId = new Types.ObjectId();
      const mockModule = {
        _id: moduleId,
        title: "Updated Module",
        description: "Updated description",
        organizationId: new Types.ObjectId(),
        isPublished: true,
      } as unknown as IModule;

      mockModuleRepository.updateModule.mockResolvedValue(mockModule);

      const result = await moduleService.updateModule(mockModule);

      expect(result).toBeDefined();
      expect(result?.title).toBe(mockModule.title);
      expect(mockModuleRepository.updateModule).toHaveBeenCalled();
    });

    test("should throw error when updating without id", async () => {
      await expect(moduleService.updateModule({} as any)).rejects.toThrow(
        config.RESPONSE.ERROR.MODULE.INVALID_PARAMETER.UPDATE
      );
    });
  });

  describe("deleteModule", () => {
    test("should delete a module successfully", async () => {
      const mockSectionId = new Types.ObjectId();
      const mockModule = {
        _id: new Types.ObjectId(),
        title: "Test Module",
        description: "Test Description",
        organizationId: new Types.ObjectId(),
        lessons: [],
        isPublished: true,
      } as unknown as IModule;

      const mockSection = {
        _id: mockSectionId,
        modules: [mockModule._id],
      } as unknown as ISection;

      mockModuleRepository.getModule.mockResolvedValue(mockModule);
      mockModuleRepository.deleteModule.mockResolvedValue(mockModule);
      mockSectionRepository.searchSection.mockResolvedValue([mockSection]);
      mockSectionRepository.updateSection.mockResolvedValue(mockSection);

      const result = await moduleService.deleteModule(mockModule._id.toString());

      expect(result).toBeDefined();
      expect(mockModuleRepository.deleteModule).toHaveBeenCalled();
      expect(mockSectionRepository.searchSection).toHaveBeenCalledWith({
        query: { modules: mockModule._id.toString() },
        options: { limit: 1 },
      });
      expect(mockSectionRepository.updateSection).toHaveBeenCalledWith(
        { _id: mockSectionId },
        { $pull: { modules: mockModule._id.toString() } }
      );
    });

    test("should throw error when deleting without ID", async () => {
      await expect(moduleService.deleteModule("")).rejects.toThrow(
        config.RESPONSE.ERROR.MODULE.INVALID_PARAMETER.REMOVE
      );
    });
  });

  describe("searchModule", () => {
    test("should search modules successfully", async () => {
      const mockModules = [
        {
          _id: new Types.ObjectId(),
          title: "Module 1",
          description: "Description 1",
          organizationId: new Types.ObjectId(),
          isPublished: true,
          lessons: [],
        },
        {
          _id: new Types.ObjectId(),
          title: "Module 2",
          description: "Description 2",
          organizationId: new Types.ObjectId(),
          isPublished: true,
          lessons: [],
        },
      ] as unknown as IModule[];

      mockModuleRepository.searchModule.mockResolvedValue(mockModules);

      const result = await moduleService.searchModule({
        query: { title: "Module" },
      });

      expect(result).toBeDefined();
      expect(result!.length).toBe(2);
      expect(mockModuleRepository.searchModule).toHaveBeenCalled();
    });

    test("should search modules with pagination successfully", async () => {
      const mockModules = [
        {
          _id: new Types.ObjectId(),
          title: "Test Module 1",
        },
        {
          _id: new Types.ObjectId(),
          title: "Test Module 2",
        },
      ] as unknown as IModule[];

      mockModuleRepository.searchModule.mockResolvedValue(mockModules);

      const result = await moduleService.searchModule({
        query: { title: "Test" },
        limit: 10,
        page: 1,
      });

      expect(result).toBeDefined();
      expect(result!.length).toBe(2);
      expect(mockModuleRepository.searchModule).toHaveBeenCalled();
    });
  });
});
