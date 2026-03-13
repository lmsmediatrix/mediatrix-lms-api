import { z } from "zod";
import mongoose, { Schema, Document } from "mongoose";
import addCascadeDeleteHook from "../utils/cascadeDeleteHooks";

export const ModuleZodSchema = z.object({
  _id: z.any().optional(),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(100, "Title cannot exceed 100 characters"),
  description: z.string().optional(),
  organizationId: z.string().optional(),
  lessons: z.array(z.string()).optional(),
  isPublished: z.boolean().default(false),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  archive: z
    .object({
      status: z.boolean().default(false),
      date: z.union([z.date(), z.null()]).default(null),
    })
    .optional(),
});

export type IModule = z.infer<typeof ModuleZodSchema> & Document;
const ModuleSchema = new Schema<IModule>(
  {
    title: {
      type: String,
      required: true,
      minLength: 1,
      maxLength: 100,
    },
    description: { type: String },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    lessons: [{ type: Schema.Types.ObjectId, ref: "Lesson" }],
    isPublished: { type: Boolean, default: true },
    archive: { status: { type: Boolean, default: false }, date: { type: Date, default: null } },
  },
  { timestamps: true }
);

ModuleSchema.index({ title: 1, organizationId: 1 }, { unique: true });

addCascadeDeleteHook(ModuleSchema, [{ modelName: "Section", field: "modules" }]);
const Module = mongoose.model<IModule>("Module", ModuleSchema);
export default Module;
