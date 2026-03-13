import mongoose, { Document, Schema } from "mongoose";
import { z } from "zod";

export interface IFaculty extends Document {
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  organizationId: mongoose.Types.ObjectId;
  archive: {
    status: boolean;
    date: Date | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

export const FacultyZodSchema = z.object({
  _id: z.any().optional(),
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters"),
  code: z
    .string()
    .trim()
    .min(2, "Code must be at least 2 characters")
    .max(20, "Code cannot exceed 20 characters"),
  description: z.string().max(500, "Description cannot exceed 500 characters").optional(),
  isActive: z.boolean().default(true),
  organizationId: z.custom<mongoose.Types.ObjectId>().optional(),
  archive: z
    .object({
      status: z.boolean().default(false),
      date: z.union([z.date(), z.null()]).default(null),
    })
    .optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

const FacultySchema = new Schema<IFaculty>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minLength: 2,
      maxLength: 100,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      minLength: 2,
      maxLength: 20,
    },
    description: {
      type: String,
      maxLength: 500,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    archive: {
      status: { type: Boolean, default: false },
      date: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

FacultySchema.index({ name: 1 });
FacultySchema.index({ code: 1 });
FacultySchema.index({ isActive: 1 });
FacultySchema.index({ organizationId: 1 });

FacultySchema.index({ code: 1, organizationId: 1 }, { unique: true });

export default mongoose.model<IFaculty>("Faculty", FacultySchema);
