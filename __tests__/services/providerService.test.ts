import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import providerService from "../../services/providerService";
import providerRepository from "../../repository/providerRepository";
import { IProvider } from "../../models/providerModel";
import { Types } from "mongoose";

jest.mock("../../repository/providerRepository");

const mockProviderRepository = providerRepository as jest.Mocked<typeof providerRepository>;

describe("Provider Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should throw error when getting provider without ID", async () => {
    await expect(providerService.getProvider("", {})).rejects.toThrow("Provider ID is required");
  });

  test("should throw error when getting providers without params", async () => {
    await expect(providerService.getProviders(null as any)).rejects.toThrow(
      "Invalid parameters for retrieving providers"
    );
  });

  describe("getProvider", () => {
    test("should get a provider successfully", async () => {
      const mockProvider = {
        _id: new Types.ObjectId(),
        name: "Test Provider",
        description: "This is a test provider",
        contactEmail: "provider@test.com",
        contactPhone: "1234567890",
        website: "https://testprovider.com",
        organizationId: new Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        archive: { status: false, date: null },
      } as unknown as IProvider;

      mockProviderRepository.getProvider.mockResolvedValue(mockProvider);

      const result = await providerService.getProvider(mockProvider._id.toString(), {});

      expect(result).toBeDefined();
      expect(result?.name).toBe(mockProvider.name);
      expect(mockProviderRepository.getProvider).toHaveBeenCalled();
    });
  });

  describe("getProviders", () => {
    test("should get providers successfully", async () => {
      const mockProviders = [
        {
          _id: new Types.ObjectId(),
          name: "Provider 1",
          description: "Description 1",
          contactEmail: "provider1@test.com",
          contactPhone: "1234567890",
          website: "https://provider1.com",
          organizationId: new Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date(),
          archive: { status: false, date: null },
        },
        {
          _id: new Types.ObjectId(),
          name: "Provider 2",
          description: "Description 2",
          contactEmail: "provider2@test.com",
          contactPhone: "0987654321",
          website: "https://provider2.com",
          organizationId: new Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date(),
          archive: { status: false, date: null },
        },
      ] as unknown as IProvider[];

      mockProviderRepository.getProviders.mockResolvedValue(mockProviders);
      mockProviderRepository.countProviders.mockResolvedValue(2);

      const result = await providerService.getProviders({
        limit: 10,
        page: 1,
        document: true,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result.providers)).toBe(true);
      expect(result.providers.length).toBe(2);
      expect(mockProviderRepository.getProviders).toHaveBeenCalled();
    });

    test("should handle pagination", async () => {
      const mockProviders = [
        {
          _id: new Types.ObjectId(),
          name: "Provider 1",
          description: "Description 1",
          contactEmail: "provider1@test.com",
          contactPhone: "1234567890",
          website: "https://provider1.com",
          organizationId: new Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date(),
          archive: { status: false, date: null },
        },
        {
          _id: new Types.ObjectId(),
          name: "Provider 2",
          description: "Description 2",
          contactEmail: "provider2@test.com",
          contactPhone: "0987654321",
          website: "https://provider2.com",
          organizationId: new Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date(),
          archive: { status: false, date: null },
        },
      ] as unknown as IProvider[];

      mockProviderRepository.getProviders.mockResolvedValue(mockProviders);
      mockProviderRepository.countProviders.mockResolvedValue(2);

      const result = await providerService.getProviders({
        limit: 10,
        page: 1,
        document: true,
        pagination: true,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result.providers)).toBe(true);
      expect(result.providers.length).toBe(2);
      expect(result.pagination).toBeDefined();
      expect(mockProviderRepository.getProviders).toHaveBeenCalled();
      expect(mockProviderRepository.countProviders).toHaveBeenCalled();
    });
  });

  describe("createProvider", () => {
    test("should create a provider successfully", async () => {
      const mockProviderData = {
        name: "New Provider",
        description: "New provider description",
        contactEmail: "newprovider@test.com",
        contactPhone: "1234567890",
        website: "https://newprovider.com",
        organizationId: new Types.ObjectId(),
      };

      const mockCreatedProvider = {
        _id: new Types.ObjectId(),
        ...mockProviderData,
        createdAt: new Date(),
        updatedAt: new Date(),
        archive: { status: false, date: null },
      } as unknown as IProvider;

      mockProviderRepository.searchProvider.mockResolvedValue([]);
      mockProviderRepository.createProvider.mockResolvedValue(mockCreatedProvider);

      const result = await providerService.createProvider(mockProviderData as Partial<IProvider>);

      expect(result).toBeDefined();
      expect(result.name).toBe(mockProviderData.name);
      expect(mockProviderRepository.createProvider).toHaveBeenCalled();
    });

    test("should throw error when creating provider with existing code", async () => {
      const mockProviderData = {
        name: "New Provider",
        code: "EXISTING_CODE",
        organizationId: new Types.ObjectId(),
      };

      const existingProvider = {
        _id: new Types.ObjectId(),
        name: "Existing Provider",
        code: "EXISTING_CODE",
        organizationId: mockProviderData.organizationId,
      } as unknown as IProvider;

      mockProviderRepository.searchProvider.mockResolvedValue([existingProvider]);

      await expect(
        providerService.createProvider(mockProviderData as Partial<IProvider>)
      ).rejects.toThrow("Provider code already exists");
    });

    test("should throw error when creating without data", async () => {
      await expect(providerService.createProvider(null as any)).rejects.toThrow(
        "Provider data is required"
      );
    });
  });

  describe("updateProvider", () => {
    test("should update a provider successfully", async () => {
      const providerId = new Types.ObjectId();
      const organizationId = new Types.ObjectId();

      const mockCurrentProvider = {
        _id: providerId,
        name: "Original Provider",
        organizationId,
      } as unknown as IProvider;

      const mockUpdatedProvider = {
        _id: providerId,
        name: "Updated Provider",
        description: "Updated description",
        contactEmail: "updated@test.com",
        organizationId,
      } as unknown as IProvider;

      mockProviderRepository.getProvider.mockResolvedValue(mockCurrentProvider);
      mockProviderRepository.updateProvider.mockResolvedValue(mockUpdatedProvider);

      const result = await providerService.updateProvider({
        _id: providerId,
        name: "Updated Provider",
        description: "Updated description",
        contactEmail: "updated@test.com",
        organizationId,
      } as Partial<IProvider>);

      expect(result).toBeDefined();
      expect(result?.name).toBe("Updated Provider");
      expect(mockProviderRepository.updateProvider).toHaveBeenCalled();
    });

    test("should throw error when updating without ID", async () => {
      await expect(providerService.updateProvider({} as any)).rejects.toThrow(
        "Provider ID is required"
      );
    });

    test("should throw error when provider not found", async () => {
      const providerId = new Types.ObjectId();
      const organizationId = new Types.ObjectId();

      mockProviderRepository.getProvider.mockResolvedValue(null);

      await expect(
        providerService.updateProvider({
          _id: providerId,
          name: "Updated Provider",
          organizationId,
        } as Partial<IProvider>)
      ).rejects.toThrow("Provider not found");
    });
  });

  describe("deleteProvider", () => {
    test("should delete a provider successfully", async () => {
      const providerId = new Types.ObjectId();

      const mockProvider = {
        _id: providerId,
        name: "Provider to Delete",
        archive: { status: false, date: null },
      } as unknown as IProvider;

      const mockDeletedProvider = {
        ...mockProvider,
        archive: { status: true, date: new Date() },
      } as unknown as IProvider;

      mockProviderRepository.getProvider.mockResolvedValue(mockProvider);
      mockProviderRepository.deleteProvider.mockResolvedValue(mockDeletedProvider);

      const result = await providerService.deleteProvider(providerId.toString());

      expect(result).toBeDefined();
      expect(result?.archive?.status).toBe(true);
      expect(mockProviderRepository.deleteProvider).toHaveBeenCalled();
    });

    test("should throw error when deleting without ID", async () => {
      await expect(providerService.deleteProvider("")).rejects.toThrow("Provider ID is required");
    });

    test("should throw error when provider not found", async () => {
      mockProviderRepository.getProvider.mockResolvedValue(null);

      await expect(providerService.deleteProvider(new Types.ObjectId().toString())).rejects.toThrow(
        "Provider not found"
      );
    });
  });

  describe("searchProvider", () => {
    test("should search providers successfully", async () => {
      const mockProviders = [
        {
          _id: new Types.ObjectId(),
          name: "Provider ABC",
          description: "Description ABC",
          contactEmail: "abc@test.com",
          organizationId: new Types.ObjectId(),
        },
        {
          _id: new Types.ObjectId(),
          name: "Provider XYZ",
          description: "Description XYZ",
          contactEmail: "xyz@test.com",
          organizationId: new Types.ObjectId(),
        },
      ] as unknown as IProvider[];

      mockProviderRepository.searchProvider.mockResolvedValue(mockProviders);

      const result = await providerService.searchProvider({
        query: { name: { $regex: "Provider", $options: "i" } },
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(mockProviderRepository.searchProvider).toHaveBeenCalled();
    });

    test("should handle pagination in search results", async () => {
      const mockProviders = [
        {
          _id: new Types.ObjectId(),
          name: "Provider ABC",
          description: "Description ABC",
          contactEmail: "abc@test.com",
          organizationId: new Types.ObjectId(),
        },
        {
          _id: new Types.ObjectId(),
          name: "Provider XYZ",
          description: "Description XYZ",
          contactEmail: "xyz@test.com",
          organizationId: new Types.ObjectId(),
        },
      ] as unknown as IProvider[];

      mockProviderRepository.searchProvider.mockResolvedValue(mockProviders);
      mockProviderRepository.countProviders.mockResolvedValue(2);

      const result = await providerService.searchProvider({
        query: { name: { $regex: "Provider", $options: "i" } },
        pagination: true,
        document: true,
        count: true,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result.providers)).toBe(true);
      expect(result.providers.length).toBe(2);
      expect(result.pagination).toBeDefined();
      expect(result.count).toBe(2);
      expect(mockProviderRepository.searchProvider).toHaveBeenCalled();
      expect(mockProviderRepository.countProviders).toHaveBeenCalled();
    });
  });
});
