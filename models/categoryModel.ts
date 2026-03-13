import mongoose, { Document, Types } from "mongoose";
import { z } from "zod";

export const CategoryZodSchema = z.object({
  _id: z.any().optional(),
  name: z
    .string()
    .min(2, "Category name must be at least 2 characters long")
    .max(100, "Category name must be less than 100 characters long"),
  isActive: z.boolean().default(true),
  organizationId: z.string().optional(),
  archive: z
    .object({
      status: z.boolean().default(false),
      date: z.date().nullable().default(null),
    })
    .default({ status: false, date: null }),
});
export interface ICategory extends Document, z.infer<typeof CategoryZodSchema> {
  _id: Types.ObjectId;
}

const categorySchema = new mongoose.Schema<ICategory>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    } as any,
    archive: {
      status: {
        type: Boolean,
        default: false,
      },
      date: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

categorySchema.index({ name: 1, organizationId: 1 }, { unique: true });

export default mongoose.model<ICategory>("Category", categorySchema);
