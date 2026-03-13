import { Schema, model, Types } from "mongoose";
import z from "zod";
import addCascadeDeleteHook from "../utils/cascadeDeleteHooks";

export const GradeZodSchema = z.object({
  _id: z.any().optional(),
  organizationId: z.custom<Types.ObjectId>(),
  sectionId: z.custom<Types.ObjectId>(),
  gradingMethod: z.enum(["points_based", "percentage_based", "letter_grade"]),
  totalCoursePoints: z
    .number()
    .min(0, "Total course points must be a positive number")
    .max(1000, "Total course points cannot exceed 1000"),
  minPassingGrade: z
    .number()
    .min(0, "Minimum passing grade must be at least 0")
    .max(1000, "Minimum passing grade cannot exceed 1000"),
  lateSubmissionPenalty: z.number().default(0),
  gradeDistribution: z
    .array(
      z.object({
        category: z.string().min(1, "Category is required"),
        weight: z
          .number()
          .min(0, "Weight must be a positive number")
          .max(100, "Weight cannot exceed 100"),
      })
    )
    .optional(),
  gradingScale: z
    .array(
      z.object({
        gradeLabel: z
          .string()
          .min(1, " Grade label is required")
          .max(100, "Grade label cannot exceed 100 characters"),
        percentageRange: z
          .object({
            startRange: z
              .number()
              .min(0, "Start range must be at least 0")
              .max(100, "Start range cannot exceed 100"),
            endRange: z
              .number()
              .min(0, "End range must be at least 0")
              .max(100, "End range cannot exceed 100"),
          })
          .refine(
            (data) => data.startRange <= data.endRange,
            "Start range must be Less than end range"
          ),
      })
    )
    .optional(),
  isDeleted: z.boolean().default(false),
  archive: z
    .object({
      status: z.boolean().default(false),
      date: z.union([z.date(), z.null()]).default(null),
    })
    .optional(),
});

export type IGrade = z.infer<typeof GradeZodSchema>;

const GradeSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    sectionId: { type: Schema.Types.ObjectId, ref: "Section", required: true },
    gradingMethod: {
      type: String,
      enum: ["points_based", "percentage_based", "letter_grade"],
      required: true,
    },
    totalCoursePoints: { type: Number, required: true, min: 0, max: 1000 },
    minPassingGrade: { type: Number, required: true, min: 0, max: 1000 },
    lateSubmissionPenalty: { type: Number, default: 0 },
    gradeDistribution: [
      {
        category: { type: String, required: true },
        weight: { type: Number, required: true },
      },
    ],
    gradingScale: [
      {
        gradeLabel: { type: String, required: true, minLength: 1, maxLength: 100 },
        percentageRange: {
          startRange: { type: Number, required: true, min: 0, max: 100 },
          endRange: { type: Number, required: true, min: 0, max: 100 },
        },
      },
    ],
    isDeleted: { type: Boolean, default: false },
    archive: { status: { type: Boolean, default: false }, date: { type: Date, default: null } },
  },
  { timestamps: true }
);

GradeSchema.index({ sectionId: 1, organizationId: 1 }, { unique: true });

addCascadeDeleteHook(GradeSchema, [{ modelName: "Section", field: "grade" }]);
const Grade = model<IGrade>("Grade", GradeSchema);
export default Grade;
