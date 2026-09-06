"""Pydantic schemas for validating LLM outputs."""

from pydantic import BaseModel, Field


class QuestionGenerationOutput(BaseModel):
    question_text: str
    difficulty: str = Field(pattern=r"^(easy|medium|hard)$")
    skill_area: str
    reasoning: str


class FollowUpOutput(BaseModel):
    question_text: str
    difficulty: str = Field(pattern=r"^(easy|medium|hard)$")
    follow_up_purpose: str = Field(
        pattern=r"^(probe_deeper|clarify|explore_practical|correct_misconception)$"
    )


class EvaluationOutput(BaseModel):
    technical_correctness: float = Field(ge=0, le=10)
    conceptual_depth: float = Field(ge=0, le=10)
    communication_clarity: float = Field(ge=0, le=10)
    relevance: float = Field(ge=0, le=10)
    problem_solving: float = Field(ge=0, le=10)
    completeness: float = Field(ge=0, le=10)
    overall_score: float = Field(ge=0, le=10)
    strengths: list[str]
    weaknesses: list[str]
    feedback: str
    follow_up_recommended: bool
    follow_up_reason: str | None = None


class ReportAnalysisOutput(BaseModel):
    summary: str
    strengths: list[str]
    weaknesses: list[str]
    recommendations: list[str]
    recommended_topics: list[str]
