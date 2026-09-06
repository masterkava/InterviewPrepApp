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


# --- Interview lifecycle schemas ---

class QuestionResponse(BaseModel):
    id: UUID
    sequence_number: int
    question_text: str
    difficulty: str
    skill: str
    question_type: str
    parent_question_id: UUID | None = None


class ProgressResponse(BaseModel):
    current: int
    total: int
    skills_covered: list[str]
    skills_remaining: list[str]


class InterviewStartResponse(BaseModel):
    session_id: UUID
    status: str
    interviewer_message: str
    question: QuestionResponse
    progress: ProgressResponse


class AnswerRequest(BaseModel):
    question_id: UUID
    answer_text: str = Field(min_length=1)
    response_time_seconds: int | None = None


class EvaluationResponse(BaseModel):
    question_id: UUID
    overall_score: float
    technical_correctness: float
    conceptual_depth: float
    communication_clarity: float
    relevance: float
    problem_solving: float
    completeness: float
    feedback: str
    strengths: list[str]
    weaknesses: list[str]


class AnswerResponse(BaseModel):
    evaluation: EvaluationResponse
    next_question: QuestionResponse | None
    progress: ProgressResponse
    interview_complete: bool
    closing_message: str | None = None


class InterviewCompleteResponse(BaseModel):
    session_id: UUID
    status: str
    questions_asked: int
    question_budget: int
    message: str
