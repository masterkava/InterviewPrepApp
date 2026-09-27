const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './tokenStorage';
import type {
  AuthTokenResponse,
  LoginData,
  ProfileSetupData,
  ProfileSetupResponse,
  RegisterData,
  RequestOTPResponse,
  UserProfile,
} from '../types/auth';

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

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

export async function ensureFreshToken(): Promise<string | null> {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiresAt = payload.exp * 1000;
    if (Date.now() < expiresAt - 60_000) return token;
  } catch {
    return token;
  }
  if (!isRefreshing) {
    isRefreshing = true;
    refreshPromise = tryRefreshToken().finally(() => { isRefreshing = false; });
  }
  const ok = await refreshPromise;
  refreshPromise = null;
  return ok ? getAccessToken() : null;
}

async function tryRefreshToken(): Promise<boolean> {
  const rt = getRefreshToken();
  if (!rt) return false;

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });

    if (!response.ok) {
      clearTokens();
      return false;
    }

    const data: AuthTokenResponse = await response.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && token) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = tryRefreshToken().finally(() => {
        isRefreshing = false;
      });
    }
    const ok = await refreshPromise;
    refreshPromise = null;

    if (ok) {
      const newToken = getAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        const retry = await fetch(`${API_BASE}${path}`, { ...options, headers });
        if (retry.ok) return retry.json() as Promise<T>;
      }
    }

    clearTokens();
    window.location.href = '/login';
    throw new ApiError(401, 'AUTH_ERROR', 'Session expired');
  }

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

function requestNoAuth<T>(path: string, options?: RequestInit): Promise<T> {
  return fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  }).then(async (response) => {
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
  });
}

// --- Auth (password) ---
export async function registerUser(data: RegisterData): Promise<AuthTokenResponse> {
  return requestNoAuth<AuthTokenResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function loginUser(data: LoginData): Promise<AuthTokenResponse> {
  return requestNoAuth<AuthTokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// --- Auth (password reset) ---
export async function forgotPassword(email: string): Promise<{ message: string }> {
  return requestNoAuth<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, new_password: string): Promise<{ message: string }> {
  return requestNoAuth<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, new_password }),
  });
}

// --- Auth (OTP) ---
export async function requestOTP(email: string): Promise<RequestOTPResponse> {
  return requestNoAuth<RequestOTPResponse>('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifyOTP(email: string, code: string): Promise<AuthTokenResponse> {
  return requestNoAuth<AuthTokenResponse>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
}

export async function logoutAPI(): Promise<void> {
  await request<{ message: string }>('/auth/logout', { method: 'POST' });
}

export async function getProfile(): Promise<UserProfile> {
  return request<UserProfile>('/auth/me');
}

export async function setupProfileAPI(data: ProfileSetupData): Promise<ProfileSetupResponse> {
  return request<ProfileSetupResponse>('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// --- Health ---
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

export async function resumeInterview(interviewId: string): Promise<InterviewStartResponse> {
  return request<InterviewStartResponse>(`/interviews/${interviewId}/resume`);
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
  limit = 20,
  offset = 0,
): Promise<InterviewHistoryResponse> {
  return request<InterviewHistoryResponse>(
    `/users/me/interviews?limit=${limit}&offset=${offset}`,
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

// --- Voice ---
export interface TTSResponse {
  audio_url: string;
  cached: boolean;
}

export interface STTResponse {
  text: string;
}

export async function textToSpeech(text: string): Promise<TTSResponse> {
  return request<TTSResponse>('/voice/tts', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function speechToText(audioBlob: Blob): Promise<STTResponse> {
  const token = getAccessToken();
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/voice/stt`, {
    method: 'POST',
    body: formData,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body?.error?.code || 'UNKNOWN', body?.detail || response.statusText);
  }

  return response.json() as Promise<STTResponse>;
}

export async function uploadAudio(audioBlob: Blob): Promise<{ audio_url: string }> {
  const token = getAccessToken();
  const formData = new FormData();
  formData.append('audio', audioBlob, 'answer.webm');

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/voice/upload`, {
    method: 'POST',
    body: formData,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body?.error?.code || 'UNKNOWN', body?.detail || response.statusText);
  }

  return response.json();
}

export { ApiError };
