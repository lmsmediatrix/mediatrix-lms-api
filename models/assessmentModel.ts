import mongoose, { Schema, Types, Document } from "mongoose";
import { config } from "../config/common";
import z from "zod";
import addCascadeDeleteHook from "../utils/cascadeDeleteHooks";

export const QuestionZodSchema = z.object({
  _id: z.number(),
  type: z.enum(config.ENUM.ASSESSMENT.QUESTION_TYPE),
  questionText: z.string().max(500, "Question text cannot exceed 500 characters").optional(),
  questionImage: z.string().optional(),
  questionImageField: z.string().optional(),
  options: z
    .array(
      z.object({
        _id: z.number(),
        option: z
          .enum([
            "Option 1",
            "Option 2",
            "Option 3",
            "Option 4",
            "Option 5",
            "Option 6",
            "Option 7",
            "Option 8",
            "Option 9",
            "Option 10",
          ])
          .optional(),
        text: z.string().max(500, "Option text cannot exceed 500 characters").optional(),
        image: z.string().optional(),
        imageField: z.string().optional(),
        isCorrect: z.boolean().default(false),
      })
    )
    .optional(),
  correctAnswers: z.array(z.string()).optional(),
  maxWords: z.number().optional(),
  points: z.number().min(1, "Points must be at least 1").max(100, "Points cannot exceed 100"),
});

export type IQuestion = z.infer<typeof QuestionZodSchema>;

export const AssessmentZodSchema = z.object({
  _id: z.any().optional(),
  organizationId: z.custom<Types.ObjectId>(),
  section: z.custom<Types.ObjectId>(),
  assessmentNo: z.number().optional(),
  title: z.string().min(1, "Title is required").max(100, "Title cannot exceed 100 characters"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(500, "Description cannot exceed 500 characters")
    .optional(),
  type: z.enum(config.ENUM.ASSESSMENT.TYPE),
  questions: z.array(QuestionZodSchema).optional(),
  numberOfItems: z
    .number()
    .min(1, "Number of items must be at least 1")
    .max(1000, "Number of items cannot exceed 1000")
    .nullable()
    .optional(),
  totalPoints: z
    .number()
    .min(1, "Total points must be at least 1")
    .max(1000, "Total points cannot exceed 1000")
    .nullable()
    .optional(),
  startDate: z.date(),
  endDate: z.date(),
  dueDate: z.string().optional(), //depricated
  passingScore: z.number().max(1000, "Passing score cannot exceed 1000").optional(),
  attemptsAllowed: z.number().min(1).default(1),
  isPublished: z.boolean().default(false),
  author: z.custom<Types.ObjectId>(),
  isDeleted: z.boolean().default(false),
  gradeMethod: z.enum(config.ENUM.ASSESSMENT.GRADEMETHOD),
  timeLimit: z
    .number()
    .min(5, "Time limit must be at least 5 minute")
    .max(7200, "Time limit cannot exceed 7,200 hours")
    .optional(),
  shuffleQuestions: z.boolean().default(false).optional(),
  numberOfQuestionsToShow: z.coerce.number().min(1).optional(),
  archive: z
    .object({
      status: z.boolean().default(false),
      date: z.union([z.date(), z.null()]).default(null),
    })
    .optional(),
});

export type IAssessment = z.infer<typeof AssessmentZodSchema>;

const QuestionSchema = new Schema<IQuestion>(
  {
    _id: { type: Number },
    type: {
      type: String,
      enum: config.ENUM.ASSESSMENT.QUESTION_TYPE,
      required: true,
    },
    questionText: { type: String, required: true },
    questionImage: { type: String, required: false },
    questionImageField: { type: String, required: false },
    options: [
      {
        _id: { type: Number, required: true },
        option: {
          type: String,
          enum: [
            "Option 1",
            "Option 2",
            "Option 3",
            "Option 4",
            "Option 5",
            "Option 6",
            "Option 7",
            "Option 8",
            "Option 9",
            "Option 10",
          ],
          required: true,
        },
        text: { type: String, required: false },
        image: { type: String, required: false },
        imageField: { type: String, required: false },
        isCorrect: { type: Boolean, default: false },
      },
    ],
    correctAnswers: [{ type: String }],
    maxWords: { type: Number, required: false },
    points: { type: Number, required: true },
  },
  { _id: false, strict: true }
);

const AssessmentSchema = new Schema<IAssessment>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    assessmentNo: { type: Number },
    section: { type: Schema.Types.ObjectId, ref: "Section", required: true },
    title: { type: String, required: true },
    description: { type: String, minLength: 1, maxLength: 500 },
    type: {
      type: String,
      enum: config.ENUM.ASSESSMENT.TYPE,
      required: true,
    },
    questions: [QuestionSchema],
    numberOfItems: { type: Number, min: 1, max: 1000 },
    totalPoints: { type: Number, min: 1, max: 1000 },
    startDate: { type: Date },
    endDate: { type: Date },
    dueDate: { type: String },
    passingScore: { type: Number, max: 1000 },
    attemptsAllowed: { type: Number, default: 1 },
    isPublished: { type: Boolean, default: false },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isDeleted: { type: Boolean, default: false },
    gradeMethod: { type: String, enum: config.ENUM.ASSESSMENT.GRADEMETHOD, required: true },
    timeLimit: { type: Number, min: 5, max: 7200 },
    shuffleQuestions: { type: Boolean, default: false },
    numberOfQuestionsToShow: { type: Number },
    archive: { status: { type: Boolean, default: false }, date: { type: Date, default: null } },
  },
  {
    timestamps: true,
    strict: true,
    toObject: {
      transform: function (doc, ret) {
        // Ensure unique option IDs when converting to plain object
        if (ret.questions && Array.isArray(ret.questions)) {
          let nextOptionId = 1;
          ret.questions.forEach((question) => {
            if (question.options && Array.isArray(question.options)) {
              question.options.forEach((option: { _id: number }) => {
                option._id = nextOptionId++;
              });
            }
          });
        }
        return ret;
      },
    },
    toJSON: {
      transform: function (doc, ret) {
        // Ensure unique option IDs when converting to JSON
        if (ret.questions && Array.isArray(ret.questions)) {
          let nextOptionId = 1;
          ret.questions.forEach((question) => {
            if (question.options && Array.isArray(question.options)) {
              question.options.forEach((option: { _id: number }) => {
                option._id = nextOptionId++;
              });
            }
          });
        }
        return ret;
      },
    },
  }
);

