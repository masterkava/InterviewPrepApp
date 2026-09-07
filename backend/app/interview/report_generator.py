"""Report generator — deterministic score aggregation + LLM qualitative analysis."""

import math
import uuid
from dataclasses import dataclass

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.provider import LLMProvider
from app.ai.schemas import ReportAnalysisOutput
from app.config import settings
from app.models.interview import (
    Evaluation,
    InterviewAnswer,
    InterviewQuestion,
    InterviewReport,
    InterviewSession,
)
from app.prompts.manager import render_prompt

logger = structlog.get_logger()


@dataclass
class ScoreAggregation:
    technical_score: float
    communication_score: float
    problem_solving_score: float
    overall_score: float
    confidence_score: float
    readiness_level: str
    category_breakdown: dict[str, float]


def aggregate_scores(evaluations: list[Evaluation]) -> ScoreAggregation:
    if not evaluations:
        return ScoreAggregation(
            technical_score=0, communication_score=0, problem_solving_score=0,
            overall_score=0, confidence_score=0, readiness_level="not_ready",
            category_breakdown={},
        )

    tc = [e.technical_correctness for e in evaluations]
    cd = [e.conceptual_depth for e in evaluations]
    comp = [e.completeness for e in evaluations]
    cc = [e.communication_clarity for e in evaluations]
    ps = [e.problem_solving for e in evaluations]
    rel = [e.relevance for e in evaluations]

    avg = lambda vals: sum(vals) / len(vals)

    technical_score = (avg(tc) * 0.40 + avg(cd) * 0.35 + avg(comp) * 0.25) * 10
    communication_score = avg(cc) * 10
    problem_solving_score = (avg(ps) * 0.60 + avg(rel) * 0.40) * 10

    overall_score = (
        technical_score * 0.45
        + communication_score * 0.25
        + problem_solving_score * 0.30
    )

    per_q_scores = [e.overall_score for e in evaluations]
    if len(per_q_scores) > 1:
        mean = avg(per_q_scores)
        variance = sum((s - mean) ** 2 for s in per_q_scores) / len(per_q_scores)
        std_dev = math.sqrt(variance)
        confidence_score = max(0.0, min(100.0, 100 - std_dev * 10))
    else:
        confidence_score = 50.0

    readiness_level = _map_readiness(overall_score)

    category_breakdown = {
        "technical_correctness": round(avg(tc) * 10, 1),
        "conceptual_depth": round(avg(cd) * 10, 1),
        "communication_clarity": round(avg(cc) * 10, 1),
        "problem_solving": round(avg(ps) * 10, 1),
        "completeness": round(avg(comp) * 10, 1),
        "relevance": round(avg(rel) * 10, 1),
    }

    return ScoreAggregation(
        technical_score=round(technical_score, 1),
        communication_score=round(communication_score, 1),
        problem_solving_score=round(problem_solving_score, 1),
        overall_score=round(overall_score, 1),
        confidence_score=round(confidence_score, 1),
        readiness_level=readiness_level,
        category_breakdown=category_breakdown,
    )


def _map_readiness(overall_score: float) -> str:
    if overall_score >= 86:
        return "strong"
    if overall_score >= 71:
        return "ready"
    if overall_score >= 51:
        return "almost_ready"
    if overall_score >= 31:
        return "needs_work"
    return "not_ready"


