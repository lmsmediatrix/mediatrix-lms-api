import { IAssessment } from "../models/assessmentModel";
/**
 * Processes student assessment answers and evaluates them against correct answers
 * @param answers Array of student answers with question IDs
 * @param questionsMap Map of questions indexed by ID for efficient lookup
 * @returns Array of processed responses with correctness and points earned
 */
export function processResponses(
  answers: Array<{ questionId: string | number; answer: string | string[] }>,
  questionsMap: Map<number | string, any>
) {
  const results = new Array(answers.length);
  for (let i = 0; i < answers.length; i++) {
    const { questionId, answer } = answers[i];
    // First try using the ID directly, then fall back to string conversion
    const question =
      questionsMap.get(questionId) ||
      questionsMap.get(Number(questionId)) ||
      questionsMap.get(String(questionId));

    if (!question) {
      results[i] = {
        questionId,
        answer,
        isCorrect: false,
        pointsEarned: 0,
      };
      continue;
    }

    const { isCorrect, pointsEarned, correctAnswer } = evaluateAnswer(question, answer);

    results[i] = {
      questionId,
      answer,
      correctAnswer,
      isCorrect,
      pointsEarned,
    };
  }

  return results;
}

/**
 * Evaluates a student's answer against the correct answer
 * @param question The question object with type, options, and correct answers
 * @param answer The student's answer (string or array)
 * @returns Object containing whether the answer is correct, points earned, and the correct answer
 */
export function evaluateAnswer(
  question: any,
  answer: string | string[] | any
): { isCorrect: boolean; pointsEarned: number; correctAnswer: string | string[] } {
  const points = question.points || 0;

  const result = {
    isCorrect: false,
    pointsEarned: 0,
    correctAnswer: "" as string | string[],
  };

  if (!question.type) {
    return result;
  }

  switch (question.type) {
    case "checkbox": {
      // Convert student answer to array if it's not already
      const studentAnswers = Array.isArray(answer) ? answer : [answer];

      // Get all correct options from the question
      const correctOptions = question.options
        ?.filter((opt: any) => opt.isCorrect)
        .map((opt: any) => opt.option || opt.text || opt._id?.toString());

      // Store correct answers for reference
      result.correctAnswer = correctOptions || [];

      // If no correct options defined, break
      if (!correctOptions?.length) {
        break;
      }

      // Check if student selected exactly all correct options (no more, no less)
      const studentAnswersSet = new Set(studentAnswers.map((a: any) => a.toString()));

      // Student must select ALL correct options
      const allCorrectSelected = correctOptions.every((opt: string) =>
        studentAnswersSet.has(opt.toString())
      );

      // Student must NOT select ANY incorrect options
      const incorrectOptionsSelected = question.options
        ?.filter((opt: any) => !opt.isCorrect)
        .some((opt: any) => {
          const optValue = opt.option || opt.text || opt._id?.toString();
          return studentAnswersSet.has(optValue.toString());
        });

      // Award points only if all correct options are selected and no incorrect ones
      if (allCorrectSelected && !incorrectOptionsSelected) {
        result.isCorrect = true;
        result.pointsEarned = points;
      }
      break;
    }

    case "multiple_choice": {
      const answerStr = typeof answer === "string" ? answer.trim().toLowerCase() : "";
      const correctOption = question.options?.find((opt: any) => opt.isCorrect);
      result.correctAnswer = correctOption?.option || correctOption?.text || "";

      if (answerStr && question.options) {
        for (const opt of question.options) {
          const optionText = opt.option?.toLowerCase() || "";
          const contentText = opt.text?.toLowerCase() || "";

          if (optionText === answerStr || contentText === answerStr) {
            if (opt.isCorrect) {
              result.isCorrect = true;
              result.pointsEarned = points;
            }
            break;
          }
        }
      }
      break;
    }

    case "true_false": {
      const answerBoolStr = typeof answer === "string" ? answer.trim().toLowerCase() : "";
      const correctBooleanAnswer = question.correctAnswers?.[0]?.toLowerCase();
      result.correctAnswer = correctBooleanAnswer || "";

      if (answerBoolStr === correctBooleanAnswer) {
        result.isCorrect = true;
        result.pointsEarned = points;
      }
      break;
    }

    case "fill_in_the_blank": {
      const answerBlankStr = typeof answer === "string" ? answer.trim().toLowerCase() : "";
      result.correctAnswer = question.correctAnswers?.[0] || "";
      if (!question.correctAnswers?.length) {
        break;
      }
      for (const correctAns of question.correctAnswers) {
        if ((correctAns?.toLowerCase() || "").trim() === answerBlankStr) {
          result.isCorrect = true;
          result.pointsEarned = points;
          break;
        }
      }
      break;
    }

    case "enumeration": {
      result.correctAnswer = question.correctAnswers || [];
      if (!question.correctAnswers?.length) {
        break;
      }
      let studentAnswers: string[] = [];
      if (Array.isArray(answer)) {
        studentAnswers = answer.map((a) => (a || "").toString().trim().toLowerCase());
      } else if (typeof answer === "string") {
        studentAnswers = answer.split(",").map((a) => a.trim().toLowerCase());
      } else {
        break;
      }
      if (studentAnswers.length !== question.correctAnswers.length) {
        break;
      }
      const studentAnswersSet = new Set(studentAnswers);
      const correctAnswersLower = question.correctAnswers.map((a: string) =>
        (a || "").toString().trim().toLowerCase()
      );
      let allCorrect = true;
      for (const correctAns of correctAnswersLower) {
        if (!studentAnswersSet.has(correctAns)) {
          allCorrect = false;
          break;
        }
      }

      if (allCorrect) {
        result.isCorrect = true;
        result.pointsEarned = points;
      }
      break;
    }
  }

  return result;
}