AssessmentSchema.pre<Document & IAssessment>("validate", function (next) {
  if (this.questions && Array.isArray(this.questions)) {
    const optionIds = new Set<number>();
    const duplicateIdsFound = new Set<number>();
    this.questions.forEach((question) => {
      if (question.options && Array.isArray(question.options)) {
        question.options.forEach((option) => {
          if (typeof option._id === "number") {
            if (optionIds.has(option._id)) {
              duplicateIdsFound.add(option._id);
            } else {
              optionIds.add(option._id);
            }
          }
        });
      }
    });
    if (duplicateIdsFound.size > 0) {
      /* console.warn(
        `[Validation] Found duplicate option IDs in incoming data: ${Array.from(
          duplicateIdsFound
        ).join(", ")}. The pre('save') hook will handle renumbering if necessary.`
      ); */
    }
  }
  next();
});

AssessmentSchema.pre<Document & IAssessment>(
  "save",
  async function (this: Document & IAssessment, next) {
    // Option ID generation logic
    if (this.questions && Array.isArray(this.questions)) {
      let maxOptionId = 0;
      // First pass: determine the maximum existing option ID
      this.questions.forEach((question) => {
        if (question.options && Array.isArray(question.options)) {
          question.options.forEach((option) => {
            if (typeof option._id === "number") {
              maxOptionId = Math.max(maxOptionId, option._id);
            }
          });
        }
      });

      const assignedThisPass = new Set<number>();
      // Second pass: ensure all options have unique IDs
      this.questions.forEach((question) => {
        if (question.options && Array.isArray(question.options)) {
          question.options.forEach((option) => {
            if (typeof option._id !== "number" || assignedThisPass.has(option._id)) {
              // If ID is not a number, or it's a number but we've already assigned/seen it
              // for another option in this same assessment during this save operation (a duplicate).
              maxOptionId++;
              option._id = maxOptionId;
            }
            assignedThisPass.add(option._id); // Record this option's ID as used (either original or newly assigned)
          });
        }
      });
    }

    // Assessment Number generation logic
    if (this.isNew && !this.assessmentNo && this.section) {
      try {
        const AssessmentModel = mongoose.model<IAssessment>("Assessment"); // Use a different name from Schema
        const existingAssessments = await AssessmentModel.find({
          section: this.section,
          type: this.type,
          isDeleted: false,
        }).lean();
        this.assessmentNo = existingAssessments.length + 1;
      } catch (error) {
        console.error("Error setting assessmentNo:", error);
      }
    }
    next();
  }
);

addCascadeDeleteHook(AssessmentSchema, [{ modelName: "Section", field: "assessments" }]);

AssessmentSchema.index({ title: 1, organizationId: 1 }, { unique: true });

export default mongoose.model<IAssessment>("Assessment", AssessmentSchema);
