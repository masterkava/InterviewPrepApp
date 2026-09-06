"""Pydantic schemas for interview sessions."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class InterviewCreateRequest(BaseModel):
    user_id: UUID | None = None
    role_id: UUID
    experience_level: str = Field(pattern=r"^(fresher|junior|mid|senior)$")
    difficulty: str = Field(default="adaptive", pattern=r"^(easy|medium|hard|adaptive)$")
    duration_minutes: int = Field(default=30, ge=10, le=60)
    focus_areas: list[str] | None = None


class InterviewRoleInfo(BaseModel):
    id: UUID
    name: str


class InterviewCreateResponse(BaseModel):
    id: UUID
    user_id: UUID
    role: InterviewRoleInfo
    experience_level: str
    difficulty: str
    duration_minutes: int
    question_budget: int
    focus_areas: list[str] | None
    status: str
    created_at: datetime