class ReportGenerator:
    def __init__(self, provider: LLMProvider, session: AsyncSession) -> None:
        self._provider = provider
        self._db = session

    async def generate_report(self, interview: InterviewSession) -> InterviewReport:
        questions_with_evals = await self._load_questions(interview.id)

        evaluations = []
        questions_data = []
        transcript_lines = []

        for q in questions_with_evals:
            if not q.answer or not q.answer.evaluation:
                continue
            ev = q.answer.evaluation
            evaluations.append(ev)

            questions_data.append({
                "sequence_number": q.sequence_number,
                "question_text": q.question_text,
                "answer_text": q.answer.answer_text,
                "evaluation": {
                    "overall_score": ev.overall_score,
                    "feedback": ev.feedback,
                    "strengths": ev.strengths,
                    "weaknesses": ev.weaknesses,
                },
            })

            transcript_lines.append(
                f"Q{q.sequence_number}: {q.question_text}\n"
                f"A: {q.answer.answer_text}\n"
                f"Score: {ev.overall_score}/10 — {ev.feedback}\n"
            )

        scores = aggregate_scores(evaluations)

        analysis = await self._generate_qualitative_analysis(
            interview=interview,
            scores=scores,
            transcript="\n".join(transcript_lines),
            questions_answered=len(evaluations),
        )

        report = InterviewReport(
            id=uuid.uuid4(),
            session_id=interview.id,
            overall_score=scores.overall_score,
            technical_score=scores.technical_score,
            communication_score=scores.communication_score,
            problem_solving_score=scores.problem_solving_score,
            confidence_score=scores.confidence_score,
            readiness_level=scores.readiness_level,
            summary=analysis.summary,
            strengths=analysis.strengths,
            weaknesses=analysis.weaknesses,
            recommendations=analysis.recommendations,
            recommended_topics=analysis.recommended_topics,
            category_breakdown=scores.category_breakdown,
            questions_data=questions_data,
            prompt_version=settings.prompt_version,
        )
        self._db.add(report)
        await self._db.flush()
        return report

    async def _generate_qualitative_analysis(
        self,
        interview: InterviewSession,
        scores: ScoreAggregation,
        transcript: str,
        questions_answered: int,
    ) -> ReportAnalysisOutput:
        try:
            user_prompt = render_prompt(
                settings.prompt_version, "reporter", "report_generation",
                role_name=interview.role.name,
                experience_level=interview.experience_level,
                questions_answered=questions_answered,
                overall_score=round(scores.overall_score),
                technical_score=round(scores.technical_score),
                communication_score=round(scores.communication_score),
                problem_solving_score=round(scores.problem_solving_score),
                transcript=transcript or "No transcript available.",
            )

            return await self._provider.chat_completion(
                messages=[
                    {"role": "system", "content": "You are an expert interview report analyst. Produce insightful, actionable feedback. Respond only with valid JSON."},
                    {"role": "user", "content": user_prompt},
                ],
                output_schema=ReportAnalysisOutput,
                model=settings.llm_model_evaluation,
            )
        except Exception:
            logger.warning("llm.report_analysis_failed_using_deterministic_fallback")
            return self._deterministic_analysis(interview, scores)

    def _deterministic_analysis(
        self,
        interview: InterviewSession,
        scores: ScoreAggregation,
    ) -> ReportAnalysisOutput:
        role = interview.role.name
        level = interview.experience_level
        overall = scores.overall_score

        if overall >= 71:
            summary = f"Strong performance in the {role} interview. The candidate demonstrated solid technical knowledge appropriate for {level}-level expectations."
        elif overall >= 51:
            summary = f"Adequate performance in the {role} interview. The candidate showed understanding of core concepts but has room for improvement in several areas."
        elif overall >= 31:
            summary = f"Below-average performance in the {role} interview. Several fundamental concepts need further study and practice."
        else:
            summary = f"The candidate struggled with most topics in the {role} interview. A focused study plan is recommended before reattempting."

        strengths = []
        weaknesses = []
        recommendations = []
        weak_topics = []

        breakdown = scores.category_breakdown
        for cat, score in breakdown.items():
            label = cat.replace("_", " ").title()
            if score >= 70:
                strengths.append(f"Good {label} ({score}/100)")
            elif score < 40:
                weaknesses.append(f"Weak {label} ({score}/100)")
                weak_topics.append(label)

        if not strengths:
            strengths.append("Participated and attempted all questions")
        if not weaknesses:
            weaknesses.append("Could provide more depth and real-world examples")

        if weak_topics:
            recommendations.append(f"Focus study on: {', '.join(weak_topics[:3])}")
        recommendations.append("Practice explaining concepts clearly and concisely")
        if overall < 51:
            recommendations.append("Review fundamental concepts before attempting more advanced topics")

        return ReportAnalysisOutput(
            summary=summary,
            strengths=strengths[:5],
            weaknesses=weaknesses[:5],
            recommendations=recommendations[:5],
            recommended_topics=weak_topics[:5] if weak_topics else ["General review"],
        )

    async def _load_questions(self, session_id: uuid.UUID) -> list[InterviewQuestion]:
        result = await self._db.execute(
            select(InterviewQuestion)
            .where(InterviewQuestion.session_id == session_id)
            .options(
                selectinload(InterviewQuestion.answer)
                .selectinload(InterviewAnswer.evaluation),
            )
            .order_by(InterviewQuestion.sequence_number)
        )
        return list(result.scalars().unique().all())
