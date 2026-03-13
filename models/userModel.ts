import mongoose, { Document, Schema, Types } from "mongoose";
import { GENDERS, USER_ROLE, USER_STATUS } from "../config/common";
import { z } from "zod";
import addCascadeDeleteHook from "../utils/cascadeDeleteHooks";

export const UserZodSchema = z.object({
  _id: z.any().optional(),
  firstName: z
    .string()
    .trim()
    .min(2, "First name is required")
    .max(50, "First name must be at most 50 characters"),
  lastName: z
    .string()
    .trim()
    .min(2, "Last name is required")
    .max(50, "Last name must be at most 50 characters"),
  email: z.string().email("Invalid email format").toLowerCase().max(100),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().min(11, "Phone number must be exactly 11 characters").max(11).optional(),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.enum(GENDERS).optional(),
  avatar: z.string().optional().default(""),
  role: z.enum(USER_ROLE),
  status: z.enum(USER_STATUS).default("active"),
  organizationId: z.union([z.string(), z.instanceof(mongoose.Types.ObjectId)]).optional(),
  isDeleted: z.boolean().default(false),
  resetPasswordToken: z.string().optional(),
  resetPasswordExpires: z.date().optional(),
  isPasswordChanged: z.boolean().optional(),
  passwordChangedAt: z.date().optional(),
  badges: z.array(z.string()).optional().default([]),
  vouchers: z.array(z.string()).optional().default([]),
  lastLogin: z.date().default(() => new Date()),
  archive: z
    .object({
      status: z.boolean().default(false),
      date: z.union([z.date(), z.null()]).default(null),
    })
    .optional(),
});

export interface IUser extends Document, z.infer<typeof UserZodSchema> {
  _id: Types.ObjectId;
}

const UserMongooseSchema = new Schema<IUser>(
  {
    archive: { status: { type: Boolean, default: false }, date: { type: Date, default: null } },
    firstName: { type: String, trim: true, required: true, minLength: 2, maxLength: 50 },
    lastName: { type: String, trim: true, required: true, minLength: 2, maxLength: 50 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxLength: 100,
    },
    password: { type: String, required: true, minLength: 6 },
    phone: { type: String, trim: true, minLength: 11, maxLength: 11 },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: GENDERS },
    avatar: { type: String, default: "" },
    role: {
      type: String,
      enum: USER_ROLE,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: USER_STATUS,
      default: "active",
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
    },
    isDeleted: { type: Boolean, default: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    isPasswordChanged: { type: Boolean, default: false },
    passwordChangedAt: { type: Date, select: false },
    badges: [{ type: String }],
    vouchers: [{ type: String }],
    lastLogin: { type: Date, default: Date.now },
  },
  { timestamps: true, discriminatorKey: "role" }
);

UserMongooseSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate() as any;

  const isArchiving =
    update &&
    ((update.$set && update.$set["archive.status"] === true) || update["archive.status"] === true);

  if (isArchiving) {
    const user = await this.model.findOne(this.getQuery()).select("_id role");

    if (user && user.role === "admin") {
      const Organization = mongoose.model("Organization");
      await Organization.updateMany({ admins: user._id }, { $pull: { admins: user._id } });
    }
  }

  next();
});

addCascadeDeleteHook(UserMongooseSchema, [
  { modelName: "Organization", field: "admins" },
  { modelName: "Organization", field: "students" },
  { modelName: "Organization", field: "instructors" },
]);

const User = mongoose.model<IUser>("User", UserMongooseSchema, "users");

const SuperAdmin = User.discriminator("superadmin", new Schema({}, { discriminatorKey: "role" }));

const Admin = User.discriminator("admin", new Schema({}, { discriminatorKey: "role" }));

export { SuperAdmin, Admin };
export default User;
