from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import GUID, JSONType, BaseModel

if TYPE_CHECKING:
    from app.models.role import Role, Skill
    from app.models.user import User


class InterviewSession(BaseModel):
    __tablename__ = "interview_sessions"
    __table_args__ = (
        CheckConstraint(
            "status IN ('configured', 'in_progress', 'completed', 'abandoned')",
            name="ck_session_status",
        ),
        CheckConstraint(
            "experience_level IN ('fresher', 'junior', 'mid', 'senior')",
            name="ck_experience_level",
        ),
        CheckConstraint(
            "difficulty IN ('easy', 'medium', 'hard', 'adaptive')",
            name="ck_difficulty",
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("roles.id"), nullable=False
    )
    experience_level: Mapped[str] = mapped_column(String(20), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False, default="adaptive")
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="configured")
    focus_areas: Mapped[dict | None] = mapped_column(JSONType(), nullable=True)
    question_budget: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    questions_asked: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User] = relationship(back_populates="interview_sessions", lazy="joined")
    role: Mapped[Role] = relationship(lazy="joined")
    questions: Mapped[list[InterviewQuestion]] = relationship(
        back_populates="session", lazy="noload", cascade="all, delete-orphan"
    )


class InterviewQuestion(BaseModel):
    __tablename__ = "interview_questions"

    session_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("interview_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    skill_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("skills.id"), nullable=True
    )
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    question_type: Mapped[str] = mapped_column(String(20), nullable=False, default="initial")
    parent_question_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(),
        ForeignKey("interview_questions.id"),
        nullable=True,
    )
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONType(), nullable=True)

    session: Mapped[InterviewSession] = relationship(back_populates="questions", lazy="joined")
    skill: Mapped[Skill | None] = relationship(lazy="joined")
    answer: Mapped[InterviewAnswer | None] = relationship(
        back_populates="question", lazy="selectin", uselist=False
    )
    parent_question: Mapped[InterviewQuestion | None] = relationship(
        remote_side="InterviewQuestion.id", lazy="noload"
    )


class InterviewAnswer(BaseModel):
    __tablename__ = "interview_answers"

    question_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("interview_questions.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    answer_text: Mapped[str] = mapped_column(Text, nullable=False)
    response_time_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    question: Mapped[InterviewQuestion] = relationship(back_populates="answer", lazy="joined")
    evaluation: Mapped[Evaluation | None] = relationship(
        back_populates="answer", lazy="selectin", uselist=False
    )


class Evaluation(BaseModel):
    __tablename__ = "evaluations"

    answer_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("interview_answers.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    technical_correctness: Mapped[float] = mapped_column(Float, nullable=False)
    conceptual_depth: Mapped[float] = mapped_column(Float, nullable=False)
    communication_clarity: Mapped[float] = mapped_column(Float, nullable=False)
    relevance: Mapped[float] = mapped_column(Float, nullable=False)
    problem_solving: Mapped[float] = mapped_column(Float, nullable=False)
    completeness: Mapped[float] = mapped_column(Float, nullable=False)
    overall_score: Mapped[float] = mapped_column(Float, nullable=False)
    feedback: Mapped[str] = mapped_column(Text, nullable=False)
    strengths: Mapped[dict | None] = mapped_column(JSONType(), nullable=True)
    weaknesses: Mapped[dict | None] = mapped_column(JSONType(), nullable=True)
    follow_up_recommended: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    follow_up_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    prompt_version: Mapped[str] = mapped_column(String(20), nullable=False, default="v1")

    answer: Mapped[InterviewAnswer] = relationship(back_populates="evaluation", lazy="joined")


class InterviewReport(BaseModel):
    __tablename__ = "interview_reports"

    session_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("interview_sessions.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    overall_score: Mapped[float] = mapped_column(Float, nullable=False)
    technical_score: Mapped[float] = mapped_column(Float, nullable=False)
    communication_score: Mapped[float] = mapped_column(Float, nullable=False)
    problem_solving_score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    readiness_level: Mapped[str] = mapped_column(String(20), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    strengths: Mapped[dict | None] = mapped_column(JSONType(), nullable=True)
    weaknesses: Mapped[dict | None] = mapped_column(JSONType(), nullable=True)
    recommendations: Mapped[dict | None] = mapped_column(JSONType(), nullable=True)
    recommended_topics: Mapped[dict | None] = mapped_column(JSONType(), nullable=True)
    category_breakdown: Mapped[dict | None] = mapped_column(JSONType(), nullable=True)
    questions_data: Mapped[dict | None] = mapped_column(JSONType(), nullable=True)
    prompt_version: Mapped[str] = mapped_column(String(20), nullable=False, default="v1")

    session: Mapped[InterviewSession] = relationship(lazy="joined")
