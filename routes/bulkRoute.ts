import { Router, Response } from "express";
import { API_ENDPOINTS } from "../config/endpointsConfig";
import categoryService from "../services/categoryService";
import facultyService from "../services/facultyService";
import programService from "../services/programService";
import { upload } from "../middleware/multer";
import { parseCSVBuffer } from "../utils/csvUtils/csvUtils";
import { parseCSVBufferOptimized } from "../utils/csvUtils/streamingCsvParser";
import { bulkOperationTimeout } from "../middleware/timeoutMiddleware";
import { CustomRequest } from "../type/types";

const router = Router();

router.use(bulkOperationTimeout);

/**
 * @swagger
 * /bulk/create:
 *   post:
 *     summary: Bulk create categories, faculties, and programs
 *     description: Accepts a CSV file upload and creates categories, faculties, or programs based on the 'field' property in each row. Supports large datasets with batch processing and streaming for files > 1MB.
 *     tags: [Bulk]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               chunkSize:
 *                 type: integer
 *                 description: Number of records to process per batch (default 50)
 *                 default: 50
 *               useStreaming:
 *                 type: boolean
 *                 description: Use streaming parser for very large files (auto-enabled for files > 1MB)
 *                 default: false
 *     responses:
 *       200:
 *         description: Bulk creation result
 *       504:
 *         description: Request timeout - operation took too long
 *       413:
 *         description: File too large
 *       503:
 *         description: Service temporarily unavailable
 */
