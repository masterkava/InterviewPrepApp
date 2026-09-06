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
