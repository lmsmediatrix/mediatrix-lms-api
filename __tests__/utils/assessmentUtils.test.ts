import { describe, expect, test } from "@jest/globals";
import { evaluateAnswer, processResponses } from "../../utils/assessmentUtils";

describe("assessmentUtils", () => {
  describe("evaluateAnswer", () => {
    test("should correctly evaluate checkbox questions when all correct options are selected", () => {
      const question = {
        _id: 1,
        type: "checkbox",
        questionText: "Select all that apply",
        options: [
          { _id: 1, option: "Option 1", text: "1", isCorrect: true },
          { _id: 2, option: "Option 2", text: "2", isCorrect: true },
          { _id: 3, option: "Option 3", text: "3", isCorrect: true },
          { _id: 4, option: "Option 4", text: "4", isCorrect: false },
        ],
        points: 5,
      };

      const answer = ["Option 1", "Option 2", "Option 3"];

      const result = evaluateAnswer(question, answer);

      expect(result.isCorrect).toBe(true);
      expect(result.pointsEarned).toBe(5);
    });

    test("should mark checkbox question incorrect when not all correct options are selected", () => {
      const question = {
        _id: 1,
        type: "checkbox",
        questionText: "Select all that apply",
        options: [
          { _id: 1, option: "Option 1", text: "1", isCorrect: true },
          { _id: 2, option: "Option 2", text: "2", isCorrect: true },
          { _id: 3, option: "Option 3", text: "3", isCorrect: true },
          { _id: 4, option: "Option 4", text: "4", isCorrect: false },
        ],
        points: 5,
      };

      const answer = ["Option 1", "Option 2"];

      const result = evaluateAnswer(question, answer);

      expect(result.isCorrect).toBe(false);
      expect(result.pointsEarned).toBe(0);
    });

    test("should mark checkbox question incorrect when any incorrect option is selected", () => {
      const question = {
        _id: 1,
        type: "checkbox",
        questionText: "Select all that apply",
        options: [
          { _id: 1, option: "Option 1", text: "1", isCorrect: true },
          { _id: 2, option: "Option 2", text: "2", isCorrect: true },
          { _id: 3, option: "Option 3", text: "3", isCorrect: true },
          { _id: 4, option: "Option 4", text: "4", isCorrect: false },
        ],
        points: 5,
      };

      const answer = ["Option 1", "Option 2", "Option 3", "Option 4"];

      const result = evaluateAnswer(question, answer);

      expect(result.isCorrect).toBe(false);
      expect(result.pointsEarned).toBe(0);
    });
  });

  describe("processResponses", () => {
    test("should process multiple checkbox answers correctly", () => {
      const questionsMap = new Map();

      const question1 = {
        _id: 1,
        type: "checkbox",
        questionText: "Select all that apply",
        options: [
          { _id: 1, option: "Option 1", text: "1", isCorrect: true },
          { _id: 2, option: "Option 2", text: "2", isCorrect: true },
          { _id: 3, option: "Option 3", text: "3", isCorrect: false },
        ],
        points: 5,
      };

      questionsMap.set(1, question1);

      const answers = [{ questionId: 1, answer: ["Option 1"] }];

      const results = processResponses(answers, questionsMap);

      expect(results.length).toBe(1);
      expect(results[0].isCorrect).toBe(false);
      expect(results[0].pointsEarned).toBe(0);
    });
  });
});
