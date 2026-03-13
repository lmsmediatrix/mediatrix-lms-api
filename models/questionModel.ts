import z from "zod";
import mongoose, { Schema, Types } from "mongoose";
import { config } from "../config/common";

export const QuestionZodSchema = z.object({
  _id: z.any().optional(),
  organizationId: z.custom<Types.ObjectId>(),
  assessmentId: z.custom<Types.ObjectId>(),
  type: z.enum(config.ENUM.QUESTION.TYPE),
  text: z.string().min(1, "Question text is required"),
  options: z
    .array(
      z.object({
        letter: z.enum(["A", "B", "C", "D"]).optional(),
        text: z.string().min(1, "Option text is required"),
        isCorrect: z.boolean().default(false),
      })
    )
    .optional(),
  correctAnswers: z.array(z.string()).optional(),
  maxWords: z.number().min(1, "Max words must be at least 1").optional(),
  points: z.number().min(1, "Points must be at least 1"),
  isDeleted: z.boolean().default(false),
  createdBy: z.custom<Types.ObjectId>(),
  archive: z
    .object({ status: z.boolean().default(false), date: z.date().nullable().default(null) })
    .optional(),
});

export type IQuestion = z.infer<typeof QuestionZodSchema>;

const QuestionSchema = new Schema<IQuestion>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    assessmentId: {
      type: Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
    },
    type: {
      type: String,
      enum: config.ENUM.QUESTION.TYPE,
      required: true,
    },
    text: { type: String, required: true },
    options: [
      {
        letter: { type: String, enum: ["A", "B", "C", "D"], required: false },
        text: { type: String, required: false },
        isCorrect: { type: Boolean, default: false },
      },
    ],
    correctAnswers: [{ type: String }],
    maxWords: { type: Number, required: false },
    points: { type: Number, required: true },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    archive: { status: { type: Boolean, default: false }, date: { type: Date, default: null } },
  },
  { timestamps: true }
);

QuestionSchema.index({ text: 1, organizationId: 1 }, { unique: true });

export default mongoose.model<IQuestion>("Question", QuestionSchema);
