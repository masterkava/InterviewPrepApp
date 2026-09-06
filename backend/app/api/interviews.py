"""Interview session API endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.factory import get_llm_provider
from app.db.session import get_db
from app.schemas.interview import (
    AnswerRequest,
    AnswerResponse,
    InterviewCompleteResponse,
    InterviewCreateRequest,
    InterviewCreateResponse,
    InterviewStartResponse,
)
from app.schemas.report import (
    InterviewHistoryItem,
    InterviewHistoryResponse,
    QuestionEvaluation,
    ReportQuestion,
    ReportResponse,
)
from app.services.interview_service import InterviewService

router = APIRouter(prefix="/interviews", tags=["interviews"])


def _service(db: AsyncSession) -> InterviewService:
    return InterviewService(db, llm_provider=get_llm_provider())


@router.post("", response_model=InterviewCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_interview(
    req: InterviewCreateRequest,
    db: AsyncSession = Depends(get_db),
) -> InterviewCreateResponse:
    service = InterviewService(db)
    return await service.create_interview(req)


@router.post("/{interview_id}/start", response_model=InterviewStartResponse)
async def start_interview(
    interview_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> InterviewStartResponse:
    return await _service(db).start_interview(interview_id)


@router.post("/{interview_id}/answer", response_model=AnswerResponse)
async def submit_answer(
    interview_id: UUID,
    req: AnswerRequest,
    db: AsyncSession = Depends(get_db),
) -> AnswerResponse:
    return await _service(db).submit_answer(interview_id, req)


@router.post("/{interview_id}/complete", response_model=InterviewCompleteResponse)
async def complete_interview(
    interview_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> InterviewCompleteResponse:
    return await _service(db).complete_interview(interview_id)


@router.get("/{interview_id}/report", response_model=ReportResponse)
async def get_report(
    interview_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> ReportResponse:
    report = await _service(db).get_report(interview_id)
    questions = []
    if isinstance(report.questions_data, list):
        for q in report.questions_data:
            questions.append(ReportQuestion(
                sequence_number=q["sequence_number"],
                question_text=q["question_text"],
                answer_text=q["answer_text"],
                evaluation=QuestionEvaluation(**q["evaluation"]),
            ))
    return ReportResponse(
        id=report.id,
        session_id=report.session_id,
        overall_score=report.overall_score,
        technical_score=report.technical_score,
        communication_score=report.communication_score,
        problem_solving_score=report.problem_solving_score,
        confidence_score=report.confidence_score,
        readiness_level=report.readiness_level,
        summary=report.summary,
        strengths=report.strengths or [],
        weaknesses=report.weaknesses or [],
        recommendations=report.recommendations or [],
        recommended_topics=report.recommended_topics or [],
        category_breakdown=report.category_breakdown or {},
        questions=questions,
        created_at=report.created_at,
    )
