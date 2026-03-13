import metricsRepository from "../repository/metricsRepository";
import { transformOrganizationAnalytics } from "../utils/facetTransformer";
import type {
  CreatePerformanceActionPlanParams,
  PerformanceDashboardParams,
  StudentPerformanceDetailsParams,
} from "../repository/metricsRepository";

const metricsService = {
  searchMetrics,
  getPerformanceDashboard,
  getStudentPerformanceDetails,
  createPerformanceActionPlan,
};

export default metricsService;

async function searchMetrics(model: string, data: string[], filter?: any) {
  const result = await metricsRepository.searchMetrics(model, data, filter);

  if (model === "Organization") {
    return transformOrganizationAnalytics(result);
  }

  return result;
}

async function getPerformanceDashboard(params: PerformanceDashboardParams) {
  return metricsRepository.getPerformanceDashboard(params);
}

async function getStudentPerformanceDetails(params: StudentPerformanceDetailsParams) {
  return metricsRepository.getStudentPerformanceDetails(params);
}

async function createPerformanceActionPlan(params: CreatePerformanceActionPlanParams) {
  return metricsRepository.createPerformanceActionPlan(params);
}
