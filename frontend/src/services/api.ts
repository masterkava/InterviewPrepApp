const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = body?.error;
    throw new ApiError(
      response.status,
      error?.code || 'UNKNOWN',
      error?.message || response.statusText,
    );
  }

  return response.json() as Promise<T>;
}

export interface HealthResponse {
  status: string;
  version: string;
  database: string;
}

export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health');
}

// --- Roles ---
import type { RolesListResponse, RoleSkillsResponse } from '../types/role';
import type {
  AnswerRequest,
  AnswerResponse,
  InterviewCompleteResponse,
  InterviewConfig,
  InterviewHistoryResponse,
  InterviewSession,
  InterviewStartResponse,
  ReportResponse,
} from '../types/interview';

export async function getRoles(): Promise<RolesListResponse> {
  return request<RolesListResponse>('/roles');
}

export async function getRoleSkills(roleId: string): Promise<RoleSkillsResponse> {
  return request<RoleSkillsResponse>(`/roles/${roleId}/skills`);
}

// --- Interviews ---
export async function createInterview(config: InterviewConfig): Promise<InterviewSession> {
  return request<InterviewSession>('/interviews', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export async function startInterview(interviewId: string): Promise<InterviewStartResponse> {
  return request<InterviewStartResponse>(`/interviews/${interviewId}/start`, {
    method: 'POST',
  });
}

export async function submitAnswer(
  interviewId: string,
  answer: AnswerRequest,
): Promise<AnswerResponse> {
  return request<AnswerResponse>(`/interviews/${interviewId}/answer`, {
    method: 'POST',
    body: JSON.stringify(answer),
  });
}

export async function completeInterview(
  interviewId: string,
): Promise<InterviewCompleteResponse> {
  return request<InterviewCompleteResponse>(`/interviews/${interviewId}/complete`, {
    method: 'POST',
  });
}

// --- Reports ---
export async function getReport(interviewId: string): Promise<ReportResponse> {
  return request<ReportResponse>(`/interviews/${interviewId}/report`);
}

// --- History ---
export async function getUserInterviews(
  userId: string,
  limit = 20,
  offset = 0,
): Promise<InterviewHistoryResponse> {
  return request<InterviewHistoryResponse>(
    `/users/${userId}/interviews?limit=${limit}&offset=${offset}`,
  );
}

// --- Question Bank ---
import type { QuestionBankResponse, QuestionBankMetaResponse } from '../types/interview';

export async function getQuestionBank(params: {
  category?: string;
  topic?: string;
  difficulty?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<QuestionBankResponse> {
  const qs = new URLSearchParams();
  if (params.category) qs.set('category', params.category);
  if (params.topic) qs.set('topic', params.topic);
  if (params.difficulty) qs.set('difficulty', params.difficulty);
  if (params.search) qs.set('search', params.search);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  return request<QuestionBankResponse>(`/question-bank?${qs.toString()}`);
}

export async function getQuestionBankMeta(): Promise<QuestionBankMetaResponse> {
  return request<QuestionBankMetaResponse>('/question-bank/meta');
}

export { ApiError };
