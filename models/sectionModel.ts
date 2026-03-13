import mongoose, { Schema, Document, Types } from "mongoose";
import { config } from "../config/common";
import z from "zod";

const AttendanceZodSchema = z.object({
  userId: z.custom<Types.ObjectId>(),
  userType: z.enum(["student", "instructor"]),
  date: z.coerce.date(),
  status: z.enum(config.ENUM.ATTENDANCE.STATUS),
  remarks: z.string().optional(),
});

export const SectionZodSchema = z.object({
  _id: z.any().optional(),
  code: z
    .string()
    .min(2, "Section code must be at least 2 characters")
    .max(10, "Section code must be at most 10 characters"),
  name: z
    .string()
    .min(3, "Section name must be at least 3 characters")
    .max(50, "Section name must be at most 50 characters"),
  organizationId: z.custom<Types.ObjectId>(),
  course: z.custom<Types.ObjectId>(),
  modules: z.array(z.custom<Types.ObjectId>()).default([]),
  instructor: z.custom<Types.ObjectId>(),
  students: z.array(z.custom<Types.ObjectId>()).default([]),
  grade: z.custom<Types.ObjectId>(),
  schoolYear: z.string().trim().min(4, "School year must be at least 4 characters").optional(),
  semester: z.enum(["1st_sem", "2nd_sem", "3rd_sem"]).default("1st_sem").optional(),
  announcements: z.array(z.custom<Types.ObjectId>()).default([]),
  assessments: z.array(z.custom<Types.ObjectId>()).default([]),
  schedule: z.object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    breakdown: z.array(
      z.object({
        day: z.enum(config.ENUM.SECTION.DAYS),
        time: z.object({
          start: z.string(),
          end: z.string(),
        }),
      })
    ),
  }),
  attendance: z.array(AttendanceZodSchema).optional(),
  status: z.enum(config.ENUM.SECTION.STATUS).default(config.ENUM.SECTION.STATUS[1]),
  totalStudent: z.number().int().nonnegative().default(0),
  isDeleted: z.boolean().default(false),
  archive: z
    .object({
      status: z.boolean().default(false),
      date: z.union([z.date(), z.null()]).default(null),
    })
    .optional(),
});

export type ISection = z.infer<typeof SectionZodSchema> &
  Document & {
    _paginations?: any;
  };
type IAttendance = z.infer<typeof AttendanceZodSchema> & Document;

const attendanceSchema = new mongoose.Schema<IAttendance>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userType: { type: String, enum: ["student", "instructor"], required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: config.ENUM.ATTENDANCE.STATUS, required: true },
  remarks: { type: String },
});

const SectionSchema = new Schema<ISection>(
  {
    code: { type: String, required: true, minLength: 2, maxLength: 10 },
    name: { type: String, required: true, minLength: 3, maxLength: 50 },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    modules: [{ type: Schema.Types.ObjectId, ref: "Module" }],
    announcements: [{ type: Schema.Types.ObjectId, ref: "Announcement" }],
    assessments: [{ type: Schema.Types.ObjectId, ref: "Assessment" }],
    instructor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    grade: { type: Schema.Types.ObjectId, ref: "Grade" },
    schoolYear: { type: String },
    semester: {
      type: String,
      enum: ["1st_sem", "2nd_sem", "3rd_sem"],
    },
    students: [{ type: Schema.Types.ObjectId, ref: "User" }],
    attendance: [attendanceSchema],
    schedule: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      breakdown: [
        {
          day: {
            type: String,
            enum: config.ENUM.SECTION.DAYS,
            required: true,
          },
          time: {
            start: { type: String, required: true },
            end: { type: String, required: true },
          },
        },
      ],
    },
    status: {
      type: String,
      enum: config.ENUM.SECTION.STATUS,
      default: config.ENUM.SECTION.STATUS[1],
    },
    totalStudent: { type: Number, default: 0, min: 0 },
    isDeleted: { type: Boolean, default: false },
    archive: { status: { type: Boolean, default: false }, date: { type: Date, default: null } },
  },
  { timestamps: true }
);

SectionSchema.pre("save", function (next) {
  if (this.students) {
    this.totalStudent = this.students.length;
  }
  next();
});

SectionSchema.pre(["updateOne", "findOneAndUpdate"], async function (next) {
  const update = this.getUpdate() as any;
  if (update?.students) {
    update.totalStudent = update.students.length;
  }
  next();
});

SectionSchema.pre("find", async function () {
  const currentDate = new Date();
  await this.model.bulkWrite([
    {
      updateMany: {
        filter: {
          "schedule.startDate": { $gt: currentDate },
          status: { $ne: config.ENUM.SECTION.STATUS[0] },
        },
        update: { $set: { status: config.ENUM.SECTION.STATUS[0] } },
      },
    },
    {
      updateMany: {
        filter: {
          "schedule.startDate": { $lte: currentDate },
          "schedule.endDate": { $gte: currentDate },
          status: { $ne: config.ENUM.SECTION.STATUS[1] },
        },
        update: { $set: { status: config.ENUM.SECTION.STATUS[1] } },
      },
    },
    {
      updateMany: {
        filter: {
          "schedule.endDate": { $lt: currentDate },
          status: { $ne: config.ENUM.SECTION.STATUS[2] },
        },
        update: { $set: { status: config.ENUM.SECTION.STATUS[2] } },
      },
    },
  ]);
});

SectionSchema.index({ code: 1, organizationId: 1 }, { unique: true });

const Section = mongoose.model<ISection>("Section", SectionSchema);

export default Section;
