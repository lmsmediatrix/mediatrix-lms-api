import mongoose, { Schema, Document } from "mongoose";
import { z } from "zod";

export const AuditLogSchema = z.object({
  _id: z.any().optional(),
  user: z.custom<mongoose.Types.ObjectId>(),
  type: z.enum(["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT"]),
  severity: z.enum(["INFO", "WARNING", "ERROR", "CRITICAL"]),
  entity: z.object({
    type: z.enum([
      "USER",
      "STUDENT",
      "INSTRUCTOR",
      "COURSE",
      "MODULE",
      "SECTION",
      "ASSESSMENT",
      "ASSIGNMENT",
    ]),
    id: z.custom<mongoose.Types.ObjectId>(),
  }),
  changes: z.object({
    before: z.record(z.any()).optional(),
    after: z.record(z.any()).optional(),
  }),
  metadata: z.object({
    userAgent: z.string().optional(),
    ip: z.string().optional(),
    path: z.string().optional(),
    method: z.string().optional(),
  }),
  description: z.string().optional(),
  timestamp: z.date().default(() => new Date()),
  organizationId: z.custom<mongoose.Types.ObjectId>().optional(),
  archive: z
    .object({
      status: z.boolean().default(false),
      date: z.union([z.date(), z.null()]).default(null),
    })
    .optional(),
});

export interface IAuditLog extends Document {
  user: mongoose.Types.ObjectId;
  type: string;
  severity: string;
  entity: {
    type: string;
    id: mongoose.Types.ObjectId;
  };
  changes: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };
  metadata: {
    userAgent?: string;
    ip?: string;
    path?: string;
    method?: string;
  };
  description?: string;
  organizationId?: mongoose.Types.ObjectId;
  timestamp: Date;
  archive?: {
    status: boolean;
    date: Date | null;
  };
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true },
    severity: { type: String, required: true },
    entity: {
      type: { type: String, required: true },
      id: { type: Schema.Types.ObjectId, required: true },
    },
    changes: {
      before: { type: Schema.Types.Mixed },
      after: { type: Schema.Types.Mixed },
    },
    metadata: {
      userAgent: { type: String },
      ip: { type: String },
      path: { type: String },
      method: { type: String },
    },
    description: { type: String },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    timestamp: { type: Date, default: Date.now },
    archive: { status: { type: Boolean, default: false }, date: { type: Date, default: null } },
  },
  {
    timestamps: true,
  }
);

export const AuditLogModel = mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
