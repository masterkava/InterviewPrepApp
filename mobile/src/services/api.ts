import { API_BASE } from '../constants/config';
import { getCached, setCache } from './cache';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './tokenStorage';
import type { RolesListResponse, RoleSkillsResponse } from '../types/role';
import type {
  AnswerRequest,
  AnswerResponse,
  InterviewCompleteResponse,
  InterviewConfig,
  InterviewHistoryResponse,
  InterviewSession,
  InterviewStartResponse,
  QuestionBankMetaResponse,
  QuestionBankResponse,
  ReportResponse,
} from '../types/interview';
import type {
  AuthTokenResponse,
  ProfileSetupData,
  ProfileSetupResponse,
  RequestOTPResponse,
  UserProfile,
} from '../types/auth';

export class ApiError extends Error {
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
let refreshPromise: Promise<void> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  const rt = await getRefreshToken();
  if (!rt) return false;

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });

    if (!response.ok) {
      await clearTokens();
      return false;
    }

    const data: AuthTokenResponse = await response.json();
    await setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    await clearTokens();
    return false;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const method = options?.method ?? 'GET';
  const maxRetries = method === 'GET' ? 2 : 0;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }

      const token = await getAccessToken();
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
          refreshPromise = tryRefreshToken().then((ok) => {
            isRefreshing = false;
            refreshPromise = null;
            if (!ok) throw new ApiError(401, 'AUTH_ERROR', 'Session expired');
          });
        }
        await refreshPromise;

        const newToken = await getAccessToken();
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
          const retry = await fetch(`${API_BASE}${path}`, { ...options, headers });
          if (retry.ok) return retry.json() as Promise<T>;
        }
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
    } catch (err) {
      lastError = err as Error;
      if (err instanceof ApiError && err.status < 500) throw err;
    }
  }

  throw lastError!;
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

// --- Auth ---
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

export async function refreshAuthToken(refreshToken: string): Promise<AuthTokenResponse> {
  return requestNoAuth<AuthTokenResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
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
export async function getHealth() {
  return request<{ status: string; version: string; database: string }>('/health');
}

// --- Roles ---
export async function getRoles(): Promise<RolesListResponse> {
  const cached = await getCached<RolesListResponse>('roles', 10 * 60 * 1000);
  if (cached) return cached;
  const data = await request<RolesListResponse>('/roles');
  setCache('roles', data);
  return data;
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

export async function resumeInterview(
  interviewId: string,
): Promise<InterviewStartResponse> {
  return request<InterviewStartResponse>(`/interviews/${interviewId}/resume`);
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
  const cached = await getCached<QuestionBankMetaResponse>('qb_meta', 10 * 60 * 1000);
  if (cached) return cached;
  const data = await request<QuestionBankMetaResponse>('/question-bank/meta');
  setCache('qb_meta', data);
  return data;
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

export function getAudioUrl(path: string): string {
  return path.startsWith('http') ? path : `${API_BASE.replace('/api/v1', '')}${path}`;
}

export async function speechToText(uri: string): Promise<STTResponse> {
  const token = await getAccessToken();
  const formData = new FormData();
  formData.append('audio', {
    uri,
    type: 'audio/mp4',
    name: 'recording.m4a',
  } as any);

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
