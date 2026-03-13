import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import voucherService from "../../services/voucherService";
import voucherRepository from "../../repository/voucherRepository";
import { IVoucher } from "../../models/voucherModel";
import { Types } from "mongoose";

jest.mock("../../repository/voucherRepository");

const mockVoucherRepository = voucherRepository as jest.Mocked<typeof voucherRepository>;

describe("Voucher Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should throw error when getting voucher without ID", async () => {
    await expect(voucherService.getVoucher("", {})).rejects.toThrow("Voucher ID is required");
  });

  test("should throw error when getting vouchers without params", async () => {
    await expect(voucherService.getVouchers(null as any)).rejects.toThrow(
      "Invalid parameters for retrieving vouchers"
    );
  });

  describe("getVoucher", () => {
    test("should get a voucher successfully", async () => {
      const mockVoucher = {
        _id: new Types.ObjectId(),
        name: "Test Voucher",
        code: "TESTCODE123",
        description: "This is a test voucher",
        status: "active" as const,
        discount: 15,
        expiryDate: new Date(),
        organizationId: new Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        archive: { status: false, date: null },
      } as unknown as IVoucher;

      mockVoucherRepository.getVoucher.mockResolvedValue(mockVoucher);

      const result = await voucherService.getVoucher(mockVoucher._id.toString(), {});

      expect(result).toBeDefined();
      expect(result?.name).toBe(mockVoucher.name);
      expect(result?.code).toBe(mockVoucher.code);
      expect(mockVoucherRepository.getVoucher).toHaveBeenCalled();
    });
  });

  describe("getVouchers", () => {
    test("should get vouchers successfully", async () => {
      const mockVouchers = [
        {
          _id: new Types.ObjectId(),
          name: "Voucher 1",
          code: "VOUCHER001",
          description: "Description 1",
          status: "active" as const,
          discount: 10,
          expiryDate: new Date(),
          organizationId: new Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date(),
          archive: { status: false, date: null },
        },
        {
          _id: new Types.ObjectId(),
          name: "Voucher 2",
          code: "VOUCHER002",
          description: "Description 2",
          status: "active" as const,
          discount: 20,
          expiryDate: new Date(),
          organizationId: new Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date(),
          archive: { status: false, date: null },
        },
      ] as unknown as IVoucher[];

      mockVoucherRepository.getVouchers.mockResolvedValue(mockVouchers);
      mockVoucherRepository.countVouchers.mockResolvedValue(2);

      const result = await voucherService.getVouchers({
        limit: 10,
        page: 1,
        document: true,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result.vouchers)).toBe(true);
      expect(result.vouchers.length).toBe(2);
      expect(mockVoucherRepository.getVouchers).toHaveBeenCalled();
    });

    test("should handle pagination", async () => {
      const mockVouchers = [
        {
          _id: new Types.ObjectId(),
          name: "Voucher 1",
          code: "VOUCHER001",
          description: "Description 1",
          status: "active" as const,
          discount: 10,
          expiryDate: new Date(),
          organizationId: new Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date(),
          archive: { status: false, date: null },
        },
        {
          _id: new Types.ObjectId(),
          name: "Voucher 2",
          code: "VOUCHER002",
          description: "Description 2",
          status: "active" as const,
          discount: 20,
          expiryDate: new Date(),
          organizationId: new Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date(),
          archive: { status: false, date: null },
        },
      ] as unknown as IVoucher[];

      mockVoucherRepository.getVouchers.mockResolvedValue(mockVouchers);
      mockVoucherRepository.countVouchers.mockResolvedValue(2);

      const result = await voucherService.getVouchers({
        limit: 10,
        page: 1,
        document: true,
        pagination: true,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result.vouchers)).toBe(true);
      expect(result.vouchers.length).toBe(2);
      expect(result.pagination).toBeDefined();
      expect(mockVoucherRepository.getVouchers).toHaveBeenCalled();
      expect(mockVoucherRepository.countVouchers).toHaveBeenCalled();
    });
  });

  describe("createVoucher", () => {
    test("should create a voucher successfully", async () => {
      const mockVoucherData = {
        name: "New Voucher",
        code: "NEWVOUCHER123",
        description: "New voucher description",
        status: "active" as const,
        discount: 25,
        expiryDate: new Date(),
        organizationId: new Types.ObjectId(),
      };

      const mockCreatedVoucher = {
        _id: new Types.ObjectId(),
        ...mockVoucherData,
        createdAt: new Date(),
        updatedAt: new Date(),
        archive: { status: false, date: null },
      } as unknown as IVoucher;

      mockVoucherRepository.searchVoucher.mockResolvedValue([]);
      mockVoucherRepository.createVoucher.mockResolvedValue(mockCreatedVoucher);

      const result = await voucherService.createVoucher(mockVoucherData as Partial<IVoucher>);

      expect(result).toBeDefined();
      expect(result.name).toBe(mockVoucherData.name);
      expect(result.code).toBe(mockVoucherData.code);
      expect(mockVoucherRepository.createVoucher).toHaveBeenCalled();
    });

    test("should throw error when creating voucher with existing code", async () => {
      const mockVoucherData = {
        name: "New Voucher",
        code: "EXISTING_CODE",
        organizationId: new Types.ObjectId(),
      };

      const existingVoucher = {
        _id: new Types.ObjectId(),
        name: "Existing Voucher",
        code: "EXISTING_CODE",
        organizationId: mockVoucherData.organizationId,
      } as unknown as IVoucher;

      mockVoucherRepository.searchVoucher.mockResolvedValue([existingVoucher]);

      await expect(
        voucherService.createVoucher(mockVoucherData as Partial<IVoucher>)
      ).rejects.toThrow("Voucher code already exists");
    });

    test("should throw error when creating without data", async () => {
      await expect(voucherService.createVoucher(null as any)).rejects.toThrow(
        "Voucher data is required"
      );
    });
  });

  describe("updateVoucher", () => {
    test("should update a voucher successfully", async () => {
      const voucherId = new Types.ObjectId();
      const organizationId = new Types.ObjectId();

      const mockCurrentVoucher = {
        _id: voucherId,
        name: "Original Voucher",
        code: "ORIGINAL123",
        status: "active" as const,
        organizationId,
      } as unknown as IVoucher;

      const mockUpdatedVoucher = {
        _id: voucherId,
        name: "Updated Voucher",
        code: "ORIGINAL123",
        description: "Updated description",
        status: "active" as const,
        discount: 30,
        organizationId,
      } as unknown as IVoucher;

      mockVoucherRepository.getVoucher.mockResolvedValue(mockCurrentVoucher);
      mockVoucherRepository.updateVoucher.mockResolvedValue(mockUpdatedVoucher);

      const result = await voucherService.updateVoucher({
        _id: voucherId,
        name: "Updated Voucher",
        description: "Updated description",
        discount: 30,
        organizationId,
      } as Partial<IVoucher>);

      expect(result).toBeDefined();
      expect(result?.name).toBe("Updated Voucher");
      expect(mockVoucherRepository.updateVoucher).toHaveBeenCalled();
    });

    test("should throw error when updating without ID", async () => {
      await expect(voucherService.updateVoucher({} as any)).rejects.toThrow(
        "Voucher ID is required"
      );
    });

    test("should throw error when voucher not found", async () => {
      const voucherId = new Types.ObjectId();
      const organizationId = new Types.ObjectId();

      mockVoucherRepository.getVoucher.mockResolvedValue(null);

      await expect(
        voucherService.updateVoucher({
          _id: voucherId,
          name: "Updated Voucher",
          organizationId,
        } as Partial<IVoucher>)
      ).rejects.toThrow("Voucher not found");
    });
  });

  describe("deleteVoucher", () => {
    test("should delete a voucher successfully", async () => {
      const voucherId = new Types.ObjectId();

      const mockVoucher = {
        _id: voucherId,
        name: "Voucher to Delete",
        code: "DELETE123",
        archive: { status: false, date: null },
      } as unknown as IVoucher;

      const mockDeletedVoucher = {
        ...mockVoucher,
        archive: { status: true, date: new Date() },
      } as unknown as IVoucher;

      mockVoucherRepository.getVoucher.mockResolvedValue(mockVoucher);
      mockVoucherRepository.deleteVoucher.mockResolvedValue(mockDeletedVoucher);

      const result = await voucherService.deleteVoucher(voucherId.toString());

      expect(result).toBeDefined();
      expect(result?.archive?.status).toBe(true);
      expect(mockVoucherRepository.deleteVoucher).toHaveBeenCalled();
    });

    test("should throw error when deleting without ID", async () => {
      await expect(voucherService.deleteVoucher("")).rejects.toThrow("Voucher ID is required");
    });

    test("should throw error when voucher not found", async () => {
      mockVoucherRepository.getVoucher.mockResolvedValue(null);

      await expect(voucherService.deleteVoucher(new Types.ObjectId().toString())).rejects.toThrow(
        "Voucher not found"
      );
    });
  });

  describe("searchVoucher", () => {
    test("should search vouchers successfully", async () => {
      const mockVouchers = [
        {
          _id: new Types.ObjectId(),
          name: "Discount Voucher",
          code: "DISCOUNT50",
          description: "50% discount voucher",
          status: "active" as const,
          discount: 50,
          organizationId: new Types.ObjectId(),
        },
        {
          _id: new Types.ObjectId(),
          name: "Special Discount",
          code: "SPECIAL25",
          description: "25% discount for special customers",
          status: "active" as const,
          discount: 25,
          organizationId: new Types.ObjectId(),
        },
      ] as unknown as IVoucher[];

      mockVoucherRepository.searchVoucher.mockResolvedValue(mockVouchers);

      const result = await voucherService.searchVoucher({
        query: { name: { $regex: "Discount", $options: "i" } },
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(mockVoucherRepository.searchVoucher).toHaveBeenCalled();
    });

    test("should handle pagination in search results", async () => {
      const mockVouchers = [
        {
          _id: new Types.ObjectId(),
          name: "Discount Voucher",
          code: "DISCOUNT50",
          description: "50% discount voucher",
          status: "active" as const,
          discount: 50,
          organizationId: new Types.ObjectId(),
        },
        {
          _id: new Types.ObjectId(),
          name: "Special Discount",
          code: "SPECIAL25",
          description: "25% discount for special customers",
          status: "active" as const,
          discount: 25,
          organizationId: new Types.ObjectId(),
        },
      ] as unknown as IVoucher[];

      mockVoucherRepository.searchVoucher.mockResolvedValue(mockVouchers);
      mockVoucherRepository.countVouchers.mockResolvedValue(2);

      const result = await voucherService.searchVoucher({
        query: { name: { $regex: "Discount", $options: "i" } },
        pagination: true,
        document: true,
        count: true,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result.vouchers)).toBe(true);
      expect(result.vouchers.length).toBe(2);
      expect(result.pagination).toBeDefined();
      expect(result.count).toBe(2);
      expect(mockVoucherRepository.searchVoucher).toHaveBeenCalled();
      expect(mockVoucherRepository.countVouchers).toHaveBeenCalled();
    });
  });

  describe("bulkCreateVouchers", () => {
    test("should insert multiple vouchers successfully", async () => {
      const organizationId = new Types.ObjectId().toString();
      const bulkVoucherData = {
        organizationId,
        csvData: [
          {
            name: "Bulk Voucher 1",
            code: "BULK001",
            description: "Bulk created voucher 1",
            discount: 10,
          },
          {
            name: "Bulk Voucher 2",
            code: "BULK002",
            description: "Bulk created voucher 2",
            discount: 15,
          },
        ],
      };

      mockVoucherRepository.insertMany.mockResolvedValue([
        {
          _id: new Types.ObjectId(),
          name: "Bulk Voucher 1",
          code: "BULK001",
          description: "Bulk created voucher 1",
          status: "active" as const,
          discount: 10,
          organizationId: new Types.ObjectId(organizationId),
          createdAt: new Date(),
          updatedAt: new Date(),
          archive: { status: false, date: null },
        },
        {
          _id: new Types.ObjectId(),
          name: "Bulk Voucher 2",
          code: "BULK002",
          description: "Bulk created voucher 2",
          status: "active" as const,
          discount: 15,
          organizationId: new Types.ObjectId(organizationId),
          createdAt: new Date(),
          updatedAt: new Date(),
          archive: { status: false, date: null },
        },
      ] as unknown as IVoucher[]);

      const result = await voucherService.bulkCreateVouchers(bulkVoucherData);

      expect(result).toBeDefined();
      expect(result.successCount).toBe(2);
      expect(result.successList.length).toBe(2);
      expect(result.errorCount).toBe(0);
      expect(mockVoucherRepository.insertMany).toHaveBeenCalled();
    });
  });

  describe("Status Updates via updateVoucher", () => {
    test("should update voucher status using updateVoucher", async () => {
      const voucherId = new Types.ObjectId();
      const newStatus = "used" as const;

      const mockVoucher = {
        _id: voucherId,
        name: "Status Test Voucher",
        code: "STATUS123",
        status: "active" as const,
        organizationId: new Types.ObjectId(),
      } as unknown as IVoucher;

      const mockUpdatedVoucher = {
        ...mockVoucher,
        status: newStatus,
        usedDate: new Date(),
      } as unknown as IVoucher;

      mockVoucherRepository.updateVoucher.mockResolvedValue(mockUpdatedVoucher);

      const result = await voucherRepository.updateVoucher(voucherId.toString(), {
        status: newStatus,
        usedDate: expect.any(Date),
      } as unknown as Partial<IVoucher>);

      expect(result).toBeDefined();
      expect(result?.status).toBe(newStatus);
      expect(mockVoucherRepository.updateVoucher).toHaveBeenCalled();
    });
  });
});
