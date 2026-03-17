import { FilterQuery, UpdateQuery } from "mongoose";
import { config } from "../config/common";
import { IAssessment } from "../models/assessmentModel";
import assessmentRepository from "../repository/assessmentRepository";
import sectionRepository from "../repository/sectionRepository";
import cloudinaryService from "../services/cloudinaryService";
import { Types } from "mongoose";
import Student from "../models/studentModel";
import { PopulatedStudent } from "../helper/types";
import { generatePagination } from "../utils/paginationUtils";
import studentRepository from "../repository/studentRepository";
import studentAssessmentGradeRepository from "../repository/studentAssessmentGradeRepository";
import {
  formatAssessmentDate,
  processResponses,
  processAssessmentQuestions,
} from "../utils/assessmentUtils";
import notificationService from "./notificationService";
import NOTIFICATION_TEMPLATES from "../config/templateConfig";
import { USER_ROLES } from "../config/common";
import mongoose from "mongoose";

const assessmentService = {
  getAssessment,
  getAssessments,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  searchAssessment,
  submitAssessment,
  getSectionAssessmentStudents,
  getStudentAssessmentResult,
  updateStudentAssessmentResult,
  archiveAssessment,
};

export default assessmentService;

async function getAssessment(
  id: string,
  params: any,
  userRole?: string
): Promise<IAssessment | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.GET);
  }

  try {
    const dbParams: any = { query: {}, options: {} };

    const userSelectedFields =
      params.select && Array.isArray(params.select) && params.select.length > 0
        ? (params.select as string[])
        : [];

    let wasQuestionsFieldActuallyRequestedByUser = false;
    if (userSelectedFields.length > 0) {
      wasQuestionsFieldActuallyRequestedByUser = userSelectedFields.some(
        (field: string) => field === "questions" || field.startsWith("questions.")
      );
    } else {
      wasQuestionsFieldActuallyRequestedByUser = true;
    }

    const serviceProcessingRequirements = new Set<string>([
      "questions",
      "shuffleQuestions",
      "numberOfQuestionsToShow",
      "totalPoints",
      "numberOfItems",
      "passingScore",
      "attemptsAllowed",
    ]);

    let finalSelectForDB: string[] = [];

    if (userSelectedFields.length > 0) {
      const userRequestedQuestionSubPaths = userSelectedFields.filter((f) =>
        f.startsWith("questions.")
      );
      const userRequestedTopLevelQuestions = userSelectedFields.includes("questions");

      userSelectedFields.forEach((field) => {
        if (field !== "questions" && !field.startsWith("questions.")) {
          finalSelectForDB.push(field);
        }
      });

      serviceProcessingRequirements.forEach((reqField) => {
        if (reqField === "questions") {
          if (userRequestedQuestionSubPaths.length > 0) {
            userRequestedQuestionSubPaths.forEach((subPath) => finalSelectForDB.push(subPath));
          } else if (userRequestedTopLevelQuestions) {
            finalSelectForDB.push("questions");
          } else {
            finalSelectForDB.push("questions");
          }
        } else if (
          !finalSelectForDB.includes(reqField) &&
          !userSelectedFields.some((f) => f === `-${reqField}`)
        ) {
          finalSelectForDB.push(reqField);
        }
      });
      finalSelectForDB = Array.from(new Set(finalSelectForDB));
    } else {
      finalSelectForDB = [];
    }

    if (finalSelectForDB.length > 0) {
      dbParams.options.select = finalSelectForDB.join(" ");
    }

    if (params.populateArray) {
      dbParams.options.populateArray = params.populateArray;
    }
    if (params.lean !== undefined) {
      dbParams.options.lean = params.lean;
    } else {
      dbParams.options.lean = true;
    }

    let assessment = await assessmentRepository.getAssessment(id, dbParams);

    if (params.studentId && assessment) {
      try {
        const student = await studentRepository.getStudent(params.studentId, {
          options: { select: "studentAssessmentResults", lean: true },
        });
        if (student) {
          const assessmentResult = student.studentAssessmentResults?.find(
            (result) => result.assessmentId.toString() === id && !result.isDeleted
          );
          const attemptsAllowed = (assessment as IAssessment).attemptsAllowed || 1;
          (assessment as any).remainingAttempts = assessmentResult
            ? assessmentResult.attemptNumber
            : attemptsAllowed;
        }
      } catch (err) {
        console.error("Error fetching student data for remaining attempts:", err);
      }
    }

    if (assessment) {
      assessment = processAssessmentQuestions(assessment, userRole);
    }

    if (assessment && !wasQuestionsFieldActuallyRequestedByUser) {
      delete (assessment as any).questions;
    }

    return assessment;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getAssessments(
  params: any
): Promise<{ assessment: IAssessment[]; pagination: any; count?: number }> {
  if (!params) {
    throw new Error(config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.GET_ALL);
  }

  try {
    const dbParams: any = { query: {}, options: {} };

    if (
      params.queryArray &&
      params.queryArray.length > 0 &&
      params.queryArrayType &&
      params.queryArrayType.length > 0
    ) {
      const queryArray = Array.isArray(params.queryArray) ? params.queryArray : [params.queryArray];
      const queryArrayType = Array.isArray(params.queryArrayType)
        ? params.queryArrayType
        : [params.queryArrayType];

      const queryConditions = queryArrayType.map((type: string | number) => {
        const trimmedType = String(type).trim();
        return { [trimmedType]: { $in: queryArray } };
      });

      queryConditions.forEach((condition: any) => {
        dbParams.query = { ...dbParams.query, ...condition };
      });
    }

    if (params.populateArray) {
      dbParams.options.populateArray = params.populateArray;
    }

    if (params.sort) {
      dbParams.options.sort = params.sort;
    }
    if (params.limit) {
      dbParams.options.limit = params.limit;
    }
    const limit = params.limit || 10;
    const skip = params.skip || 0;
    dbParams.options.limit = limit;
    dbParams.options.skip = skip * limit;

    if (params.select) {
      if (!Array.isArray(params.select)) {
        params.select = [params.select];
      }
      dbParams.options.select = params.select.join(" ");
    }
    if (params.lean !== undefined) {
      dbParams.options.lean = params.lean;
    }

    const page = params.page || 1;

    const [assessmentList, count] = await Promise.all([
      assessmentRepository.getAssessments(dbParams),
      assessmentRepository.assessmentCount(dbParams.query),
    ]);

    const processedAssessments = assessmentList.map((assessment) =>
      processAssessmentQuestions(assessment)
    );

    const pagination = generatePagination(count, page, limit);

    return {
      ...(params.document && { assessment: processedAssessments }),
      ...(params.pagination && { pagination }),
      ...(params.count && { count }),
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function createAssessment(
  data: Partial<IAssessment> & { path: string },
  user: any,
  files?: { [fieldname: string]: Express.Multer.File[] }
): Promise<IAssessment> {
  if (!data) {
    throw new Error(config.ERROR.USER.REQUIRED_FIELDS);
  }

  try {
    const trimmedData = { ...data };
    for (const key in trimmedData) {
      if (typeof (trimmedData as any)[key] === "string") {
        (trimmedData as any)[key] = ((trimmedData as any)[key] as string).trim();
      }
    }

    if (trimmedData.startDate && trimmedData.endDate) {
      const startDate = new Date(trimmedData.startDate);
      const endDate = new Date(trimmedData.endDate);

      if (startDate > endDate) {
        throw new Error("Start date cannot be later than end date");
      }
    }

    if (trimmedData.questions && Array.isArray(trimmedData.questions)) {
      for (let i = 0; i < trimmedData.questions.length; i++) {
        trimmedData.questions[i] = {
          ...trimmedData.questions[i],
          _id: i + 1,
        };

        const question = trimmedData.questions[i];
        if (question && question.options && Array.isArray(question.options)) {
          for (let j = 0; j < question.options.length; j++) {
            if (question.options[j]) {
              question.options[j] = {
                ...question.options[j],
                _id: j + 1,
              };
            }
          }
        }
      }
    }

    if (files) {
      if (
        trimmedData.questions &&
        Array.isArray(trimmedData.questions) &&
        Object.keys(files).length > 0
      ) {
        const folderPath = `${trimmedData.path}`;

        for (let i = 0; i < trimmedData.questions.length; i++) {
          const question = trimmedData.questions[i] as {
            _id?: string | { toString(): string } | number;
            questionImageField?: string;
            options?: any[];
          } & (typeof trimmedData.questions)[0];

          if (question.questionImageField) {
            if (files[question.questionImageField] && files[question.questionImageField][0]) {
              const file = files[question.questionImageField][0];
              try {
                const uploadedUrl = await cloudinaryService.uploadImage(file, `${folderPath}`);
                trimmedData.questions[i].questionImage = uploadedUrl;
                delete trimmedData.questions[i].questionImageField;
              } catch (error) {
                console.log("Error uploading question image:", error);
              }
            }
          }

          if (question.options && Array.isArray(question.options)) {
            for (let j = 0; j < question.options.length; j++) {
              const option = question.options[j] as { imageField?: string };

              if (option.imageField) {
                if (files[option.imageField] && files[option.imageField][0]) {
                  const file = files[option.imageField][0];
                  try {
                    const uploadedUrl = await cloudinaryService.uploadImage(file, folderPath);

                    const options = trimmedData.questions[i]?.options;
                    if (options && j < options.length) {
                      const currentOption = options[j];
                      if (currentOption) {
                        currentOption.image = uploadedUrl;
                        delete currentOption.imageField;
                      }
                    }
                  } catch (error) {
                    console.log("Error uploading option image:", error);
                  }
                }
              }
            }
          }
        }
      }
    }

    const questionsToUse = trimmedData.questions || [];
    let calcNumberOfItems = 0;
    let calcTotalPoints = 0;

    if (Array.isArray(questionsToUse) && questionsToUse.length > 0) {
      if (
        typeof trimmedData.numberOfQuestionsToShow === "number" &&
        trimmedData.numberOfQuestionsToShow > 0 &&
        trimmedData.numberOfQuestionsToShow < questionsToUse.length
      ) {
        calcNumberOfItems = trimmedData.numberOfQuestionsToShow;
        const questionsToConsider = questionsToUse.slice(0, trimmedData.numberOfQuestionsToShow);
        calcTotalPoints = questionsToConsider.reduce((sum, q) => sum + (q.points || 0), 0);
      } else {
        calcNumberOfItems = questionsToUse.length;
        calcTotalPoints = questionsToUse.reduce((sum, q) => sum + (q.points || 0), 0);
      }
    }

    if (data.shuffleQuestions === true) {
      trimmedData.numberOfItems = data.numberOfItems;
      trimmedData.totalPoints = data.totalPoints;
    } else {
      trimmedData.numberOfItems = data.numberOfItems ?? calcNumberOfItems;
      trimmedData.totalPoints = data.totalPoints ?? calcTotalPoints;
    }
    trimmedData.passingScore = data.passingScore ?? Math.ceil((trimmedData.totalPoints || 0) * 0.6);

    trimmedData.author = user.id;

    const newAssessment = await assessmentRepository.createAssessment(trimmedData);

    await sectionRepository.updateSection(
      { _id: trimmedData.section },
      {
        $push: {
          assessments: newAssessment._id,
        },
      }
    );
    if (!trimmedData.section) throw new Error("Section ID is required");
    const section = await sectionRepository.getSection(trimmedData.section.toString(), {
      options: {
        select: "_id instructor students name code",
        populateArray: [
          { path: "instructor", select: "_id firstName lastName" },
          { path: "students", select: "_id firstName lastName" },
        ],
        lean: true,
      },
    });
    if (section && section.instructor && section.students && section.students.length > 0) {
      await notificationService.sendNotification({
        query: { _id: { $in: section.students.map((student: any) => student._id) } },
        sectionId: section._id.toString(),
        notification: {
          category: "ASSESSMENT",
          source: section.instructor._id,
          recipients: {
            read: [],
            unread: section.students.map((student) => ({
              user: new mongoose.Types.ObjectId(student._id),
              date: null,
            })),
          },
          metadata: (_params: any) => ({
            path: `/student/sections/${section.code}?tab=assessments&id=${newAssessment._id}`,
            assessment: {
              title: newAssessment.title,
            },
          }),
        },
        template: NOTIFICATION_TEMPLATES.ASSESSMENT.NEW,
        type: "student",
      });
    }

    return newAssessment;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function updateAssessment(
  data: Partial<IAssessment> & { path?: string },
  files?: { [fieldname: string]: Express.Multer.File[] }
): Promise<IAssessment | null> {
  if (!data) {
    throw new Error(config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.UPDATE);
  }

  try {
    const filter: FilterQuery<IAssessment> = { _id: data._id };
    const update: UpdateQuery<IAssessment> = { ...data };

    if (files) {
      const existingAssessment = await assessmentRepository.getAssessment(data._id as string, {
        options: {
          lean: true,
          select: "title description startDate endDate questions attemptsAllowed gradeMethod",
        },
      });

      if (!existingAssessment) {
        throw new Error("Assessment not found");
      }

      const folderPath = data.path;

      let highestOptionId = 0;

      if (existingAssessment.questions && Array.isArray(existingAssessment.questions)) {
        existingAssessment.questions.forEach((question) => {
          if (question.options && Array.isArray(question.options)) {
            question.options.forEach((option) => {
              if (typeof option._id === "number" && option._id > highestOptionId) {
                highestOptionId = option._id;
              }
            });
          }
        });
      }

      if (update.questions && Array.isArray(update.questions)) {
        for (let i = 0; i < update.questions.length; i++) {
          const question = update.questions[i];
          const existingQuestion =
            existingAssessment.questions?.find(
              (q) => q._id.toString() === question._id?.toString()
            ) || null;

          if (existingQuestion) {
            update.questions[i]._id = existingQuestion._id;
          }

          if (question.questionImageField && files[question.questionImageField]?.[0]) {
            const uploadedUrl = await cloudinaryService.uploadImage(
              files[question.questionImageField][0],
              folderPath
            );
            update.questions[i].questionImage = uploadedUrl;
            delete update.questions[i].questionImageField;
          }

          if (question.options && Array.isArray(question.options)) {
            for (let j = 0; j < question.options.length; j++) {
              const option = question.options[j];
              const existingOption = existingQuestion?.options?.find(
                (o) => o._id.toString() === option._id?.toString()
              );

              if (existingOption) {
                update.questions[i].options[j]._id = existingOption._id;
              } else {
                highestOptionId++;
                update.questions[i].options[j]._id = highestOptionId;
              }

              if (option.imageField && files[option.imageField]?.[0]) {
                const uploadedUrl = await cloudinaryService.uploadImage(
                  files[option.imageField][0],
                  folderPath
                );
                update.questions[i].options[j].image = uploadedUrl;
                delete update.questions[i].options[j].imageField;
              }
            }
          }
        }
      }
    }

    if (update.questions && Array.isArray(update.questions)) {
      const questionsForCalc = update.questions;
      let calculatedNumItems: number;
      let calculatedTotalPoints: number;

      const NOQTS_in_update = update.numberOfQuestionsToShow;

      if (
        typeof NOQTS_in_update === "number" &&
        NOQTS_in_update > 0 &&
        NOQTS_in_update < questionsForCalc.length
      ) {
        const slicedQuestions = questionsForCalc.slice(0, NOQTS_in_update);
        calculatedNumItems = slicedQuestions.length;
        calculatedTotalPoints = slicedQuestions.reduce((sum, q) => sum + (q.points || 0), 0);
      } else {
        calculatedNumItems = questionsForCalc.length;
        calculatedTotalPoints = questionsForCalc.reduce((sum, q) => sum + (q.points || 0), 0);
      }

      if (typeof data.numberOfItems === "undefined") {
        update.numberOfItems = calculatedNumItems;
      }
      if (typeof data.totalPoints === "undefined") {
        update.totalPoints = calculatedTotalPoints;
      }
    }

    if (typeof update.totalPoints === "number" && typeof data.passingScore === "undefined") {
      update.passingScore = Math.ceil(update.totalPoints * 0.6);
    }

    const updatedAssessment = await assessmentRepository.updateAssessment(filter, update);

    return updatedAssessment;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function deleteAssessment(id: string): Promise<IAssessment | null> {
  if (!id) {
    throw new Error(config.RESPONSE.ERROR.LESSON.INVALID_PARAMETER.REMOVE);
  }

  try {
    return await assessmentRepository.archiveAssessment(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function searchAssessment(params: any): Promise<any> {
  try {
    const dbParams: {
      query: any;
      populateArray: any[];
      options: any;
      lean: boolean;
      match: any;
      includeArchived?: boolean | string;
      archivedOnly?: boolean;
      pagination?: boolean;
      document?: boolean;
    } = {
      query: {},
      populateArray: [],
      options: {},
      lean: true,
      match: {},
      includeArchived: params.includeArchived,
      archivedOnly: params.archivedOnly,
    };

    dbParams.query = params.query || {};

    if (params.archivedOnly === true) {
      dbParams.query["archive.status"] = true;
      dbParams.includeArchived = true;
    }

    if (params.match) {
      dbParams.query = { ...dbParams.query, ...params.match };
    }

    if (params.populateArray) {
      dbParams["populateArray"] = params.populateArray;
    }

    const optionsObj = {
      sort: params.sort || "-createdAt",
      skip: params.skip * params.limit || 0,
      select: params.select || "_id",
      limit: params.limit || 10,
    };

    dbParams.options = optionsObj;
    dbParams.lean = params.lean ?? true;

    const skip = params.skip || 0;
    const [assessments, count] = await Promise.all([
      assessmentRepository.searchAssessment(dbParams),
      params.pagination || params.count
        ? assessmentRepository.assessmentCount(dbParams.query)
        : Promise.resolve(0),
    ]);

    if (!params.pagination) {
      return params.count ? { assessments, count } : assessments;
    }

    const pagination = generatePagination(count, skip + 1, optionsObj.limit);
    return {
      ...(params.document && { assessments }),
      ...(params.pagination && { pagination }),
      ...(params.count && { count }),
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function submitAssessment(data: {
  studentId?: string;
  assessmentId: string;
  answers?: Array<{ questionId: string | number; answer: string | string[] }>;
  startTime?: string;
}): Promise<any> {
  if (!data.assessmentId) {
    throw new Error("Missing required field: assessmentId");
  }

  try {
    const [rawAssessment, student] = await Promise.all([
      assessmentRepository.getAssessment(data.assessmentId, {
        options: {
          lean: true,
          select:
            "_id questions totalPoints passingScore endDate dueDate type assessmentNo attemptsAllowed numberOfItems shuffleQuestions numberOfQuestionsToShow organizationId section gradeMethod",
          populateArray: [{ path: "section", select: "_id code" }],
        },
      }),
      data.studentId
        ? studentRepository.getStudent(data.studentId, {
            options: {
              select: "studentAssessmentResults organizationId",
              lean: true,
            },
          })
        : null,
    ]);

    if (!rawAssessment) {
      throw new Error(`Assessment with ID ${data.assessmentId} not found`);
    }

    let processedResponsesForStudent: any[] = [];
    let studentActualScore = 0;
    let isPassed = false;

    let attemptTotalPoints = 0;
    let attemptNumberOfItems = 0;
    let attemptPassingScore = 0;
    const questionsAnsweredDetails: any[] = [];

    if (data.answers && data.answers.length > 0 && rawAssessment.questions) {
      const allQuestionsMap = new Map(rawAssessment.questions.map((q) => [q._id.toString(), q]));

      data.answers.forEach((ans) => {
        const questionDetail = allQuestionsMap.get(ans.questionId.toString());
        if (questionDetail) {
          questionsAnsweredDetails.push(questionDetail);
        }
      });

      if (questionsAnsweredDetails.length > 0) {
        attemptNumberOfItems = questionsAnsweredDetails.length;
        attemptTotalPoints = questionsAnsweredDetails.reduce((sum, q) => sum + (q.points || 0), 0);
        attemptPassingScore = Math.ceil((attemptTotalPoints || 0) * 0.6);

        const answeredQuestionsMap = new Map(
          questionsAnsweredDetails.map((q) => [q._id.toString(), q])
        );
        processedResponsesForStudent = processResponses(data.answers, answeredQuestionsMap);
        studentActualScore = processedResponsesForStudent.reduce(
          (sum, response) => sum + (response.pointsEarned || 0),
          0
        );
        isPassed = studentActualScore >= attemptPassingScore;
      } else {
        isPassed = false;
      }
    } else {
      isPassed = false;
    }

    const attemptsAllowed = rawAssessment.attemptsAllowed || 1;

    let attemptNumber;
    const existingResult = student?.studentAssessmentResults?.find(
      (result) => result.assessmentId.toString() === data.assessmentId
    );

    if (existingResult) {
      if (existingResult.attemptNumber <= 0) {
        throw new Error(
          `You have no attempts remaining for this assessment. Max attempts allowed: ${attemptsAllowed}`
        );
      }
      attemptNumber = existingResult.attemptNumber - 1;
    } else {
      attemptNumber = attemptsAllowed - 1;
    }

    const now = new Date().toISOString();
    const assessmentResultData = {
      answers: processedResponsesForStudent,
      totalScore: studentActualScore,
      totalItems: attemptNumberOfItems,
      totalPoints: attemptTotalPoints,
      passingScore: attemptPassingScore,
      isPassed,
      startTime: data.startTime || now,
      endTime: now,
      isFinished: true,
      attemptNumber,
      type: rawAssessment.type || "",
      assessmentNo: rawAssessment.assessmentNo || 0,
      sectionCode:
        rawAssessment.section && typeof rawAssessment.section === "object"
          ? (rawAssessment.section as { code?: string }).code || ""
          : "",
    };

    const result = await saveAssessmentToStudent(
      data.studentId || "",
      data.assessmentId,
      assessmentResultData,
      processedResponsesForStudent
    );

    if (data.studentId) {
      const submittedAt = new Date();
      const endDateRaw = (rawAssessment as any).endDate || (rawAssessment as any).dueDate;
      const endDate = endDateRaw ? new Date(endDateRaw) : null;
      const isLate = endDate && !isNaN(endDate.getTime()) ? submittedAt > endDate : false;
      const status: "late" | "submitted" = isLate ? "late" : "submitted";

      const sectionId =
        rawAssessment.section && typeof rawAssessment.section === "object"
          ? (rawAssessment.section as { _id?: Types.ObjectId })._id ||
            (rawAssessment.section as any)
          : rawAssessment.section;

      const organizationId =
        (rawAssessment as any).organizationId || (student as any)?.organizationId;

      if (sectionId && organizationId) {
        const gradeMethod = (rawAssessment as any).gradeMethod;
        const hasEssayOrManual =
          gradeMethod === "manual" || gradeMethod === "mixed";
        const percentage =
          hasEssayOrManual
            ? 0
            : attemptTotalPoints > 0
              ? Math.round((studentActualScore / attemptTotalPoints) * 10000) / 100
              : 0;

        const gradePayload = {
          organizationId,
          sectionId,
          assessmentId: new Types.ObjectId(data.assessmentId),
          studentId: new Types.ObjectId(data.studentId),
          score: Number(studentActualScore) || 0,
          totalPoints: Number(attemptTotalPoints) || 0,
          percentage,
          status,
          submittedAt,
        };

        const existingGrade = await studentAssessmentGradeRepository.searchAndUpdate({
          studentId: gradePayload.studentId,
          assessmentId: gradePayload.assessmentId,
          "archive.status": { $ne: true },
        });

        if (existingGrade && (existingGrade as any)._id) {
          await studentAssessmentGradeRepository.searchAndUpdate(
            { _id: (existingGrade as any)._id },
            { $set: gradePayload }
          );
        } else {
          await studentAssessmentGradeRepository.createStudentAssessmentGrade(gradePayload);
        }
      }
    }

    return result;
  } catch (error) {
    throw error instanceof Error ? new Error(error.message) : new Error(String(error));
  }
}

async function saveAssessmentToStudent(
  studentId: string | undefined,
  assessmentId: string,
  assessmentResultData: {
    totalItems: number;
    totalPoints: number;
    totalScore: number;
    passingScore: number;
    isPassed: boolean;
    startTime: string;
    endTime: string;
    isFinished: boolean;
    attemptNumber: number;
    type: string;
    assessmentNo: number;
    sectionCode: string;
  },
  processedResponses: Array<any>
) {
  try {
    if (!studentId) {
      throw new Error("Student ID is required");
    }

    const startTime = formatAssessmentDate(
      assessmentResultData.startTime,
      "Invalid startTime, using current time instead:"
    );

    const endTime = formatAssessmentDate(
      assessmentResultData.endTime,
      "Invalid endTime, using current time instead:"
    );

    const student = await studentRepository.getStudent(studentId, {
      options: {
        select: "_id studentAssessmentResults",
        lean: true,
      },
    });

    if (!student) {
      throw new Error(`Student with ID ${studentId} not found`);
    }

    const filteredResults =
      student.studentAssessmentResults?.filter(
        (result) => result.assessmentId.toString() !== assessmentId
      ) || [];
    const normalizedResponses = JSON.parse(
      JSON.stringify(
        processedResponses.map((response) => {
          let questionId;

          if (typeof response.questionId === "number") {
            questionId = response.questionId;
          } else if (typeof response.questionId === "string") {
            const match = response.questionId.match(/^0*(\d+)/);
            if (match) {
              questionId = Number(match[1]);
            } else if (!isNaN(Number(response.questionId))) {
              questionId = Number(response.questionId);
            } else {
              questionId = response.questionId;
            }
          } else {
            if (response.questionId && typeof response.questionId.toString === "function") {
              const strValue = response.questionId.toString();
              const match = strValue.match(/^0*(\d+)/);
              if (match) {
                questionId = Number(match[1]);
              } else if (!isNaN(Number(strValue))) {
                questionId = Number(strValue);
              } else {
                questionId = response.questionId;
              }
            } else {
              questionId = response.questionId;
            }
          }

          return {
            questionId: questionId,
            answer: response.answer,
            correctAnswer: response.correctAnswer,
            isCorrect: Boolean(response.isCorrect),
            pointsEarned: Number(response.pointsEarned) || 0,
          };
        })
      )
    );

    const attemptNumber = Number(assessmentResultData.attemptNumber);
    if (isNaN(attemptNumber)) {
      throw new Error("Invalid attempt number");
    }

    const studentAssessmentResult = JSON.parse(
      JSON.stringify({
        assessmentId: new Types.ObjectId(assessmentId),
        type: assessmentResultData.type,
        assessmentNo: assessmentResultData.assessmentNo,
        sectionCode: assessmentResultData.sectionCode,
        answers: normalizedResponses,
        totalItems: Number(assessmentResultData.totalItems) || 0,
        totalPoints: Number(assessmentResultData.totalPoints) || 0,
        totalScore: Number(assessmentResultData.totalScore) || 0,
        passingScore: Number(assessmentResultData.passingScore) || 0,
        isPassed: Boolean(assessmentResultData.isPassed),
        attemptNumber: attemptNumber,
        startTime: startTime,
        endTime: endTime,
        isFinished: Boolean(assessmentResultData.isFinished),
        isDeleted: false,
        archive: { status: false, date: null },
      })
    );

    filteredResults.push({
      ...studentAssessmentResult,
      type: studentAssessmentResult.type as
        | "quiz"
        | "mid_term"
        | "final_exam"
        | "assignment"
        | "activity",
    });

    const serializedStudentResults = JSON.parse(JSON.stringify(filteredResults));

    await studentRepository.updateStudent({
      _id: studentId,
      studentAssessmentResults: serializedStudentResults,
    });

    const responseResult = { ...studentAssessmentResult };

    responseResult.answers = processedResponses.map((original, index) => {
      const questionId =
        typeof original.questionId === "number"
          ? original.questionId
          : /^\d+$/.test(String(original.questionId))
            ? Number(original.questionId)
            : index + 1;

      return {
        questionId,
        answer: original.answer,
        correctAnswer: original.correctAnswer,
        isCorrect: Boolean(original.isCorrect),
        pointsEarned: Number(original.pointsEarned) || 0,
      };
    });

    return responseResult;
  } catch (error) {
    throw error instanceof Error ? new Error(error.message) : new Error(String(error));
  }
}

function findStudentSubmissionForAssessment(
  studentAssessmentResults: any[] | undefined,
  targetAssessmentId: string
): any | undefined {
  if (!Array.isArray(studentAssessmentResults)) {
    return undefined;
  }
  return studentAssessmentResults.find((result) => {
    if (result.assessmentId && result.assessmentId.toString() === targetAssessmentId) {
      return true;
    }
    if (result.responses && Array.isArray(result.responses)) {
      return result.responses.some(
        (response: any) =>
          response.assessmentId && response.assessmentId.toString() === targetAssessmentId
      );
    }
    return false;
  });
}

async function getSectionAssessmentStudents(
  sectionCode: string,
  assessmentId: string
): Promise<any> {
  try {
    const sections = await sectionRepository.searchSection({
      query: { code: sectionCode },
      populateArray: [
        {
          path: "students",
          select: "_id firstName lastName email studentId studentAssessmentResults avatar",
        },
      ],
      lean: true,
    });

    if (!sections || sections.length === 0) {
      throw new Error("Section not found");
    }

    const section = sections[0];
    const assessment = await assessmentRepository.getAssessment(assessmentId, {
      options: { lean: true, select: "_id title type totalPoints endDate assessmentNo" },
    });

    if (!assessment) {
      throw new Error("Assessment not found");
    }

    const studentsWhoTookAssessment = [];
    const studentsWhoDidNotTakeAssessment = [];
    const targetIdStr = assessmentId.toString();

    let authoritativeTotalPoints = assessment.totalPoints || 0;
    let totalPointsSetFromSubmission = false;

    if (Array.isArray(section.students)) {
      for (const studentObj of section.students) {
        const student = studentObj as PopulatedStudent;
        if (!student || typeof student !== "object") continue;

        const studentInfo = {
          _id: student._id,
          studentId: student.studentId || "Unknown",
          studentName: `${student.firstName || ""} ${student.lastName || ""}`.trim() || "Unknown",
          email: student.email || "Unknown",
          avatar: student.avatar || "",
        };

        const assessmentResult = findStudentSubmissionForAssessment(
          student.studentAssessmentResults,
          targetIdStr
        );

        if (assessmentResult) {
          if (!totalPointsSetFromSubmission && typeof assessmentResult.totalPoints === "number") {
            authoritativeTotalPoints = assessmentResult.totalPoints;
            totalPointsSetFromSubmission = true;
          }
          studentsWhoTookAssessment.push({
            ...studentInfo,
            result: {
              totalScore: assessmentResult.totalScore || 0,
              passingScore: assessmentResult.passingScore || 0,
              isPassed: !!assessmentResult.isPassed,
              attemptNumber: assessmentResult.attemptNumber || 1,
              startTime: assessmentResult.startTime || null,
              endTime: assessmentResult.endTime || null,
              assessmentNo: assessmentResult.assessmentNo || null,
            },
          });
        } else {
          studentsWhoDidNotTakeAssessment.push(studentInfo);
        }
      }
    }

    return {
      assessmentInfo: {
        _id: assessment._id,
        title: assessment.title || "",
        type: assessment.type || "",
        totalPoints: authoritativeTotalPoints,
        dueDate: assessment.endDate || null,
        assessmentNo: assessment.assessmentNo || null,
      },
      submitted: studentsWhoTookAssessment,
      notSubmitted: studentsWhoDidNotTakeAssessment,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function getStudentAssessmentResult(
  studentId: string,
  assessmentNo: string,
  assessmentType: string,
  assessmentCode: string | undefined
): Promise<any> {
  try {
    if (!studentId || !assessmentNo) {
      throw new Error("Student ID and Assessment No are required");
    }
    if (!assessmentType) {
      throw new Error("Assessment type is required");
    }

    const student = await Student.findById(studentId)
      .select("_id firstName lastName email studentId avatar studentAssessmentResults")
      .lean();

    if (!student) {
      throw new Error(`Student with ID ${studentId} not found`);
    }

    const numericAssessmentNo = parseInt(assessmentNo);
    if (isNaN(numericAssessmentNo)) {
      throw new Error("Invalid assessment No. Must be a number.");
    }

    const studentAssessmentResults = student.studentAssessmentResults || [];
    const assessmentResult = studentAssessmentResults.find((result) => {
      const matchesCriteria =
        result.assessmentNo === numericAssessmentNo && result.type === assessmentType;
      return matchesCriteria && (!assessmentCode || result.sectionCode === assessmentCode);
    });

    if (!assessmentResult) {
      throw new Error(
        `No assessment result found for student ${studentId} with assessment number ${numericAssessmentNo} and type ${assessmentType}`
      );
    }

    const assessment = await assessmentRepository.getAssessment(
      assessmentResult.assessmentId.toString(),
      {
        options: {
          select: "_id title type totalPoints passingScore questions",
          lean: true,
        },
      }
    );

    if (!assessment) {
      throw new Error(`Assessment with ID ${assessmentResult.assessmentId} not found`);
    }

    const questionsMap = new Map();
    if (assessment.questions && Array.isArray(assessment.questions)) {
      assessment.questions.forEach((question: any) => {
        questionsMap.set(question._id, question);
      });
    }

    const enhancedAnswers: any[] = [];
    const answers = assessmentResult.answers || [];

    if (Array.isArray(answers)) {
      answers.forEach((answer) => {
        const questionId = answer.questionId;
        const question = questionsMap.get(questionId);
        const studentAnswer = answer.answer;

        const enhancedAnswer: any = {
          questionId: answer.questionId,
          isCorrect: answer.isCorrect,
          pointsEarned: answer.pointsEarned,
          points: question?.points || 0,
          questionText: question?.questionText || "Question not found",
          questionType: question?.type || "unknown",
        };

        if (question?.questionImage) {
          enhancedAnswer.questionImage = question.questionImage;
        }

        if (question?.type === "multiple_choice" && question.options) {
          const normalizedStudentAnswer =
            typeof studentAnswer === "string" ? studentAnswer.trim().toLowerCase() : "";

          enhancedAnswer.options = question.options.map((opt: any) => {
            const optionText = (opt.option || "").toLowerCase();
            const optionContentText = (opt.text || "").toLowerCase();
            const isStudentAnswer =
              normalizedStudentAnswer === optionText ||
              normalizedStudentAnswer === optionContentText;

            return {
              _id: opt._id,
              option: opt.option,
              text: opt.text,
              isCorrect: opt.isCorrect,
              isStudentAnswer,
              image: opt.image || null,
            };
          });
        } else if (question?.type === "checkbox" && question.options) {
          const normalizedStudentAnswers = Array.isArray(studentAnswer)
            ? studentAnswer.map((ans) => (typeof ans === "string" ? ans.trim().toLowerCase() : ans))
            : [];

          enhancedAnswer.options = question.options.map((opt: any) => {
            const optionText = (opt.option || "").toLowerCase();
            const optionContentText = (opt.text || "").toLowerCase();

            const isStudentAnswer = normalizedStudentAnswers.some(
              (ans) => ans === optionText || ans === optionContentText
            );

            return {
              _id: opt._id,
              option: opt.option,
              text: opt.text,
              isCorrect: opt.isCorrect,
              isStudentAnswer,
              image: opt.image || null,
            };
          });
        } else {
          enhancedAnswer.answer = answer.answer;
          enhancedAnswer.correctAnswer = answer.correctAnswer;
        }

        enhancedAnswers.push(enhancedAnswer);
      });
    }

    return {
      studentInfo: {
        _id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        studentId: student.studentId,
        avatar: student.avatar,
      },
      assessmentInfo: {
        _id: assessment._id,
        title: assessment.title,
        type: assessment.type,
        totalPoints: assessmentResult.totalPoints,
        passingScore: assessmentResult.passingScore,
        assessmentNo: numericAssessmentNo,
      },
      result: {
        ...assessmentResult,
        answers: enhancedAnswers,
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function archiveAssessment(id: string): Promise<IAssessment | null> {
  if (!id) {
    throw new Error("Invalid announcement ID");
  }

  try {
    const assessment = await assessmentRepository.getAssessment(id, {});
    if (!assessment) {
      return null;
    }

    return await assessmentRepository.archiveAssessment(id);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}

async function updateStudentAssessmentResult(
  studentId: string,
  assessmentId: string,
  answers: Array<{ questionId: string; pointsEarned: number; isCorrect: boolean }>
): Promise<any> {
  try {
    if (!studentId) {
      throw new Error("Student ID is required");
    }
    if (!assessmentId) {
      throw new Error("Assessment ID is required");
    }
    if (!answers || !Array.isArray(answers) || !answers.length) {
      throw new Error("Answers array is required");
    }

    const student = await studentRepository.getStudent(studentId, {
      options: {
        select: "_id studentAssessmentResults",
        lean: true,
      },
    });

    if (!student) {
      throw new Error(`Student with ID ${studentId} not found`);
    }

    const assessmentResultIndex = student.studentAssessmentResults?.findIndex(
      (result) => result.assessmentId.toString() === assessmentId && !result.isDeleted
    );

    if (assessmentResultIndex === undefined || assessmentResultIndex === -1) {
      throw new Error(
        `Assessment result with ID ${assessmentId} not found for student ${studentId}`
      );
    }

    const studentAssessmentResults = [...(student.studentAssessmentResults || [])];
    const assessmentResult = studentAssessmentResults[assessmentResultIndex];

    const updatedAnswers = assessmentResult.answers.map((existingAnswer) => {
      const updatedAnswer = answers.find(
        (a) => a.questionId === existingAnswer.questionId.toString()
      );

      if (updatedAnswer) {
        return {
          ...existingAnswer,
          pointsEarned: updatedAnswer.pointsEarned,
          isCorrect: updatedAnswer.isCorrect,
        };
      }
      return existingAnswer;
    });

    const totalScore = updatedAnswers.reduce((sum, answer) => sum + (answer.pointsEarned || 0), 0);

    assessmentResult.answers = updatedAnswers;
    assessmentResult.totalScore = totalScore;
    assessmentResult.isPassed = totalScore >= (assessmentResult.passingScore || 0);

    studentAssessmentResults[assessmentResultIndex] = assessmentResult;

    await studentRepository.updateStudent({
      _id: studentId,
      studentAssessmentResults: studentAssessmentResults,
    });

    // IMPORTANT:
    // Dashboard "Pending Grading" is computed from StudentAssessmentGrade (studentassessmentgrades collection),
    // not from studentAssessmentResults. When the instructor manually grades (essay/mixed),
    // we must update the StudentAssessmentGrade record so it exits the pending queue.
    try {
      const assessment = await assessmentRepository.getAssessment(assessmentId, {
        options: {
          lean: true,
          select: "_id section organizationId",
          populateArray: [{ path: "section", select: "_id" }],
        },
      });

      const sectionId =
        assessment && (assessment as any).section && typeof (assessment as any).section === "object"
          ? (assessment as any).section._id
          : (assessment as any)?.section;
      const organizationId = (assessment as any)?.organizationId;

      if (sectionId && organizationId) {
        const totalPoints = Number(assessmentResult.totalPoints) || 0;
        const percentage =
          totalPoints > 0 ? Math.round((totalScore / totalPoints) * 10000) / 100 : 0;

        const existing = await studentAssessmentGradeRepository.searchAndUpdate({
          studentId: new Types.ObjectId(studentId),
          assessmentId: new Types.ObjectId(assessmentId),
          "archive.status": { $ne: true },
        });

        const updatePayload = {
          organizationId,
          sectionId,
          assessmentId: new Types.ObjectId(assessmentId),
          studentId: new Types.ObjectId(studentId),
          score: Number(totalScore) || 0,
          totalPoints,
          percentage,
          status: "graded",
        };

        if (existing && (existing as any)._id) {
          await studentAssessmentGradeRepository.searchAndUpdate(
            { _id: (existing as any)._id },
            { $set: updatePayload }
          );
        } else {
          await studentAssessmentGradeRepository.createStudentAssessmentGrade(updatePayload as any);
        }
      }
    } catch (_e) {
      // Non-blocking: student result was saved, but grade sync failed.
      // We intentionally don't fail the request to avoid losing instructor edits.
    }

    return assessmentResult;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }
}
