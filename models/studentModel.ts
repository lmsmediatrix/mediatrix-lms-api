import mongoose, { Schema, Document, Types } from "mongoose";
import { z } from "zod";
import User, { IUser, UserZodSchema } from "./userModel";
import addCascadeDeleteHook from "../utils/cascadeDeleteHooks";
import { config } from "../config/common";

export const StudentAssessmentResultZodSchema = z.object({
  _id: z.any().optional(),
  assessmentId: z.custom<Types.ObjectId>(),
  type: z.enum(config.ENUM.ASSESSMENT.TYPE),
  assessmentNo: z.number().optional(),
  sectionCode: z.string().optional(),
  answers: z.array(
    z.object({
      questionId: z.number(),
      answer: z.union([z.string(), z.array(z.string())]).optional(),
      correctAnswer: z.union([z.string(), z.array(z.string())]).optional(),
      isCorrect: z.boolean().optional(),
      pointsEarned: z.number().optional(),
    })
  ),
  totalItems: z.number().min(0, "Total score must be at least 0"),
  totalPoints: z.number().min(0, "Total score must be at least 0"),
  totalScore: z.number().min(0, "Total score must be at least 0"),
  passingScore: z.number().optional(),
  isPassed: z.boolean().optional(),
  attemptNumber: z.number().default(10),
  startTime: z.string().optional(),
  isFinished: z.boolean().default(false),
  endTime: z.string().optional(),
  isDeleted: z.boolean().default(false),
});

export type IStudentAssessmentResult = z.infer<typeof StudentAssessmentResultZodSchema>;

const StudentAssessmentResultSchema = new Schema<IStudentAssessmentResult>(
  {
    assessmentId: {
      type: Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
    },
    type: {
      type: String,
      enum: config.ENUM.ASSESSMENT.TYPE,
    },
    assessmentNo: { type: Number },
    sectionCode: { type: String },
    answers: [
      {
        questionId: { type: Number, required: true },
        answer: { type: Schema.Types.Mixed },
        correctAnswer: { type: Schema.Types.Mixed },
        isCorrect: { type: Boolean },
        pointsEarned: { type: Number },
      },
    ],
    totalItems: { type: Number, required: true },
    totalScore: { type: Number, required: true },
    totalPoints: { type: Number, required: true },
    passingScore: { type: Number },
    isPassed: { type: Boolean },
    attemptNumber: { type: Number },
    isFinished: { type: Boolean, default: false },
    startTime: { type: String },
    endTime: { type: String },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const StudentZodSchema = UserZodSchema.extend({
  studentId: z.string().optional(),
  gpa: z.number().min(0, "GPA cannot be below 0").max(4.0, "GPA cannot exceed 4.0").optional(),
  achievements: z.array(z.string()).optional(),
  studentAssessmentResults: z.array(StudentAssessmentResultZodSchema).optional(),
  program: z.custom<Types.ObjectId>(),
  yearLevel: z.number().int().min(1, "Year level must be at least 1").optional(),
  socialLinks: z
    .object({
      linkedIn: z.string().url("Invalid LinkedIn URL").optional(),
      twitter: z.string().url("Invalid Twitter URL").optional(),
      website: z.string().url("Invalid Website URL").optional(),
    })
    .optional(),
  archive: z
    .object({
      status: z.boolean().default(false),
      date: z.union([z.date(), z.null()]).default(null),
    })
    .optional(),
});

export type IStudent = z.infer<typeof StudentZodSchema> & IUser & Document;

const StudentSchema = new Schema<IStudent>(
  {
    studentId: { type: String },
    gpa: { type: Number, min: 0, max: 4.0 },
    achievements: [{ type: String }],
    studentAssessmentResults: [StudentAssessmentResultSchema],
    program: { type: mongoose.Schema.Types.ObjectId, ref: "Program" },
    yearLevel: { type: Number, min: 1 },
    socialLinks: {
      linkedIn: { type: String, trim: true },
      twitter: { type: String, trim: true },
      website: { type: String, trim: true },
    },
    archive: { status: { type: Boolean, default: false }, date: { type: Date, default: null } },
  },
  { timestamps: true }
);

StudentSchema.index({ studentId: 1, organizationId: 1 }, { unique: true });

addCascadeDeleteHook(StudentSchema, [
  { modelName: "Organization", field: "students" },
  { modelName: "Section", field: "students" },
]);
const Student = User.discriminator<IStudent>("student", StudentSchema);
export default Student;
