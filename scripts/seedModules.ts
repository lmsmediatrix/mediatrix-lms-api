import { faker } from "@faker-js/faker";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Module from "../models/moduleModel";
import Section from "../models/sectionModel";
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

const generateModules = async (sectionCode: string, count: number) => {
  try {
    const section = await Section.findOne({ code: sectionCode });
    if (!section) {
      throw new Error(`Section with code ${sectionCode} not found`);
    }

    const modules = Array.from({ length: count }, () => {
      return {
        title:
          faker.helpers.arrayElement([
            "Introduction to",
            "Fundamentals of",
            "Advanced",
            "Principles of",
            "Exploring",
            "Understanding",
            "Mastering",
            "Concepts in",
          ]) +
          " " +
          faker.word.noun({ length: { min: 3, max: 10 } }),
        description: faker.lorem.paragraph(),
        organizationId: section.organizationId,
        isPublished: faker.datatype.boolean({ probability: 0.8 }),
        lessons: [], // Initially empty, would be populated later
      };
    });

    const createdModules = await Module.insertMany(modules);

    // Update section with new module IDs
    await Section.findByIdAndUpdate(section._id, {
      $push: { modules: { $each: createdModules.map((m) => m._id) } },
    });

    console.log(
      `✅ Successfully created ${createdModules.length} modules for section ${sectionCode}`
    );
    return createdModules;
  } catch (error) {
    console.error("Error generating modules:", error);
    throw error;
  }
};

const seedModules = async () => {
  try {
    await connectDB();
    await generateModules("SEC003", 10);
    console.log("Module seeding completed!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
};

seedModules();
