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
import type { InterviewConfig, InterviewSession } from '../types/interview';

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

export { ApiError };
