import mongoose, { Document, Schema, Types } from "mongoose";
import { z } from "zod";

export const VOUCHER_STATUS = ["active", "used", "expired", "revoked"] as const;

export const VoucherZodSchema = z.object({
  _id: z.any().optional(),
  name: z
    .string()
    .min(3, "Voucher name must be at least 3 characters")
    .max(50, "Voucher name must be at most 50 characters"),
  code: z
    .string()
    .min(6, "Voucher code must be at least 6 characters")
    .max(20, "Voucher code must be at most 20 characters"),
  description: z.string().max(200, "Description cannot exceed 200 characters").optional(),
  status: z.enum(VOUCHER_STATUS).default("active"),
  issuedTo: z.custom<Types.ObjectId>().optional(),
  discount: z.number().min(0).max(100).optional(),
  providerId: z.custom<Types.ObjectId>().optional(),
  expiryDate: z
    .string()
    .transform((val) => new Date(val))
    .optional(),
  usedDate: z.date().optional(),
  organizationId: z.custom<Types.ObjectId>(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  archive: z
    .object({
      status: z.boolean().default(false),
      date: z.union([z.date(), z.null()]).default(null),
    })
    .optional(),
});

export interface IVoucher extends Document, z.infer<typeof VoucherZodSchema> {
  _id: Types.ObjectId;
}

const VoucherSchema = new Schema<IVoucher>(
  {
    name: { type: String, required: true, minLength: 3, maxLength: 50 },
    code: { type: String, required: true, minLength: 6, maxLength: 20 },
    description: { type: String, maxLength: 200 },
    status: { type: String, enum: VOUCHER_STATUS, default: "active" },
    issuedTo: { type: Schema.Types.ObjectId, ref: "User" },
    discount: { type: Number, min: 0, max: 100 },
    providerId: { type: Schema.Types.ObjectId, ref: "Provider" },
    expiryDate: { type: Date },
    usedDate: { type: Date },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    archive: { status: { type: Boolean, default: false }, date: { type: Date, default: null } },
  },
  { timestamps: true }
);

VoucherSchema.index({ code: 1, organizationId: 1 }, { unique: true });

export default mongoose.model<IVoucher>("Voucher", VoucherSchema);
