import mongoose from "mongoose";
import dotenv from "dotenv";
import * as bcrypt from "bcrypt";
import User from "../models/userModel";
import Organization from "../models/organizationModel";
import { config } from "../config/common";

dotenv.config();

const connectDB = async () => {
  try {
    // Using the URI from your config
    const uri = process.env.DB_URI || config.DB.URI;
    await mongoose.connect(uri);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
};

const createOrganizations = async () => {
  try {
    // Create University Organization
    const universityOrg = await Organization.create({
      name: "Uzaro University",
      description:
        "A leading educational institution providing quality higher education and research opportunities for students worldwide.",
      code: "UU",
      type: "school",
      admins: [],
      students: [],
      instructors: [],
      courses: [],
      plan: "premium",
      status: "active",
      branding: {
        logo: "",
        coverPhoto: "",
        font: "Roboto",
        colors: {
          primary: "#1e40af",
          secondary: "#64748b",
          accent: "#f59e0b",
          success: "#10b981",
          warning: "#f59e0b",
          danger: "#ef4444",
          info: "#3b82f6",
          light: "#f8fafc",
          dark: "#1e293b",
          neutral: "#6b7280",
        },
      },
      transactions: [],
      isDeleted: false,
      archive: {
        status: false,
        date: null,
      },
    });

    // Create Corporate Organization
    const corporateOrg = await Organization.create({
      name: "Uzaro Corporate Solutions",
      description:
        "A premier corporate training and professional development company specializing in enterprise learning solutions and workforce development.",
      code: "UCS",
      type: "corporate",
      admins: [],
      students: [],
      instructors: [],
      courses: [],
      plan: "enterprise",
      status: "active",
      branding: {
        logo: "",
        coverPhoto: "",
        font: "Montserrat",
        colors: {
          primary: "#059669",
          secondary: "#64748b",
          accent: "#dc2626",
          success: "#10b981",
          warning: "#f59e0b",
          danger: "#ef4444",
          info: "#3b82f6",
          light: "#f8fafc",
          dark: "#1e293b",
          neutral: "#6b7280",
        },
      },
      transactions: [],
      isDeleted: false,
      archive: {
        status: false,
        date: null,
      },
    });

    console.log("✅ Successfully created organizations");
    return { universityOrg, corporateOrg };
  } catch (error) {
    console.error("Error creating organizations:", error);
    throw error;
  }
};

const createUsers = async (universityOrgId: string, corporateOrgId: string) => {
  try {
    const hashedPassword = await bcrypt.hash("Test123!", config.BCRYPT.SALT_ROUNDS);

    // Create Super Admin
    const superAdmin = await User.create({
      firstName: "Super",
      lastName: "Admin",
      email: "uz-admin@gmail.com",
      password: hashedPassword,
      role: "superadmin",
      status: "active",
      isDeleted: false,
      lastLogin: new Date(),
      archive: {
        status: false,
        date: null,
      },
    });

    // Create University Admin
    const universityAdmin = await User.create({
      firstName: "University",
      lastName: "Admin",
      email: "uzaro-university@gmail.com",
      password: hashedPassword,
      role: "admin",
      status: "active",
      organizationId: universityOrgId,
      isDeleted: false,
      lastLogin: new Date(),
      archive: {
        status: false,
        date: null,
      },
    });

    // Create Corporate Admin
    const corporateAdmin = await User.create({
      firstName: "Corporate",
      lastName: "Admin",
      email: "uzaro-corporate@gmail.com",
      password: hashedPassword,
      role: "admin",
      status: "active",
      organizationId: corporateOrgId,
      isDeleted: false,
      lastLogin: new Date(),
      archive: {
        status: false,
        date: null,
      },
    });

    console.log("✅ Successfully created users");
    return { superAdmin, universityAdmin, corporateAdmin };
  } catch (error) {
    console.error("Error creating users:", error);
    throw error;
  }
};

const updateOrganizations = async (
  universityOrgId: string,
  corporateOrgId: string,
  universityAdminId: string,
  corporateAdminId: string
) => {
  try {
    // Update University Organization with admin
    await Organization.findByIdAndUpdate(universityOrgId, {
      $push: { admins: universityAdminId },
    });

    // Update Corporate Organization with admin
    await Organization.findByIdAndUpdate(corporateOrgId, {
      $push: { admins: corporateAdminId },
    });

    console.log("✅ Successfully updated organizations with admin references");
  } catch (error) {
    console.error("Error updating organizations:", error);
    throw error;
  }
};

const seedUsers = async () => {
  try {
    await connectDB();

    console.log("🌱 Starting user seeding process...");

    // Create organizations first
    const { universityOrg, corporateOrg } = await createOrganizations();

    // Create users
    const { superAdmin, universityAdmin, corporateAdmin } = await createUsers(
      universityOrg._id.toString(),
      corporateOrg._id.toString()
    );

    // Update organizations with admin references
    await updateOrganizations(
      universityOrg._id.toString(),
      corporateOrg._id.toString(),
      universityAdmin._id.toString(),
      corporateAdmin._id.toString()
    );

    console.log("\n🎉 User seeding completed successfully!");
    console.log("\n📋 Created Users:");
    console.log(`   • Super Admin: ${superAdmin.email} (Role: ${superAdmin.role})`);
    console.log(
      `   • University Admin: ${universityAdmin.email} (Role: ${universityAdmin.role}, Org: ${universityOrg.name})`
    );
    console.log(
      `   • Corporate Admin: ${corporateAdmin.email} (Role: ${corporateAdmin.role}, Org: ${corporateOrg.name})`
    );
    console.log("\n🔑 All users have password: Test123!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

seedUsers();
