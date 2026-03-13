import { faker } from "@faker-js/faker";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Assessment from "../models/assessmentModel";
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

const generateQuestions = (count: number) => {
  return Array.from({ length: count }, () => {
    const questionType = faker.helpers.arrayElement(config.ENUM.ASSESSMENT.QUESTION_TYPE);
    const baseQuestion = {
      type: questionType,
      questionText: faker.lorem.sentence(),
      points: faker.number.int({ min: 5, max: 20 }),
    };

    if (questionType === "multiple_choice") {
      const correctOptionIndex = faker.number.int({ min: 0, max: 3 });
      return {
        ...baseQuestion,
        options: ["Option 1", "Option 2", "Option 3", "Option 4"].map((option, index) => ({
          option,
          text: faker.lorem.sentence(),
          isCorrect: index === correctOptionIndex,
        })),
      };
    }

    return baseQuestion;
  });
};

const generateAssessments = async (sectionCode: string, count: number) => {
  try {
    const section = await Section.findOne({ code: sectionCode });
    if (!section) {
      throw new Error(`Section with code ${sectionCode} not found`);
    }

    const assessments = Array.from({ length: count }, () => {
      const startDate = faker.date.future();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + faker.number.int({ min: 1, max: 14 }));

      const questions = generateQuestions(faker.number.int({ min: 5, max: 15 }));
      const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

      return {
        organizationId: section.organizationId,
        section: section._id,
        title:
          faker.helpers.arrayElement([
            "Midterm Examination",
            "Final Quiz",
            "Chapter Assessment",
            "Progress Test",
            "Skills Evaluation",
            "Knowledge Check",
            "Concept Review",
            "Unit Test",
          ]) +
          " " +
          faker.number.int({ min: 1, max: 5 }),
        description: faker.lorem.paragraph(),
        type: faker.helpers.arrayElement(config.ENUM.ASSESSMENT.TYPE),
        questions,
        numberOfItems: questions.length,
        totalPoints,
        startDate,
        endDate,
        passingScore: Math.ceil(totalPoints * 0.6),
        attemptsAllowed: faker.number.int({ min: 1, max: 3 }),
        isPublished: faker.datatype.boolean({ probability: 0.7 }),
        author: section.instructor,
        gradeMethod: faker.helpers.arrayElement(config.ENUM.ASSESSMENT.GRADEMETHOD),
        timeLimit: faker.number.int({ min: 30, max: 180 }),
        isDeleted: false,
      };
    });

    const createdAssessments = await Assessment.insertMany(assessments);

    // Update section with new assessment IDs
    await Section.findByIdAndUpdate(section._id, {
      $push: { assessments: { $each: createdAssessments.map((a) => a._id) } },
    });

    console.log(
      `✅ Successfully created ${createdAssessments.length} assessments for section ${sectionCode}`
    );
    return createdAssessments;
  } catch (error) {
    console.error("Error generating assessments:", error);
    throw error;
  }
};

const seedAssessments = async () => {
  try {
    await connectDB();
    await generateAssessments("SEC003", 30);
    console.log("Assessment seeding completed!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
};

seedAssessments();
