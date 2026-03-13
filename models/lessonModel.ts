import mongoose, { Schema, Document, Types } from "mongoose";
import z from "zod";
import addCascadeDeleteHook from "../utils/cascadeDeleteHooks";

export const LessonZodSchema = z.object({
  _id: z.any().optional(),
  title: z
    .string()
    .trim()
    .min(1, { message: "Title must be at least 1 character long" })
    .max(100, { message: "Title cannot exceed 100 characters" }),
  description: z
    .string()
    .min(1, { message: "Description cannot be empty" })
    .max(500, { message: "Description cannot exceed 500 characters" })
    .optional(),
  information: z
    .string()
    .min(1, { message: "Information cannot be empty" })
    .max(500, { message: "Information cannot exceed 500 characters" })
    .trim()
    .optional(),
  videoUrl: z.string().url("Invalid video URL").optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  time: z.string().trim().optional(),
  status: z.enum(["published", "unpublished"]).default("published"),
  liveDiscussion: z.boolean().default(false),
  duration: z.number().int().positive("Duration must be a positive number").optional(),
  tags: z.array(z.string()).optional(),
  author: z.custom<Types.ObjectId>().optional(),
  isDeleted: z.boolean().default(false),
  mainContent: z.string().optional(),
  files: z.array(z.string().url("Invalid file URL")).optional(),
  progress: z
    .array(
      z.object({
        userId: z.custom<Types.ObjectId>(),
        currentPage: z.number().optional(),
        totalPages: z.number().optional(),
        timeSpent: z.number().default(0),
        status: z.enum(["completed", "in-progress", "not-started"]).default("not-started"),
      })
    )
    .optional(),
  archive: z
    .object({
      status: z.boolean().default(false),
      date: z.union([z.date(), z.null()]).default(null),
    })
    .optional(),
});

export type ILesson = z.infer<typeof LessonZodSchema> & Document;

const LessonSchema = new Schema<ILesson>(
  {
    title: { type: String, minLength: 1, maxLength: 100, required: true },
    description: { type: String, minLength: 1, maxLength: 500 },
    information: { type: String, minLength: 1, maxLength: 500 },
    videoUrl: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    time: { type: String },
    status: {
      type: String,
      enum: ["published", "unpublished"],
      default: "published",
      required: true,
    },
    liveDiscussion: { type: Boolean, default: false },
    duration: { type: Number },
    tags: [{ type: String }],
    author: { type: Schema.Types.ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false },
    mainContent: { type: String },
    files: [{ type: String }],
    progress: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        currentPage: { type: Number, default: 0 },
        totalPages: { type: Number, default: 0 },
        timeSpent: { type: Number, default: 0 },
        status: {
          type: String,
          enum: ["completed", "in-progress", "not-started"],
          default: "not-started",
        },
      },
    ],
    archive: { status: { type: Boolean, default: false }, date: { type: Date, default: null } },
  },
  { timestamps: true }
);

LessonSchema.index({ title: 1, author: 1 }, { unique: true });

addCascadeDeleteHook(LessonSchema, [{ modelName: "Module", field: "lessons" }]);
const Lesson = mongoose.model<ILesson>("Lesson", LessonSchema);

export default Lesson;
