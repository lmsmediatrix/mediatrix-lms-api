import mongoose, { Schema, Document } from "mongoose";
import { z } from "zod";

export const ProgramZodSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Program code is required")
    .max(10, "Program code must be less than 10 characters"),
  name: z
    .string()
    .trim()
    .min(2, "Program name must be at least 2 characters long")
    .max(100, "Program name must be less than 100 characters"),
  description: z.string().trim().max(500, "Description must be less than 500 characters"),
  organizationId: z.string().optional(),
  archive: z
    .object({ status: z.boolean().default(false), date: z.date().nullable().default(null) })
    .optional(),
});

export type IProgram = z.infer<typeof ProgramZodSchema> & Document & { code: string };

const programSchema = new Schema<IProgram>(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
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
  {
    timestamps: true,
  }
);

programSchema.index({ code: 1, organizationId: 1 }, { unique: true });

const Program = mongoose.model<IProgram>("Program", programSchema);

export default Program;
