/**
 * Utility functions for grade calculations and formatting
 */

import assessmentRepository from "../../repository/assessmentRepository";
import gradingRepository from "../../repository/gradeRepository";

import sectionRepository from "../../repository/sectionRepository";

/**
 * Get the grade label based on percentage from a grading scale
 * @param grade The grade object containing grading scale
 * @param percentage The percentage score to evaluate
 * @returns The grade label (e.g., "1.0", "5.0") or "N/A" if no match found
 */
export function getGradeLabel(grade: any, percentage: number): string {
  if (!grade || !grade.gradingScale) return "N/A";

  const scale = grade.gradingScale.find(
    (scale: any) =>
      percentage >= scale.percentageRange.startRange && percentage <= scale.percentageRange.endRange
  );

  return scale ? scale.gradeLabel : "N/A";
}

/**
 * Format a percentage value, removing unnecessary zeros
 * @param percentage The percentage value to format
 * @returns Formatted percentage string (e.g., "60%" instead of "60.00%")
 */
export function formatPercentage(percentage: number): string {
  return percentage === Math.floor(percentage)
    ? Math.floor(percentage) + "%"
    : percentage.toFixed(2).replace(/\.?0+$/, "") + "%";
}

/**
 * Format a grade label to always show one decimal place
 * @param gradeLabel The grade label to format
 * @returns Formatted grade label (e.g., "5.0" instead of "5.00" or "5")
 */
export function formatGradeLabel(gradeLabel: string): string {
  return gradeLabel.replace(/\.00$/, ".0");
}

