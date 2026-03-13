import mongoose, { Document, Schema } from "mongoose";

export interface IActivityLogging extends Document {
  userId: mongoose.Types.ObjectId;
  headers: {
    "user-agent"?: string;
  };
  ip: string;
  path: string;
  method: string;
  page?: {
    url?: string;
    title?: string;
  };
  action: string;
  description: string;
  createdAt: Date;
  organizationId?: mongoose.Types.ObjectId;
  entityType?: string;
  archive?: {
    status: boolean;
    date: Date | null;
  };
}

const activityLoggingSchema: Schema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    headers: {
      "user-agent": {
        type: String,
        default: null,
      },
    },
    ip: {
      type: String,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    method: {
      type: String,
      required: true,
    },
    page: {
      url: {
        type: String,
        default: null,
      },
      title: {
        type: String,
        default: null,
      },
    },
    action: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    entityType: {
      type: String,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    archive: {
      status: { type: Boolean, default: false },
      date: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

export default mongoose.model<IActivityLogging>(
  "ActivityLogging",
  activityLoggingSchema,
  "activityLogging"
);
