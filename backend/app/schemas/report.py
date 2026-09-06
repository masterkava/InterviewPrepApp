"""Pydantic schemas for interview reports and history."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class QuestionEvaluation(BaseModel):
    overall_score: float
    feedback: str
    strengths: list[str]
    weaknesses: list[str]


class ReportQuestion(BaseModel):
    sequence_number: int
    question_text: str
    answer_text: str
    evaluation: QuestionEvaluation


class ReportResponse(BaseModel):
    id: UUID
    session_id: UUID
    overall_score: float
    technical_score: float
    communication_score: float
    problem_solving_score: float
    confidence_score: float
    readiness_level: str
    summary: str
    strengths: list[str]
    weaknesses: list[str]
    recommendations: list[str]
    recommended_topics: list[str]
    category_breakdown: dict[str, float]
    questions: list[ReportQuestion]
    created_at: datetime


class InterviewHistoryItem(BaseModel):
    id: UUID
    role_name: str
    experience_level: str
    status: str
    overall_score: float | None
    questions_asked: int
    started_at: datetime | None
    completed_at: datetime | None


class InterviewHistoryResponse(BaseModel):
    interviews: list[InterviewHistoryItem]
    total: int
    limit: int
    offset: int
