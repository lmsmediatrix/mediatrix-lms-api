import mongoose, { Document, Schema, Types } from "mongoose";
import { z } from "zod";

export const ProviderZodSchema = z.object({
  _id: z.any().optional(),
  name: z
    .string()
    .min(3, "Provider name must be at least 3 characters")
    .max(50, "Provider name must be at most 50 characters"),
  description: z.string().max(200, "Description cannot exceed 200 characters").optional(),
  contactEmail: z.string().email("Invalid email format").optional(),
  contactPhone: z.string().max(20, "Phone number cannot exceed 20 characters").optional(),
  website: z.string().url("Invalid URL format").optional(),
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

export interface IProvider extends Document, z.infer<typeof ProviderZodSchema> {
  _id: Types.ObjectId;
}

const VoucherProviderSchema = new Schema<IProvider>(
  {
    name: { type: String, minLength: 3, maxLength: 50, required: true },
    description: { type: String, maxLength: 200 },
    contactEmail: { type: String },
    contactPhone: { type: String, maxLength: 20 },
    website: { type: String },
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

VoucherProviderSchema.index({ name: 1, organizationId: 1 }, { unique: true });

export default mongoose.model<IProvider>("Provider", VoucherProviderSchema);
