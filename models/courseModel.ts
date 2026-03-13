import mongoose, { Document, Types } from "mongoose";
import { COURSE_STATUS, COURSE_LEVEL } from "../config/common";

import z from "zod";
import addCascadeDeleteHook from "../utils/cascadeDeleteHooks";

export const CourseZodSchema = z.object({
  _id: z.any().optional(),
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(50, "Title must be at most 50 characters"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(500, "Description cannot exceed 500 characters"),
  organizationId: z.custom<Types.ObjectId>().optional(),
  category: z.custom<Types.ObjectId>(),
  level: z.enum(COURSE_LEVEL),
  language: z.string().trim().default("English"),
  timezone: z.string().trim().default("UTC"),
  code: z
    .string()
    .min(3, "Code must be at least 3 characters")
    .max(40, "Code must be at most 40 characters"),
  thumbnail: z.string().url("Invalid thumbnail URL").optional(),
  status: z.enum(COURSE_STATUS).default("draft"),
  isPublished: z.boolean().default(false),
  isDeleted: z.boolean().default(false),
  archive: z
    .object({
      status: z.boolean().default(false),
      date: z.union([z.date(), z.null()]).default(null),
    })
    .optional(),
  voucher: z.array(z.custom<Types.ObjectId>()).default([]),
});

export type ICourse = z.infer<typeof CourseZodSchema> & Document;

const CourseSchema = new mongoose.Schema<ICourse>(
  {
    title: { type: String, required: true, trim: true, minLength: 3, maxLength: 50 },
    description: { type: String, required: true, minLength: 10, maxLength: 500 },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization" },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    level: { type: String, enum: COURSE_LEVEL, required: true },
    language: { type: String, default: "English" },
    timezone: { type: String, default: "UTC" },
    code: { type: String, required: true, minLength: 3, maxLength: 40 },
    thumbnail: { type: String },
    status: { type: String, enum: COURSE_STATUS, default: "draft" },
    isPublished: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    archive: { status: { type: Boolean, default: false }, date: { type: Date, default: null } },
    voucher: [{ type: mongoose.Schema.Types.ObjectId, ref: "Voucher" }],
  },
  { timestamps: true }
);

CourseSchema.index({ code: 1, organizationId: 1 }, { unique: true });

addCascadeDeleteHook(CourseSchema, [{ modelName: "Section", field: "course", isArray: false }]);
const Course = mongoose.model("Course", CourseSchema);
export default Course;
