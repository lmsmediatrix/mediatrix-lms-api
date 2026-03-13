import UserModel from "../models/userModel";
import StudentModel from "../models/studentModel";
import InstructorModel from "../models/instructorModel";
import CourseModel from "../models/courseModel";
import ModuleModel from "../models/moduleModel";
import SectionModel from "../models/sectionModel";
import AssessmentModel from "../models/assessmentModel";
import OrganizationModel from "../models/organizationModel";

// Add more imports as needed for other entity types

export async function populateAuditLogEntities(
  auditLogs: any[],
  populateOptions?: { model?: string; data?: string[] }
) {
  return Promise.all(
    auditLogs.map(async (log) => {
      let populatedEntity = null;
      switch (log.entity?.type) {
        case "USER":
          populatedEntity = await UserModel.findById(log.entity.id).lean();
          break;
        case "STUDENT":
          populatedEntity = await StudentModel.findById(log.entity.id).lean();
          break;
        case "INSTRUCTOR":
          populatedEntity = await InstructorModel.findById(log.entity.id).lean();
          break;
        case "COURSE":
          populatedEntity = await CourseModel.findById(log.entity.id).lean();
          break;
        case "MODULE":
          populatedEntity = await ModuleModel.findById(log.entity.id).lean();
          break;
        case "SECTION":
          populatedEntity = await SectionModel.findById(log.entity.id).lean();
          break;
        case "ASSESSMENT":
          populatedEntity = await AssessmentModel.findById(log.entity.id).lean();
          break;
        case "ORGANIZATION":
          if (populateOptions?.model === "Organization" && populateOptions?.data) {
            populatedEntity = await OrganizationModel.findById(log.entity.id)
              .select(populateOptions.data.join(" "))
              .lean();
          } else {
            populatedEntity = await OrganizationModel.findById(log.entity.id).lean();
          }
          break;
        default:
          populatedEntity = null;
      }
      return {
        ...log,
        entity: {
          ...log.entity,
          data: populatedEntity,
        },
      };
    })
  );
}
