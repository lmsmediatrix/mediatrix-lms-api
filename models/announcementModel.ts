import z from "zod";
import mongoose, { Document, Schema, Types } from "mongoose";
import { config } from "../config/common";
import addCascadeDeleteHook from "../utils/cascadeDeleteHooks";
export const AnnouncementZodSchema = z.object({
  _id: z.any().optional(),
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
  textBody: z.string().min(1, "Body text is required").max(5000, "Body text is too long"),
  publishDate: z.coerce.date().default(() => new Date()),
  isPublished: z.boolean().default(true),
  author: z.custom<Types.ObjectId>(),
  attachments: z.array(z.string().url()).optional(),
  isDeleted: z.boolean().default(false),
  scope: z.enum(config.ENUM.ANNOUNCEMENT.SCOPE).optional(),
  scopeId: z.custom<Types.ObjectId>(),
  archive: z
    .object({
      status: z.boolean().default(false),
      date: z.union([z.date(), z.null()]).default(null),
    })
    .optional(),
});

export type IAnnouncement = z.infer<typeof AnnouncementZodSchema> & Document;

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String, required: true, minLength: 1, maxLength: 100 },
    textBody: { type: String, required: true, minLength: 1, maxLength: 5000 },
    publishDate: { type: Date, default: Date.now },
    isPublished: { type: Boolean, default: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    attachments: [{ type: String }],
    isDeleted: { type: Boolean, default: false },
    scope: {
      type: String,
      enum: config.ENUM.ANNOUNCEMENT.SCOPE,
    },
    scopeId: { type: Schema.Types.ObjectId, refPath: "scope" },
    archive: { status: { type: Boolean, default: false }, date: { type: Date, default: null } },
  },
  { timestamps: true }
);

AnnouncementSchema.index({ title: 1, author: 1 }, { unique: true });

addCascadeDeleteHook(AnnouncementSchema, [{ modelName: "Section", field: "announcements" }]);
const Announcement = mongoose.model<IAnnouncement>("Announcement", AnnouncementSchema);
export default Announcement;
