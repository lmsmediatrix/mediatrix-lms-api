import mongoose, { Document } from "mongoose";
import { z } from "zod";

const recipientUserSchema = z.object({
  user: z.custom<mongoose.Types.ObjectId>(),
  date: z.date().nullable().default(null),
});

export const NotificationSchema = z.object({
  recipients: z.object({
    read: z.array(recipientUserSchema).default([]),
    unread: z.array(recipientUserSchema).default([]),
  }),
  source: z.custom<mongoose.Types.ObjectId>(),
  category: z.string(),
  title: z.string(),
  description: z.string(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  archive: z
    .object({ status: z.boolean().default(false), date: z.date().nullable().default(null) })
    .optional(),
});

export type NotificationModel = z.infer<typeof NotificationSchema> & Document;

const notificationMongooseSchema = new mongoose.Schema<NotificationModel>(
  {
    recipients: {
      read: [
        {
          user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          date: {
            type: Date,
            default: null,
          },
        },
      ],
      unread: [
        {
          user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          date: {
            type: Date,
            default: Date.now,
          },
        },
      ],
    },
    source: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
    archive: { status: { type: Boolean, default: false }, date: { type: Date, default: null } },
  },
  { timestamps: true }
);

export default mongoose.model<NotificationModel>("Notification", notificationMongooseSchema);
