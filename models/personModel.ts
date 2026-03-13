import mongoose, { Document, Schema } from "mongoose";
import { z } from "zod";
import { ADDRESS_TYPES, CIVIL_STATUS, GENDERS, EMPLOYMENT_STATUS } from "../config/common";

export const PersonSchema = z.object({
  firstName: z.string(),
  middleName: z.string().optional(),
  lastName: z.string(),
  dateOfBirth: z.string().transform((date) => new Date(date)),
  placeOfBirth: z.string(),
  gender: z.enum(GENDERS),
  civilStatus: z.enum(CIVIL_STATUS),
  phoneNumber: z.string(),
  alternativePhone: z.string().optional(),
  relationship: z.string(),
  occupation: z.string(),
  address: z.array(
    z.object({
      type: z.enum(ADDRESS_TYPES),
      region: z.string(),
      province: z.string(),
      city: z.string(),
      barangay: z.string(),
      street: z.string(),
      zipCode: z.string(),
      contactName: z.string(),
      yearsOfStay: z.string().optional(),
      geoLocation: z.object({
        latitude: z.string(),
        longitude: z.string(),
      }),
    })
  ),
  spouse: z
    .object({
      firstName: z.string(),
      middleName: z.string().optional(),
      lastName: z.string(),
      employmentStatus: z.enum(EMPLOYMENT_STATUS),
      income: z.number(),
      phoneNumber: z.string(),
    })
    .optional(),
  archive: z
    .object({ status: z.boolean().default(false), date: z.date().nullable().default(null) })
    .optional(),
});

export type PersonModel = z.infer<typeof PersonSchema> & Document;

const personMongooseSchema = new Schema<PersonModel>(
  {
    firstName: {
      type: String,
      required: true,
    },
    middleName: {
      type: String,
    },
    lastName: {
      type: String,
      required: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    placeOfBirth: {
      type: String,
      required: true,
    },
    gender: {
      type: String,
      enum: GENDERS,
      required: true,
    },
    civilStatus: {
      type: String,
      enum: CIVIL_STATUS,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    alternativePhone: {
      type: String,
    },
    relationship: {
      type: String,
      required: true,
    },
    occupation: {
      type: String,
    },
    address: [
      {
        type: {
          type: String,
          enum: ADDRESS_TYPES,
          required: true,
        },
        region: {
          type: String,
          required: true,
        },
        province: {
          type: String,
          required: true,
        },
        city: {
          type: String,
          required: true,
        },
        barangay: {
          type: String,
          required: true,
        },
        street: {
          type: String,
          required: true,
        },
        zipCode: {
          type: String,
          required: true,
        },
        contactName: {
          type: String,
        },
        yearsOfStay: {
          type: String,
          required: true,
        },
        geoLocation: {
          latitude: {
            type: String,
          },
          longitude: {
            type: String,
          },
        },
      },
    ],
    spouse: {
      firstName: {
        type: String,
      },
      middleName: {
        type: String,
      },
      lastName: {
        type: String,
      },
      employmentStatus: {
        type: String,
        enum: EMPLOYMENT_STATUS,
      },
      income: {
        type: String,
      },
      phoneNumber: {
        type: String,
      },
    },
    archive: { status: { type: Boolean, default: false }, date: { type: Date, default: null } },
  },
  { timestamps: true }
);

export default mongoose.model<PersonModel>("Person", personMongooseSchema);
