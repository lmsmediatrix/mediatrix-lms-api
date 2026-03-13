import { Schema, model, Types } from "mongoose";
import z from "zod";

export const PerformanceActionPlanZodSchema = z.object({
  _id: z.any().optional(),
  organizationId: z.custom<Types.ObjectId>(),
  studentId: z.custom<Types.ObjectId>(),
  createdBy: z.custom<Types.ObjectId>(),
  createdByRole: z.enum(["admin", "instructor"]),
  sectionCode: z.string().trim().optional(),
  title: z.string().trim().min(1).default("Action Plan"),
  summary: z.string().trim().optional(),
  riskLevel: z.enum(["Critical", "Moderate", "Low"]).optional(),
  status: z.enum(["open", "in_progress", "completed"]).default("open"),
  archive: z
    .object({
      status: z.boolean().default(false),
      date: z.union([z.date(), z.null()]).default(null),
    })
    .optional(),
});

export type IPerformanceActionPlan = z.infer<typeof PerformanceActionPlanZodSchema>;

const PerformanceActionPlanSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    createdByRole: {
      type: String,
      enum: ["admin", "instructor"],
      required: true,
    },
    sectionCode: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      default: "Action Plan",
    },
    summary: {
      type: String,
      trim: true,
      default: "",
    },
    riskLevel: {
      type: String,
      enum: ["Critical", "Moderate", "Low"],
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "completed"],
      default: "open",
      required: true,
    },
    archive: {
      status: { type: Boolean, default: false },
      date: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

PerformanceActionPlanSchema.index({ organizationId: 1, studentId: 1, createdAt: -1 });

const PerformanceActionPlan = model<IPerformanceActionPlan>(
  "PerformanceActionPlan",
  PerformanceActionPlanSchema
);

export default PerformanceActionPlan;
