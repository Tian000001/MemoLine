import { http } from './index';
import type {
  AnalysisReport,
  AnalysisReportListResponse,
  CreateAnalysisRequest,
} from '@shared/api.interface';

export async function getReports(): Promise<AnalysisReportListResponse> {
  const response = await http.get('/analysis/reports');
  return response.data;
}

export async function getReport(id: string): Promise<AnalysisReport> {
  const response = await http.get(`/analysis/reports/${id}`);
  return response.data;
}

export async function createReport(data: CreateAnalysisRequest): Promise<AnalysisReport> {
  const response = await http.post('/analysis/reports', data);
  return response.data;
}

export async function deleteReport(id: string): Promise<void> {
  await http.delete(`/analysis/reports/${id}`);
}