router.post(
  API_ENDPOINTS.BULK.CREATE,
  upload.single("file"),
  async (req: CustomRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "CSV file is required.",
        hint: "Please upload a valid CSV file with 'field' column specifying record types (category, faculty, program)",
      });
    }

    if (!req.user?.organizationId) {
      return res
        .status(401)
        .json({ success: false, message: "User not authenticated or missing organization." });
    }

    const organizationId = req.user.organizationId;
    const chunkSize = Math.min(parseInt(req.body.chunkSize) || 100, 200);
    const useStreaming = req.body.useStreaming === "true" || req.file.size > 5 * 1024 * 1024;

    let rows: any[];

    try {
      if (useStreaming) {
        rows = await parseCSVBufferOptimized(req.file.buffer);
      } else {
        rows = await parseCSVBuffer(req.file.buffer);
      }
    } catch (err: any) {
      const error = {
        success: false,
        message: "Failed to parse CSV file.",
        error: err.message,
        hint: "Please ensure your CSV file is properly formatted with headers and valid data",
        fileSize: req.file.size,
        fileName: req.file.originalname,
      };

      return res.status(400).json(error);
    }

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "CSV file is empty or contains no valid data.",
        hint: "Please ensure your CSV file contains data rows with the required 'field' column",
      });
    }

    const groupedRows: Record<string, any[]> = {};

    for (const row of rows) {
      const field = (row.field || "unknown").toLowerCase().trim();
      if (field === "unknown" || field === "") {
        continue;
      }
      if (!groupedRows[field]) groupedRows[field] = [];
      groupedRows[field].push(row);
    }

    const groupedResults: Record<string, any[]> = {};
    const groupedErrors: Record<string, any[]> = {};
    let totalProcessed = 0;
    let totalErrors = 0;

    function formatBulkError(
      field: string,
      row: any,
      error: any
    ): { type: string; data: any; error: string } {
      const message = error.message || error.toString();
      const type = capitalize(field);

      const getCustomMessage = (field: string, row: any): string | undefined => {
        const messages: Record<string, { key: string; label: string }> = {
          category: { key: "name", label: "Category name" },
          faculty: { key: "code", label: "Faculty code" },
          program: { key: "code", label: "Program code" },
        };
        const config = messages[field];
        return config && row[config.key]
          ? `${config.label} '${row[config.key]}' already exists in this organization.`
          : undefined;
      };

      let formattedMessage: string;
      if (message.includes("E11000 duplicate key error") || message.includes("already exists")) {
        const dupKeyMatch = message.match(/index: \w+_1 dup key: { (\w+): "([^"]+)" }/);
        if (dupKeyMatch) {
          const [, key, value] = dupKeyMatch;
          formattedMessage = `${type} ${key} '${value}' already exists in this organization.`;
        } else {
          formattedMessage =
            getCustomMessage(field, row) ||
            (message.includes("already exists") && !message.includes("organization")
              ? `${message} in this organization.`
              : `${type} already exists in this organization.`);
        }
      } else {
        formattedMessage = message;
      }

      return { type: field, data: row, error: formattedMessage };
    }

    function capitalize(str: string): string {
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    for (const field of Object.keys(groupedRows)) {
      const fieldRows = groupedRows[field];
      totalProcessed += fieldRows.length;

      try {
        let result: any[] = [];
        let errors: any[] = [];

        if (fieldRows.length > 500) {
          if (global.gc) {
            global.gc();
          }
        }

        switch (field) {
          case "category": {
            const { inserted, errors: errs } = await categoryService.bulkCreateCategory(
              fieldRows.map((row) => ({
                name: row.name,
                isActive: row.isActive === "true" || row.isActive === true,
                organizationId,
                archive: {
                  status: row.archive_status === "true" || row.archive_status === true,
                  date: row.archive_date || null,
                },
              }))
            );
            result = inserted;

            const actualErrorCount = errs.length;
            errors = errs.map((e, i) =>
              formatBulkError(field, fieldRows[i] || e.data, e.error || e)
            );

            totalErrors += actualErrorCount;
            break;
          }
          case "faculty": {
            const { inserted, errors: errs } = await facultyService.bulkCreateFaculty(
              fieldRows.map((row) => ({
                name: row.name,
                code: row.code,
                description: row.description,
                isActive: row.isActive === "true" || row.isActive === true,
                archive: {
                  status: row.archive_status === "true" || row.archive_status === true,
                  date: row.archive_date || null,
                },
              })),
              organizationId,
              {
                chunkSize,
              }
            );
            result = inserted;
            errors = errs.map((e, i) =>
              formatBulkError(field, fieldRows[i] || e.data, e.error || e)
            );
            totalErrors += errs.length;
            break;
          }
          case "program": {
            const { inserted, errors: errs } = await programService.bulkCreateProgram(
              fieldRows.map((row) => ({
                code: row.code,
                name: row.name,
                description: row.description,
                archive: {
                  status: row.archive_status === "true" || row.archive_status === true,
                  date: row.archive_date || null,
                },
              })),
              organizationId,
              {
                chunkSize,
              }
            );
            result = inserted;
            errors = errs.map((e, i) =>
              formatBulkError(field, fieldRows[i] || e.data, e.error || e)
            );
            totalErrors += errs.length;
            break;
          }
          default:
            errors = fieldRows.map((row) =>
              formatBulkError(
                field,
                row,
                new Error(
                  `Unknown field type: '${field}'. Supported types: category, faculty, program`
                )
              )
            );
            result = [];
            totalErrors += fieldRows.length;
        }

        if (result && result.length > 0) groupedResults[field] = result;
        if (errors && errors.length > 0) {
          groupedErrors[field] = errors;
        }
      } catch (error: any) {
        const fieldErrors = fieldRows.map((row) => formatBulkError(field, row, error));
        groupedErrors[field] = fieldErrors;
        totalErrors += fieldErrors.length;
      }
    }

    const totalSuccessful = totalProcessed - totalErrors;
    const overallSuccess = totalSuccessful > 0;

    const hasErrors = totalErrors > 0;

    const response = {
      success: overallSuccess,
      partialSuccess: overallSuccess && hasErrors,
      results: groupedResults,
      errors: groupedErrors,
      totalProcessed,
      totalErrors,
    };

    res.json(response);
  }
);

export default router;
