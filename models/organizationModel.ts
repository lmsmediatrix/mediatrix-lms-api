import { Document, Schema, model } from "mongoose";
import { ORGANIZATION_PLAN, ORGANIZATION_STATUS } from "../config/common";
import z from "zod";

export const OrganizationZodSchema = z.object({
  _id: z.any().optional(),
  name: z
    .string()
    .trim()
    .min(4, "Organization name must be at least 4 characters")
    .max(50, "Organization name must be at most 50 characters"),
  description: z
    .string()
    .trim()
    .min(20, "Description must be at least 20 characters")
    .max(500, "Description must be at most 500 characters")
    .optional(),
  code: z
    .string()
    .trim()
    .min(2, "Code must be at least 2 characters")
    .max(10, "Code must be at most 10 characters")
    .optional(),
  type: z.enum(["corporate", "school"]).default("school").optional(),
  admins: z.array(z.string().trim()),
  students: z.array(z.string().trim()),
  instructors: z.array(z.string().trim()),
  courses: z.array(z.string().trim()).optional(),
  plan: z.enum(ORGANIZATION_PLAN).default("free"),
  status: z.enum(ORGANIZATION_STATUS).default("active"),
  branding: z
    .object({
      logo: z.string().url("Invalid logo URL").optional(),
      coverPhoto: z.string().optional(),
      font: z.string().optional(),
      colors: z
        .object({
          primary: z.string().max(50, "Color code must be at most 50 characters").optional(),
          secondary: z.string().max(50, "Color code must be at most 50 characters").optional(),
          accent: z.string().max(50, "Color code must be at most 50 characters").optional(),
          success: z.string().max(50, "Color code must be at most 50 characters").optional(),
          warning: z.string().max(50, "Color code must be at most 50 characters").optional(),
          danger: z.string().max(50, "Color code must be at most 50 characters").optional(),
          info: z.string().max(50, "Color code must be at most 50 characters").optional(),
          light: z.string().max(50, "Color code must be at most 50 characters").optional(),
          dark: z.string().max(50, "Color code must be at most 50 characters").optional(),
          neutral: z.string().max(50, "Color code must be at most 50 characters").optional(),
        })
        .optional(),
    })
    .optional(),
  transactions: z.array(z.string().trim()).optional(),
  isDeleted: z.boolean().default(false),
  archive: z
    .object({
      status: z.boolean().default(false),
      date: z.union([z.date(), z.null()]).default(null),
    })
    .optional(),
});

export type IOrganization = z.infer<typeof OrganizationZodSchema> & Document;

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, unique: true, trim: true, minLength: 4, maxLength: 50 },
    code: { type: String, unique: true, trim: true, minLength: 2, maxLength: 10 },
    description: { type: String, trim: true, minLength: 20, maxLength: 500 },
    type: { type: String, enum: ["corporate", "school"], default: "school" },
    admins: [{ type: Schema.Types.ObjectId, ref: "User" }],
    students: [{ type: Schema.Types.ObjectId, ref: "User" }],
    instructors: [{ type: Schema.Types.ObjectId, ref: "User" }],
    courses: [{ type: Schema.Types.ObjectId, ref: "Course" }],
    plan: { type: String, enum: ORGANIZATION_PLAN, default: "free" },
    status: { type: String, enum: ORGANIZATION_STATUS, default: "active" },
    branding: {
      logo: { type: String },
      coverPhoto: { type: String },
      font: { type: String },
      colors: {
        primary: { type: String, maxLength: 50 },
        secondary: { type: String, maxLength: 50 },
        accent: { type: String, maxLength: 50 },
        success: { type: String, maxLength: 50 },
        warning: { type: String, maxLength: 50 },
        danger: { type: String, maxLength: 50 },
        info: { type: String, maxLength: 50 },
        light: { type: String, maxLength: 50 },
        dark: { type: String, maxLength: 50 },
        neutral: { type: String, maxLength: 50 },
      },
    },
    transactions: [{ type: Schema.Types.ObjectId, ref: "Transaction" }],
    isDeleted: { type: Boolean, default: false },
    archive: { status: { type: Boolean, default: false }, date: { type: Date, default: null } },
  },
  { timestamps: true }
);

export default model<IOrganization>("Organization", OrganizationSchema);
