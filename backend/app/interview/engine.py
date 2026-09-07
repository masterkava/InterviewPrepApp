"""Interview engine — orchestrates the full interview lifecycle."""

import uuid
from dataclasses import dataclass

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select

from app.ai.provider import LLMProvider
from app.ai.schemas import EvaluationOutput
from app.config import settings
from app.interview.adaptive_engine import AdaptiveQuestionEngine
from app.interview.answer_evaluator import AnswerEvaluator
from app.interview.concept_evaluator import evaluate_with_concepts
from app.interview.question_engine import QuestionEngine
from app.interview.state import InterviewState, QuestionRecord
from app.models.interview import (
    Evaluation,
    InterviewAnswer,
    InterviewQuestion,
    InterviewSession,
)
from app.models.role import RoleSkill, SeedQuestion

logger = structlog.get_logger()


@dataclass
class QuestionResult:
    question_id: uuid.UUID
    sequence_number: int
    question_text: str
    difficulty: str
    skill_slug: str
    question_type: str
    parent_question_id: uuid.UUID | None = None


@dataclass
class AnswerResult:
    evaluation: EvaluationOutput
    next_question: QuestionResult | None
    interview_complete: bool
    closing_message: str | None = None


class InterviewEngine:
    def __init__(self, provider: LLMProvider, session: AsyncSession) -> None:
        self._provider = provider
        self._db = session
        self._adaptive_engine = AdaptiveQuestionEngine(session)
        self._question_engine = QuestionEngine(provider)
        self._evaluator = AnswerEvaluator(provider)

    async def start_interview(self, interview: InterviewSession) -> tuple[str, QuestionResult]:
        state = await self._build_state(interview)

        intro = (
            f"Hello! I'm your AI interviewer today. I'll be conducting a {state.role_name} "
            f"interview tailored to your {state.experience_level}-level experience. "
            f"We'll cover approximately {state.question_budget} questions. "
            f"I'll start with some foundational questions and adjust based on your responses. Let's begin!"
        )

        question_output = await self._adaptive_engine.pick_question(state)

        skill_id = self._find_skill_id(interview, question_output.skill_area)
        q = InterviewQuestion(
            id=uuid.uuid4(),
            session_id=interview.id,
            skill_id=skill_id,
            sequence_number=1,
            question_text=question_output.question_text,
            difficulty=question_output.difficulty,
            question_type="initial",
        )
        self._db.add(q)
        interview.questions_asked = 1
        interview.status = "in_progress"
        from datetime import datetime, timezone
        interview.started_at = datetime.now(timezone.utc)
        await self._db.flush()

        return intro, QuestionResult(
            question_id=q.id,
            sequence_number=q.sequence_number,
            question_text=q.question_text,
            difficulty=q.difficulty,
            skill_slug=question_output.skill_area,
            question_type=q.question_type,
        )

    async def process_answer(
        self,
        interview: InterviewSession,
        question: InterviewQuestion,
        answer_text: str,
        response_time_seconds: int | None = None,
    ) -> AnswerResult:
        answer = InterviewAnswer(
            id=uuid.uuid4(),
            question_id=question.id,
            answer_text=answer_text,
            response_time_seconds=response_time_seconds,
        )
        self._db.add(answer)
        await self._db.flush()

        eval_output = await self._evaluate_answer(
            interview=interview,
            question=question,
            answer_text=answer_text,
        )

        evaluation = Evaluation(
            id=uuid.uuid4(),
            answer_id=answer.id,
            technical_correctness=eval_output.technical_correctness,
            conceptual_depth=eval_output.conceptual_depth,
            communication_clarity=eval_output.communication_clarity,
            relevance=eval_output.relevance,
            problem_solving=eval_output.problem_solving,
            completeness=eval_output.completeness,
            overall_score=eval_output.overall_score,
            feedback=eval_output.feedback,
            strengths=eval_output.strengths,
            weaknesses=eval_output.weaknesses,
            follow_up_recommended=eval_output.follow_up_recommended,
            follow_up_reason=eval_output.follow_up_reason,
            prompt_version=settings.prompt_version,
        )
        self._db.add(evaluation)
        await self._db.flush()

        state = await self._build_state(interview)

        if state.remaining_budget <= 0:
            return self._complete_interview(interview, eval_output)

        next_q = await self._decide_next_question(state, interview, question, eval_output)

        return AnswerResult(
            evaluation=eval_output,
            next_question=next_q,
            interview_complete=False,
        )

    async def _decide_next_question(
        self,
        state: InterviewState,
        interview: InterviewSession,
        current_question: InterviewQuestion,
        eval_output: EvaluationOutput,
    ) -> QuestionResult:
        skill_slug = current_question.skill.slug if current_question.skill else "general"
        should_follow_up = self._should_follow_up(state, eval_output, skill_slug)

        if should_follow_up:
            try:
                follow_up_output = await self._question_engine.generate_follow_up(
                    state=state,
                    original_question=current_question.question_text,
                    candidate_answer=state.last_question.answer_text if state.last_question else "",
                    overall_score=eval_output.overall_score,
                    follow_up_reason=eval_output.follow_up_reason or "Worth exploring further",
                )
                q = InterviewQuestion(
                    id=uuid.uuid4(),
                    session_id=interview.id,
                    skill_id=current_question.skill_id,
                    sequence_number=interview.questions_asked + 1,
                    question_text=follow_up_output.question_text,
                    difficulty=follow_up_output.difficulty,
                    question_type="follow_up",
                    parent_question_id=current_question.id,
                )
            except Exception:
                logger.warning("llm.follow_up_failed_falling_back_to_bank")
                should_follow_up = False

        if not should_follow_up:
            question_output = await self._adaptive_engine.pick_question(state)
            skill_id = self._find_skill_id(interview, question_output.skill_area)
            q = InterviewQuestion(
                id=uuid.uuid4(),
                session_id=interview.id,
                skill_id=skill_id,
                sequence_number=interview.questions_asked + 1,
                question_text=question_output.question_text,
                difficulty=question_output.difficulty,
                question_type="initial",
            )
            skill_slug = question_output.skill_area

        self._db.add(q)
        interview.questions_asked += 1
        await self._db.flush()

        return QuestionResult(
            question_id=q.id,
            sequence_number=q.sequence_number,
            question_text=q.question_text,
            difficulty=q.difficulty,
            skill_slug=skill_slug,
            question_type=q.question_type,
            parent_question_id=q.parent_question_id,
        )

    def _should_follow_up(
        self,
        state: InterviewState,
        eval_output: EvaluationOutput,
        skill_slug: str,
    ) -> bool:
        if state.remaining_budget <= 2:
            return False
        if state.follow_up_count_for_topic(skill_slug) >= settings.max_follow_ups_per_topic:
            return False
        if eval_output.follow_up_recommended:
            return True
        weight = state.skill_weights.get(skill_slug, 5)
        if eval_output.overall_score <= 4 and weight >= 7:
            return True
        if eval_output.overall_score >= 7 and eval_output.conceptual_depth < 7:
            return True
        return False

    def _complete_interview(
        self,
        interview: InterviewSession,
        eval_output: EvaluationOutput,
    ) -> AnswerResult:
        from datetime import datetime, timezone
        interview.status = "completed"
        interview.completed_at = datetime.now(timezone.utc)
        return AnswerResult(
            evaluation=eval_output,
            next_question=None,
            interview_complete=True,
            closing_message=(
                "Thank you for completing this interview! You've done well across several areas. "
                "I'll now generate your detailed performance report."
            ),
        )

    async def _build_state(self, interview: InterviewSession) -> InterviewState:
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        result = await self._db.execute(
            select(InterviewQuestion)
            .where(InterviewQuestion.session_id == interview.id)
            .options(
                selectinload(InterviewQuestion.skill),
                selectinload(InterviewQuestion.answer).selectinload(InterviewAnswer.evaluation),
            )
            .order_by(InterviewQuestion.sequence_number)
        )
        db_questions = list(result.scalars().unique().all())

        questions = []
        for q in db_questions:
            skill_slug = q.skill.slug if q.skill else "general"
            answer_text = q.answer.answer_text if q.answer else None
            overall_score = None
            if q.answer and q.answer.evaluation:
                overall_score = q.answer.evaluation.overall_score
            questions.append(QuestionRecord(
                question_id=q.id,
                question_text=q.question_text,
                skill_slug=skill_slug,
                difficulty=q.difficulty,
                question_type=q.question_type,
                answer_text=answer_text,
                overall_score=overall_score,
                follow_up_count=0,
            ))

        skill_weights = {}
        for rs in interview.role.role_skills:
            skill_weights[rs.skill.slug] = rs.weight

        focus_areas = interview.focus_areas if isinstance(interview.focus_areas, list) else []

        return InterviewState(
            session_id=interview.id,
            role_name=interview.role.name,
            role_id=interview.role_id,
            experience_level=interview.experience_level,
            difficulty=interview.difficulty,
            question_budget=interview.question_budget,
            questions_asked=interview.questions_asked,
            focus_areas=focus_areas,
            skill_weights=skill_weights,
            questions=questions,
        )

    async def _evaluate_answer(
        self,
        interview: InterviewSession,
        question: InterviewQuestion,
        answer_text: str,
    ) -> EvaluationOutput:
        seed_q = await self._find_seed_question(interview.role_id, question.question_text)

        if seed_q and seed_q.expected_concepts and seed_q.reference_answer:
            return evaluate_with_concepts(
                answer_text=answer_text,
                expected_concepts=seed_q.expected_concepts,
                reference_answer=seed_q.reference_answer,
                difficulty=question.difficulty,
            )

        try:
            return await self._evaluator.evaluate(
                role_name=interview.role.name,
                experience_level=interview.experience_level,
                question_text=question.question_text,
                answer_text=answer_text,
            )
        except Exception:
            logger.warning("llm.evaluation_failed_using_basic_scoring")
            return EvaluationOutput(
                technical_correctness=5.0,
                conceptual_depth=5.0,
                communication_clarity=5.0,
                relevance=5.0,
                problem_solving=5.0,
                completeness=5.0,
                overall_score=5.0,
                strengths=["Attempted to answer the question"],
                weaknesses=["Could not evaluate in detail"],
                feedback="Answer received. Detailed evaluation was not available.",
                follow_up_recommended=False,
                follow_up_reason=None,
            )

    async def _find_seed_question(self, role_id: uuid.UUID, question_text: str) -> SeedQuestion | None:
        result = await self._db.execute(
            select(SeedQuestion).where(
                SeedQuestion.role_id == role_id,
                SeedQuestion.question_text == question_text,
            ).limit(1)
        )
        return result.scalar_one_or_none()

    def _find_skill_id(self, interview: InterviewSession, skill_slug: str) -> uuid.UUID | None:
        for rs in interview.role.role_skills:
            if rs.skill.slug == skill_slug:
                return rs.skill_id
        return None