/**
 * Normalizes student assessment results for storage
 * @param processedResponses The processed student responses
 * @returns Normalized responses with proper types and formatting
 */
export function normalizeResponses(processedResponses: Array<any>) {
  return processedResponses.map((response) => {
    // Enhanced conversion logic for questionId - ensure simple numbers remain as numbers
    let questionId = response.questionId;

    // If it's already a number, keep it as is
    if (typeof questionId === "number") {
      // Keep as is - no conversion needed
    }
    // If it's a string, try to convert to number if it's purely numeric
    else if (typeof questionId === "string") {
      // Check if it's a pure number string without any non-numeric characters
      if (/^\d+$/.test(questionId)) {
        questionId = Number(questionId);
      }
    }
    // If it's an object with toString method (e.g., MongoDB ObjectId)
    else if (questionId && typeof questionId === "object" && questionId.toString) {
      const strValue = questionId.toString();
      // Only convert if the string representation is purely numeric
      if (/^\d+$/.test(strValue)) {
        questionId = Number(strValue);
      }
    }

    return {
      questionId: questionId,
      answer: response.answer,
      correctAnswer: response.correctAnswer,
      isCorrect: Boolean(response.isCorrect),
      pointsEarned: Number(response.pointsEarned) || 0,
    };
  });
}

/**
 * Validates and formats dates for assessment results
 * @param dateStr The date string to format
 * @param fallbackMsg Optional message for logging fallback behavior
 * @returns Formatted ISO date string
 */
export function formatAssessmentDate(dateStr: string, fallbackMsg?: string): string {
  try {
    return new Date(dateStr).toISOString();
  } catch (e) {
    if (fallbackMsg) {
      console.warn(fallbackMsg, e);
    }
    return new Date().toISOString();
  }
}

export function processAssessmentQuestions(
  assessment: IAssessment,
  userRole?: string
): IAssessment {
  if (assessment && assessment.questions && assessment.questions.length > 0) {
    const originalQuestionsFromDB = [...assessment.questions];
    let questionsToDisplay = [...originalQuestionsFromDB]; // Start with a copy

    // Apply shuffling and numberOfQuestionsToShow only if the user is a student
    if (userRole === "student") {
      if (assessment.shuffleQuestions) {
        // Shuffle all questions
        for (let i = questionsToDisplay.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [questionsToDisplay[i], questionsToDisplay[j]] = [
            questionsToDisplay[j],
            questionsToDisplay[i],
          ];
        }

        // If numberOfQuestionsToShow is specified and valid, slice the shuffled questions
        if (
          typeof assessment.numberOfQuestionsToShow === "number" &&
          assessment.numberOfQuestionsToShow > 0 &&
          assessment.numberOfQuestionsToShow < questionsToDisplay.length // Ensure NQTS is less than total questions
        ) {
          questionsToDisplay = questionsToDisplay.slice(0, assessment.numberOfQuestionsToShow);
        }
        // If NQTS is greater or equal, show all (shuffled) questions
      } else {
        // Not shuffled, but student might still have numberOfQuestionsToShow if previously shuffled then saved
        // Or if an admin/instructor set it without shuffleQuestions
        if (
          typeof assessment.numberOfQuestionsToShow === "number" &&
          assessment.numberOfQuestionsToShow > 0 &&
          assessment.numberOfQuestionsToShow < questionsToDisplay.length
        ) {
          // For non-shuffled, if NQTS is present, take the first N questions
          questionsToDisplay = questionsToDisplay.slice(0, assessment.numberOfQuestionsToShow);
        }
      }
      // Recalculate points/items based on what's displayed to the student
      assessment.totalPoints = questionsToDisplay.reduce((sum, q) => sum + (q.points || 0), 0);
      assessment.numberOfItems = questionsToDisplay.length;
      // Passing score should ideally be based on the potentially modified totalPoints for the student view
      assessment.passingScore = Math.ceil((assessment.totalPoints || 0) * 0.6);
    } else {
      // For non-students (e.g., instructors, admins), show all original questions
      // and calculate points based on all original questions.
      // No slicing or shuffling is applied to questionsToDisplay for them.
      // The assessment.questions will remain the original questions.
      // Ensure points and items reflect all original questions.
      assessment.numberOfItems = originalQuestionsFromDB.length;
      assessment.totalPoints = originalQuestionsFromDB.reduce((sum, q) => sum + (q.points || 0), 0);
      // Passing score for non-students should reflect the full assessment
      assessment.passingScore = Math.ceil((assessment.totalPoints || 0) * 0.6);
    }
    // Set the questions array on the assessment object to what should be displayed
    assessment.questions = questionsToDisplay;
  } else if (assessment) {
    // Handles assessment object exists but no questions array or empty questions array
    assessment.questions = []; // Ensure questions is an empty array
    assessment.numberOfItems = 0;
    assessment.totalPoints = 0;
    assessment.passingScore = 0;
  }
  return assessment;
}
