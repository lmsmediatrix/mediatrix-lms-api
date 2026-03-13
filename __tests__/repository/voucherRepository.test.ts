import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import Voucher, { IVoucher } from "../../models/voucherModel";
import voucherRepository from "../../repository/voucherRepository";

// Mock the Voucher model methods
jest.mock("../../models/voucherModel", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    insertMany: jest.fn(),
  },
}));

type MockQueryChain = {
  select: jest.Mock;
  lean: jest.Mock;
  sort: jest.Mock;
  limit: jest.Mock;
  skip: jest.Mock;
  setQuery: jest.Mock;
  populate: jest.Mock;
  projection: jest.Mock;
  setOptions: jest.Mock;
  where: jest.Mock;
  equals: jest.Mock;
  exec: jest.Mock;
};

const createMockQueryChain = <T>(returnValue: T): Partial<MockQueryChain> => ({
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  setQuery: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
  projection: jest.fn().mockReturnThis(),
  setOptions: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  equals: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(returnValue as never),
});

const mockVoucher: IVoucher = {
  _id: "mockVoucherId" as any,
  code: "VOUCHER123",
  value: 100,
  archive: { status: false, date: null },
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as IVoucher;

const mockVoucherModel = Voucher as jest.Mocked<typeof Voucher>;

describe("Voucher Repository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getVoucher", () => {
    test("should get a voucher by ID successfully", async () => {
      const queryChain = createMockQueryChain(mockVoucher);
      mockVoucherModel.findById.mockReturnValue(queryChain as any);

      const result = await voucherRepository.getVoucher("mockVoucherId");
      expect(result).toEqual(mockVoucher);
      expect(mockVoucherModel.findById).toHaveBeenCalledWith("mockVoucherId");
    });

    test("should handle populating arrays properly", async () => {
      const populateArray = [{ path: "providerId", select: "name" }, "organizationId"];
      const queryChain = createMockQueryChain(mockVoucher);
      mockVoucherModel.findById.mockReturnValue(queryChain as any);

      const result = await voucherRepository.getVoucher("mockVoucherId", {
        options: { populateArray },
      });
      expect(result).toEqual(mockVoucher);
      expect(mockVoucherModel.findById).toHaveBeenCalledWith("mockVoucherId");
    });

    test("should use default select and lean options", async () => {
      const queryChain = createMockQueryChain(mockVoucher);
      mockVoucherModel.findById.mockReturnValue(queryChain as any);

      const result = await voucherRepository.getVoucher("mockVoucherId");
      expect(result).toEqual(mockVoucher);
    });
  });

  describe("getVouchers", () => {
    test("should get vouchers with pagination successfully", async () => {
      const queryChain = createMockQueryChain([mockVoucher]);
      mockVoucherModel.find.mockReturnValue(queryChain as any);

      const result = await voucherRepository.getVouchers({
        options: { limit: 5, skip: 0, sort: { createdAt: -1 } },
      });
      expect(result).toEqual([mockVoucher]);
      expect(mockVoucherModel.find).toHaveBeenCalled();
    });

    test("should filter by organizationId when provided", async () => {
      const queryChain = createMockQueryChain([mockVoucher]);
      mockVoucherModel.find.mockReturnValue(queryChain as any);

      const result = await voucherRepository.getVouchers({
        query: { organizationId: "orgId" },
      });
      expect(result).toEqual([mockVoucher]);
      expect(mockVoucherModel.find).toHaveBeenCalled();
    });

    test("should exclude archived vouchers by default", async () => {
      const queryChain = createMockQueryChain([mockVoucher]);
      mockVoucherModel.find.mockReturnValue(queryChain as any);

      const result = await voucherRepository.getVouchers({});
      expect(result).toEqual([mockVoucher]);
      expect(mockVoucherModel.find).toHaveBeenCalled();
    });
  });

  describe("countVouchers", () => {
    test("should count vouchers successfully", async () => {
      const queryChain = createMockQueryChain(5);
      mockVoucherModel.countDocuments.mockReturnValue(queryChain as any);

      const result = await voucherRepository.countVouchers({});
      expect(result).toBe(5);
      expect(mockVoucherModel.countDocuments).toHaveBeenCalledWith({});
    });

    test("should count vouchers with specific query", async () => {
      const query = { status: "active" };
      const queryChain = createMockQueryChain(2);
      mockVoucherModel.countDocuments.mockReturnValue(queryChain as any);

      const result = await voucherRepository.countVouchers(query);
      expect(result).toBe(2);
      expect(mockVoucherModel.countDocuments).toHaveBeenCalledWith(query);
    });
  });

  describe("createVoucher", () => {
    test("should create a voucher successfully", async () => {
      mockVoucherModel.create.mockResolvedValue(mockVoucher as any);

      const result = await voucherRepository.createVoucher({
        code: "VOUCHER123",
        value: 100,
      } as Partial<IVoucher>);
      expect(result).toEqual(mockVoucher);
      expect(mockVoucherModel.create).toHaveBeenCalledWith({ code: "VOUCHER123", value: 100 });
    });
  });

  describe("updateVoucher", () => {
    test("should update a voucher successfully", async () => {
      mockVoucherModel.findByIdAndUpdate.mockResolvedValue(mockVoucher as any);

      const result = await voucherRepository.updateVoucher("mockVoucherId", {
        code: "UPDATEDCODE",
      });
      expect(result).toEqual(mockVoucher);
      expect(mockVoucherModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "mockVoucherId",
        { $set: { code: "UPDATEDCODE" } },
        { new: true }
      );
    });
  });

  describe("deleteVoucher", () => {
    test("should delete a voucher if archive.status is true", async () => {
      mockVoucherModel.findByIdAndDelete.mockResolvedValue(mockVoucher as any);

      const result = await voucherRepository.deleteVoucher({
        _id: "mockVoucherId",
        archive: { status: true },
      });
      expect(result).toEqual(mockVoucher);
      expect(mockVoucherModel.findByIdAndDelete).toHaveBeenCalledWith("mockVoucherId");
    });

    test("should archive a voucher if not already archived", async () => {
      mockVoucherModel.findByIdAndUpdate.mockResolvedValue(mockVoucher as any);

      const result = await voucherRepository.deleteVoucher({
        _id: "mockVoucherId",
        archive: { status: false },
      });
      expect(result).toEqual(mockVoucher);
      expect(mockVoucherModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "mockVoucherId",
        { $set: { archive: { status: true, date: expect.any(Date) } } },
        { new: true }
      );
    });
  });

  describe("searchVoucher", () => {
    test("should search vouchers successfully", async () => {
      const queryChain = createMockQueryChain([mockVoucher]);
      mockVoucherModel.find.mockReturnValue(queryChain as any);

      const result = await voucherRepository.searchVoucher({});
      expect(result).toEqual([mockVoucher]);
      expect(mockVoucherModel.find).toHaveBeenCalled();
    });

    test("should exclude archived vouchers by default", async () => {
      const queryChain = createMockQueryChain([mockVoucher]);
      mockVoucherModel.find.mockReturnValue(queryChain as any);

      const result = await voucherRepository.searchVoucher({});
      expect(result).toEqual([mockVoucher]);
      expect(mockVoucherModel.find).toHaveBeenCalled();
    });

    test("should search vouchers with match param", async () => {
      const queryChain = createMockQueryChain([mockVoucher]);
      mockVoucherModel.find.mockReturnValue(queryChain as any);

      const result = await voucherRepository.searchVoucher({ match: { code: "VOUCHER123" } });
      expect(result).toEqual([mockVoucher]);
      expect(mockVoucherModel.find).toHaveBeenCalled();
    });
  });

  describe("insertMany", () => {
    test("should insert multiple vouchers successfully", async () => {
      mockVoucherModel.insertMany.mockResolvedValue([mockVoucher] as any);

      const result = await voucherRepository.insertMany([
        { code: "VOUCHER123", value: 100 } as Partial<IVoucher>,
      ]);
      expect(result).toEqual([mockVoucher]);
      expect(mockVoucherModel.insertMany).toHaveBeenCalledWith(
        [{ code: "VOUCHER123", value: 100 }],
        { ordered: false }
      );
    });

    test("should handle insertMany errors gracefully", async () => {
      mockVoucherModel.insertMany.mockRejectedValue(new Error("Insert error"));

      await expect(
        voucherRepository.insertMany([{ code: "VOUCHER123", value: 100 } as Partial<IVoucher>])
      ).rejects.toThrow("Insert error");
    });
  });
});
