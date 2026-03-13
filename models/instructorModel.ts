import mongoose, { Document, Schema } from "mongoose";
import { z } from "zod";
import User, { IUser, UserZodSchema } from "./userModel";
import { EMPLOYMENT_TYPE } from "../config/common";
import addCascadeDeleteHook from "../utils/cascadeDeleteHooks";

export const InstructorZodSchema = UserZodSchema.extend({
  bio: z.string().trim().max(500, "Bio must be at most 500 characters").optional(),
  expertise: z.array(z.string().trim()).optional(),
  qualifications: z.array(z.string().trim().min(1, "Qualification cannot be empty")).optional(),
  experienceYears: z.number().int().min(0, "Experience cannot be negative").default(0),
  ratings: z.object({
    average: z
      .number()
      .min(0, "Rating must be at least 0")
      .max(5, "Rating cannot exceed 5")
      .default(0),
    total_reviews: z.number().int().min(0, "Total reviews cannot be negative").default(0),
  }),
  socialLinks: z
    .object({
      linkedIn: z.string().url("Invalid LinkedIn URL").optional(),
      twitter: z.string().url("Invalid Twitter URL").optional(),
      website: z.string().url("Invalid Website URL").optional(),
    })
    .optional(),
  faculty: z.custom<mongoose.Types.ObjectId>().optional(),
  employmentType: z.enum(EMPLOYMENT_TYPE).default(EMPLOYMENT_TYPE[2]),
  isVerified: z.boolean().default(false),
  archive: z
    .object({
      status: z.boolean().default(false),
      date: z.union([z.date(), z.null()]).default(null),
    })
    .optional(),
});

export type IInstructor = z.infer<typeof InstructorZodSchema> & IUser & Document;

const InstructorSchema = new mongoose.Schema<IInstructor>(
  {
    bio: { type: String, trim: true },
    expertise: [{ type: String }],
    qualifications: [{ type: String }],
    experienceYears: { type: Number, default: 0 },
    ratings: {
      average: { type: Number, default: 0 },
      total_reviews: { type: Number, default: 0 },
    },
    socialLinks: {
      linkedIn: { type: String, trim: true },
      twitter: { type: String, trim: true },
      website: { type: String, trim: true },
    },
    faculty: {
      type: Schema.Types.ObjectId,
      ref: "Faculty",
    },
    employmentType: { type: String, enum: EMPLOYMENT_TYPE, default: EMPLOYMENT_TYPE[2] },
    isVerified: { type: Boolean, default: false },
    archive: { status: { type: Boolean, default: false }, date: { type: Date, default: null } },
  },
  { timestamps: true }
);
addCascadeDeleteHook(InstructorSchema, [
  { modelName: "Section", field: "instructor", isArray: false },
]);
const Instructor = User.discriminator<IInstructor>("instructor", InstructorSchema);
export default Instructor;
