import { Schema, model, Types } from "mongoose";
import z from "zod";

export const StudentAssessmentGradeZodSchema = z.object({
  _id: z.any().optional(),
  organizationId: z.custom<Types.ObjectId>(),
  sectionId: z.custom<Types.ObjectId>(),
  assessmentId: z.custom<Types.ObjectId>(),
  studentId: z.custom<Types.ObjectId>(),
  score: z.number().min(0, "Score must be a non-negative number"),
  totalPoints: z.number().min(0, "Total points must be a non-negative number"),
  percentage: z.number().min(0).max(100).optional(),
  gradeLabel: z.string().optional(),
  isPassed: z.boolean().optional(),
  status: z.enum(["pending", "submitted", "graded", "returned", "late"]),
  submittedAt: z.union([z.date(), z.null()]).optional(),
  gradedAt: z.union([z.date(), z.null()]).optional(),
  gradedBy: z.custom<Types.ObjectId>().optional(),
  remarks: z.string().optional(),
  isDeleted: z.boolean().default(false),
  archive: z
    .object({
      status: z.boolean().default(false),
      date: z.union([z.date(), z.null()]).default(null),
    })
    .optional(),
});

export type IStudentAssessmentGrade = z.infer<typeof StudentAssessmentGradeZodSchema>;

const StudentAssessmentGradeSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    sectionId: {
      type: Schema.Types.ObjectId,
      ref: "Section",
      required: true,
      index: true,
    },
    assessmentId: {
      type: Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    score: { type: Number, required: true, min: 0 },
    totalPoints: { type: Number, required: true, min: 0 },
    percentage: { type: Number, min: 0, max: 100 },
    gradeLabel: { type: String },
    isPassed: { type: Boolean },
    status: {
      type: String,
      enum: ["pending", "submitted", "graded", "returned", "late"],
      required: true,
      default: "pending",
    },
    submittedAt: { type: Date, default: null },
    gradedAt: { type: Date, default: null },
    gradedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    remarks: { type: String },
    isDeleted: { type: Boolean, default: false },
    archive: {
      status: { type: Boolean, default: false },
      date: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

StudentAssessmentGradeSchema.index({ studentId: 1, assessmentId: 1 }, { unique: true });

const StudentAssessmentGrade = model<IStudentAssessmentGrade>(
  "StudentAssessmentGrade",
  StudentAssessmentGradeSchema
);

export default StudentAssessmentGrade;