export async function getSectionStudentGradesTable(
  sectionCode: string,
  params: any
): Promise<{ headers: string[]; students: any[] }> {
  const dbParams: any = { query: {}, options: {} };
  if (params.queryArray && params.queryArray.length > 0) {
    const queryArray = Array.isArray(params.queryArray) ? params.queryArray : [params.queryArray];
    const queryConditions = queryArray.map((type: string | number) => {
      const trimmedType = String(type).trim();
      return { [trimmedType]: { $in: queryArray } };
    });
    queryConditions.forEach((condition: any) => {
      dbParams.query = { ...dbParams.query, ...condition };
    });
  }
  if (params.populateArray) {
    dbParams.options.populateArray = params.populateArray.map((item: any) => {
      if (typeof item === "string") {
        const [path, select] = item.split(":");
        return select ? { path, select: select.split(",").join(" ") } : { path };
      }
      return item;
    });
  }
  if (params.sort) dbParams.options.sort = params.sort;
  if (params.limit) dbParams.options.limit = params.limit;
  if (params.select) {
    if (!Array.isArray(params.select)) params.select = [params.select];
    dbParams.options.select = params.select.join(" ");
  }
  if (params.lean !== undefined) dbParams.options.lean = params.lean;
  if (params.query && params.query.organizationId) {
    dbParams.query.organizationId = params.query.organizationId;
  } else {
    return { headers: [], students: [] };
  }

  const sections = await sectionRepository.searchSection({
    query: { code: sectionCode },
    options: { select: "code", lean: true },
  });
  if (!sections || sections.length === 0) {
    return { headers: [], students: [] };
  }
  const grade = await gradingRepository.getGradings({
    query: {
      sectionId: sections[0]._id,
      "archive.status": false,
      organizationId: params.query.organizationId,
    },
    options: {
      select:
        "sectionId gradingMethod totalCoursePoints minPassingGrade lateSubmissionPenalty gradeDistribution gradingScale",
      populateArray: [{ path: "sectionId", select: "code" }],
      lean: true,
    },
  });

  const sectionStudents = await sectionRepository.getSection(sections[0]._id, {
    options: {
      select: "students",
      populateArray: [
        {
          path: "students",
          select: "_id firstName lastName studentId avatar studentAssessmentResults",
        },
      ],
      lean: true,
    },
  });

  const studentData = (sectionStudents?.students || []).filter(
    (student: any) => !student.archive?.status
  );

  const gradingScale =
    grade && grade[0]?.gradingScale && grade[0].gradingScale.length > 0
      ? grade[0].gradingScale
      : [
          { gradeLabel: "1.00", percentageRange: { startRange: 96, endRange: 100 } },
          { gradeLabel: "1.25", percentageRange: { startRange: 94, endRange: 95 } },
          { gradeLabel: "1.50", percentageRange: { startRange: 92, endRange: 93 } },
          { gradeLabel: "1.75", percentageRange: { startRange: 89, endRange: 91 } },
          { gradeLabel: "2.00", percentageRange: { startRange: 87, endRange: 88 } },
          { gradeLabel: "2.25", percentageRange: { startRange: 85, endRange: 86 } },
          { gradeLabel: "2.50", percentageRange: { startRange: 83, endRange: 84 } },
          { gradeLabel: "2.75", percentageRange: { startRange: 80, endRange: 82 } },
          { gradeLabel: "3.00", percentageRange: { startRange: 75, endRange: 79 } },
          { gradeLabel: "5.00", percentageRange: { startRange: 0, endRange: 74 } },
        ];

  const assessments = await assessmentRepository.getAssessments({
    query: {
      section: sections[0]._id,
      "archive.status": false,
      isDeleted: { $ne: true },
    },
    options: {
      select: "_id title type totalPoints assessmentNo numberOfItems startDate endDate",
      lean: true,
      limit: 1000,
      skip: 0,
    },
  });

  const assessmentHeaders = assessments.map(
    (assessment) => `${assessment.type} ${assessment.assessmentNo}`
  );

  const processedStudents = studentData.map((student: any) => {
    const studentAssessments = student.studentAssessmentResults || [];
    const assessmentMap = new Map<string, any>(
      studentAssessments.map((result: any) => [result.assessmentId?.toString(), result])
    );
    const processedAssessments = assessments.map((assessment: any) => {
      const result = assessmentMap.get(assessment._id.toString());
      const now = new Date();
      const isOverdue = assessment.endDate && new Date(assessment.endDate) < now;
      if (!result) {
        return {
          assessmentId: assessment._id,
          totalScore: 0,
          totalItems: assessment.numberOfItems || 0,
          totalPoints: assessment.totalPoints || 0,
          type: assessment.type,
          assessmentNo: assessment.assessmentNo,
          gradeMethod: "auto",
          percentageScore: 0,
          gradeLabel: isOverdue ? "0" : "--",
        };
      }
      const percentageScore =
        result.totalPoints > 0 ? Math.round((result.totalScore / result.totalPoints) * 100) : 0;
      return {
        assessmentId: assessment._id,
        totalScore: result.totalScore || 0,
        totalItems: assessment.numberOfItems || 0,
        totalPoints: assessment.totalPoints || 0,
        type: assessment.type,
        assessmentNo: assessment.assessmentNo,
        gradeMethod: "auto",
        percentageScore,
        gradeLabel: String(percentageScore),
      };
    });
    const validPercentages = processedAssessments
      .filter((a) => a.gradeLabel !== "--")
      .map((a) => a.percentageScore);
    const avgPercentage =
      validPercentages.length > 0
        ? validPercentages.reduce((sum: number, p: number) => sum + p, 0) / validPercentages.length
        : 0;
    const finalGrade =
      gradingScale.find(
        (scale: any) =>
          avgPercentage >= scale.percentageRange.startRange &&
          avgPercentage <= scale.percentageRange.endRange
      )?.gradeLabel || "5.00";
    return {
      _id: student._id,
      studentId: student.studentId,
      avatar: student.avatar || "",
      fullName: `${student.firstName || ""} ${student.lastName || ""}`.trim(),
      assessments: processedAssessments,
      finalGrade,
      firstName: student.firstName,
      lastName: student.lastName,
    };
  });

  return {
    headers: assessmentHeaders,
    students: processedStudents,
  };
}

interface ProcessedAssessmentResult {
  assessmentId: any; // Consider using a more specific type e.g. string | ObjectId
  title: string;
  type: string;
  assessmentNo: number;
  score: number;
  totalPoints: number;
  isPassed: boolean;
  isFinished: boolean;
  gradeLabel: string;
}

