"""Service layer for interview session operations."""

import uuid as uuid_mod
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.provider import LLMProvider
from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.interview.engine import InterviewEngine
from app.interview.report_generator import ReportGenerator
from app.models.interview import InterviewQuestion, InterviewReport, InterviewSession
from app.repositories.interview_repository import InterviewRepository
from app.repositories.role_repository import RoleRepository
from app.repositories.user_repository import UserRepository
from app.schemas.interview import (
    AnswerRequest,
    AnswerResponse,
    EvaluationResponse,
    InterviewCompleteResponse,
    InterviewCreateRequest,
    InterviewCreateResponse,
    InterviewRoleInfo,
    InterviewStartResponse,
    ProgressResponse,
    QuestionResponse,
)


class InterviewService:
    def __init__(self, session: AsyncSession, llm_provider: LLMProvider | None = None) -> None:
        self._db = session
        self._interview_repo = InterviewRepository(session)
        self._role_repo = RoleRepository(session)
        self._user_repo = UserRepository(session)
        self._llm_provider = llm_provider

    async def create_interview(self, req: InterviewCreateRequest) -> InterviewCreateResponse:
        role = await self._role_repo.get_by_id(req.role_id)
        if role is None:
            raise NotFoundError("Role", str(req.role_id))
        if not role.is_active:
            raise ValidationError(f"Role '{role.name}' is not currently available")

        if req.user_id:
            user = await self._user_repo.get_by_id(req.user_id)
            if user is None:
                user = await self._user_repo.create(req.user_id)
        else:
            user = await self._user_repo.create()

        question_budget = self._compute_question_budget(req.duration_minutes)

        interview = InterviewSession(
            id=uuid_mod.uuid4(),
            user_id=user.id,
            role_id=role.id,
            experience_level=req.experience_level,
            difficulty=req.difficulty,
            duration_minutes=req.duration_minutes,
            status="configured",
            focus_areas=req.focus_areas,
            question_budget=question_budget,
            questions_asked=0,
            interview_mode=req.interview_mode,
        )
        await self._interview_repo.create(interview)
        await self._db.commit()

        return InterviewCreateResponse(
            id=interview.id,
            user_id=user.id,
            role=InterviewRoleInfo(id=role.id, name=role.name),
            experience_level=interview.experience_level,
            difficulty=interview.difficulty,
            duration_minutes=interview.duration_minutes,
            question_budget=question_budget,
            focus_areas=interview.focus_areas,
            status=interview.status,
            created_at=interview.created_at,
        )

    async def start_interview(self, interview_id: UUID) -> InterviewStartResponse:
        interview = await self._get_interview(interview_id)
        if interview.status != "configured":
            raise ConflictError(f"Interview is already {interview.status}")

        engine = self._get_engine()
        intro_message, question = await engine.start_interview(interview)
        await self._db.commit()

        state = await engine._build_state(interview)
        return InterviewStartResponse(
            session_id=interview.id,
            status=interview.status,
            interviewer_message=intro_message,
            question=QuestionResponse(
                id=question.question_id,
                sequence_number=question.sequence_number,
                question_text=question.question_text,
                difficulty=question.difficulty,
                skill=question.skill_slug,
                question_type=question.question_type,
            ),
            progress=ProgressResponse(
                current=interview.questions_asked,
                total=interview.question_budget,
                skills_covered=state.skills_covered,
                skills_remaining=state.skills_remaining,
            ),
        )

    async def submit_answer(self, interview_id: UUID, req: AnswerRequest) -> AnswerResponse:
        interview = await self._get_interview(interview_id)
        if interview.status != "in_progress":
            raise ConflictError(f"Interview is not in progress (status: {interview.status})")

        question = await self._get_question(req.question_id, interview.id)
        if question.answer is not None:
            raise ConflictError("Answer already submitted for this question")

        engine = self._get_engine()
        result = await engine.process_answer(
            interview=interview,
            question=question,
            answer_text=req.answer_text,
            response_time_seconds=req.response_time_seconds,
            audio_url=req.audio_url,
        )
        await self._db.commit()

        state = await engine._build_state(interview)

        next_q = None
        if result.next_question:
            next_q = QuestionResponse(
                id=result.next_question.question_id,
                sequence_number=result.next_question.sequence_number,
                question_text=result.next_question.question_text,
                difficulty=result.next_question.difficulty,
                skill=result.next_question.skill_slug,
                question_type=result.next_question.question_type,
                parent_question_id=result.next_question.parent_question_id,
            )

        return AnswerResponse(
            evaluation=EvaluationResponse(
                question_id=req.question_id,
                overall_score=result.evaluation.overall_score,
                technical_correctness=result.evaluation.technical_correctness,
                conceptual_depth=result.evaluation.conceptual_depth,
                communication_clarity=result.evaluation.communication_clarity,
                relevance=result.evaluation.relevance,
                problem_solving=result.evaluation.problem_solving,
                completeness=result.evaluation.completeness,
                feedback=result.evaluation.feedback,
                strengths=result.evaluation.strengths,
                weaknesses=result.evaluation.weaknesses,
            ),
            next_question=next_q,
            progress=ProgressResponse(
                current=interview.questions_asked,
                total=interview.question_budget,
                skills_covered=state.skills_covered,
                skills_remaining=state.skills_remaining,
            ),
            interview_complete=result.interview_complete,
            closing_message=result.closing_message,
        )

    async def complete_interview(self, interview_id: UUID) -> InterviewCompleteResponse:
        interview = await self._get_interview(interview_id)
        if interview.status not in ("in_progress", "configured"):
            raise ConflictError(f"Interview cannot be completed (status: {interview.status})")
        interview.status = "completed"
        interview.completed_at = datetime.now(timezone.utc)
        await self._db.commit()
        return InterviewCompleteResponse(
            session_id=interview.id,
            status="completed",
            questions_asked=interview.questions_asked,
            question_budget=interview.question_budget,
            message="Interview ended early. Your report will be generated based on the questions answered.",
        )

    async def get_report(self, interview_id: UUID) -> InterviewReport:
        interview = await self._get_interview(interview_id)
        if interview.status != "completed":
            raise ConflictError("Interview has not been completed yet")

        result = await self._db.execute(
            select(InterviewReport).where(InterviewReport.session_id == interview_id)
        )
        existing = result.scalars().one_or_none()
        if existing:
            return existing

        if self._llm_provider is None:
            raise ValidationError("LLM provider not configured")
        generator = ReportGenerator(self._llm_provider, self._db)
        report = await generator.generate_report(interview)
        await self._db.commit()
        return report

    async def get_user_interviews(
        self, user_id: UUID, limit: int = 20, offset: int = 0,
    ) -> tuple[list[InterviewSession], int]:
        from sqlalchemy import func
        count_result = await self._db.execute(
            select(func.count()).select_from(InterviewSession).where(InterviewSession.user_id == user_id)
        )
        total = count_result.scalar() or 0

        result = await self._db.execute(
            select(InterviewSession)
            .where(InterviewSession.user_id == user_id)
            .options(selectinload(InterviewSession.role))
            .order_by(InterviewSession.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        interviews = list(result.scalars().all())
        return interviews, total

    async def _get_interview(self, interview_id: UUID) -> InterviewSession:
        interview = await self._interview_repo.get_by_id(interview_id)
        if interview is None:
            raise NotFoundError("Interview", str(interview_id))
        return interview

    async def _get_question(self, question_id: UUID, session_id: UUID) -> InterviewQuestion:
        result = await self._db.execute(
            select(InterviewQuestion)
            .where(InterviewQuestion.id == question_id, InterviewQuestion.session_id == session_id)
            .options(selectinload(InterviewQuestion.answer))
        )
        question = result.scalars().one_or_none()
        if question is None:
            raise NotFoundError("Question", str(question_id))
        return question

    def _get_engine(self) -> InterviewEngine:
        if self._llm_provider is None:
            raise ValidationError("LLM provider not configured")
        return InterviewEngine(self._llm_provider, self._db)

    def _compute_question_budget(self, duration_minutes: int) -> int:
        return max(5, duration_minutes // 3)
