import { z } from "zod";
import mongoose, { Document } from "mongoose";
import { config } from "../config/common";
import { Types } from "mongoose";

const AttendanceZodSchema = z.object({
  _id: z.custom<Types.ObjectId>().optional(),
  section: z.custom<Types.ObjectId>(),
  userId: z.custom<Types.ObjectId>(),
  userType: z.enum(["student", "instructor"]),
  date: z.coerce.date(),
  status: z.enum(config.ENUM.ATTENDANCE.STATUS),
  remarks: z.string().optional(),
  archive: z
    .object({
      status: z.boolean().default(false),
      date: z.union([z.date(), z.null()]).default(null),
    })
    .optional(),
});

type IAttendance = z.infer<typeof AttendanceZodSchema> & Document;

export { AttendanceZodSchema, IAttendance };

const attendanceSchema = new mongoose.Schema<IAttendance>({
  section: { type: mongoose.Schema.Types.ObjectId, ref: "Section", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userType: { type: String, enum: ["student", "instructor"], required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: config.ENUM.ATTENDANCE.STATUS, required: true },
  remarks: { type: String },
  archive: { status: { type: Boolean, default: false }, date: { type: Date, default: null } },
});

attendanceSchema.index({ userId: 1, date: 1, section: 1 }, { unique: true });

const Attendance = mongoose.model<IAttendance>("Attendance", attendanceSchema);
export default Attendance;