export async function getStudentSectionGradeAnalytics(studentId: string, sectionId: string) {
  const sections = await sectionRepository.searchSection({
    query: { _id: sectionId, students: studentId },
    populateArray: [
      {
        path: "assessments",
        select:
          "type title totalPoints passingScore shuffleQuestions numberOfQuestionsToShow questions",
        match: { isDeleted: false, isPublished: true },
        populate: {
          path: "questions",
          select: "type options points questionText correctAnswer correctAnswers",
        },
      },
      { path: "grade", select: "gradingScale" }, // Added to fetch gradingScale for grade label mapping
    ],
    lean: true,
  });

  if (!sections || sections.length === 0) {
    throw new Error("Section not found or student not enrolled in this section.");
  }

  const grade = await gradingRepository.getGradings({
    query: { sectionId: sections[0]._id }, // Assuming one section result
    options: { lean: true, limit: 1 }, // Fetch only one grading configuration
  });

  if (!grade || grade.length === 0 || !grade[0].gradingScale) {
    throw new Error("Grading configuration not found for this section.");
  }

  const gradingScale = grade[0].gradingScale; // Extract grading scale

  const sectionStudents = await sectionRepository.getSection(sections[0]._id, {
    options: {
      populateArray: [{ path: "students", select: "_id studentAssessmentResults" }],
      lean: true,
    },
  });

  if (!sectionStudents || !sectionStudents.students) {
    throw new Error("Unable to fetch student data for the section.");
  }

  const studentData: any = sectionStudents.students.find(
    (s: any) => s._id.toString() === studentId
  );

  if (!studentData || !studentData.studentAssessmentResults) {
    return {
      studentId,
      sectionId,
      assessments: [],
      finalGrade: null, // Or some default value like "N/A"
      remarks: "No assessment results found for student.",
    };
  }

  const assessments = await assessmentRepository.getAssessments({
    query: { section: sectionId, isDeleted: false, isPublished: true }, // Query by sectionId
    options: {
      select:
        "type title totalPoints passingScore shuffleQuestions numberOfQuestionsToShow questions assessmentNo",
      lean: true,
    },
  });

  const assessmentResults: ProcessedAssessmentResult[] = studentData.studentAssessmentResults
    .filter((sar: any) => sar.sectionCode === sections[0].code && !sar.isDeleted)
    .map((sar: any): ProcessedAssessmentResult => {
      const originalAssessment = assessments.find(
        (a: any) => a._id.toString() === sar.assessmentId.toString()
      );

      // Find the grade label based on percentage
      let gradeLabel = "--"; // Default if not found or not applicable
      if (originalAssessment && typeof sar.totalPoints === "number" && sar.totalPoints > 0) {
        const percentage = (sar.totalScore / sar.totalPoints) * 100;
        const matchedGrade = gradingScale.find(
          (scale: any) =>
            percentage >= scale.percentageRange.startRange &&
            percentage <= scale.percentageRange.endRange
        );
        if (matchedGrade) {
          gradeLabel = matchedGrade.gradeLabel;
        }
      }

      return {
        assessmentId: sar.assessmentId,
        title: originalAssessment?.title || "N/A",
        type: originalAssessment?.type || "N/A",
        assessmentNo: originalAssessment?.assessmentNo || 0,
        score: sar.totalScore,
        totalPoints: sar.totalPoints,
        isPassed: sar.isPassed,
        isFinished: sar.isFinished,
        gradeLabel: gradeLabel, // Added grade label
      };
    })
    .sort((a: ProcessedAssessmentResult, b: ProcessedAssessmentResult) => {
      // Sort by type (e.g., "quiz", "assignment", "final_exam") then by assessmentNo
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return (a.assessmentNo || 0) - (b.assessmentNo || 0);
    });

  // Calculate final grade (simple average of numeric grade labels)
  const validGrades = assessmentResults
    .filter((assessment: ProcessedAssessmentResult) => assessment.gradeLabel !== "--")
    .map((assessment: ProcessedAssessmentResult) => parseFloat(assessment.gradeLabel));

  const finalGrade =
    validGrades.length > 0
      ? validGrades.reduce((sum: number, grade: number) => sum + grade, 0) / validGrades.length
      : null; // null if no valid grades

  // Determine remarks based on final grade
  let remarks = "No remarks";
  if (finalGrade !== null) {
    // const finalGradeLabel = finalGrade.toFixed(2); // Format to two decimal places
    // const matchedRemark = gradingScale.find((scale: any) => finalGradeLabel === scale.gradeLabel); // This needs adjustment if finalGrade is not an exact label
    // A more robust approach for remarks would be to map ranges or use a specific remarking logic
    if (finalGrade <= 1.75) remarks = "Excellent";
    else if (finalGrade <= 2.75) remarks = "Good";
    else if (finalGrade <= 3.75) remarks = "Fair";
    else if (finalGrade <= 4.0) remarks = "Passed";
    else remarks = "Failed"; // if finalGrade > 4.0 or null
  }

  return {
    studentId,
    sectionId,
    assessments: assessmentResults,
    finalGrade: finalGrade !== null ? finalGrade.toFixed(2) : "--", // Display formatted grade or "--"
    remarks,
  };
}
