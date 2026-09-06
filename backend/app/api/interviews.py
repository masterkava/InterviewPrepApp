"""Interview session API endpoints."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.interview import InterviewCreateRequest, InterviewCreateResponse
from app.services.interview_service import InterviewService

router = APIRouter(prefix="/interviews", tags=["interviews"])


@router.post("", response_model=InterviewCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_interview(
    req: InterviewCreateRequest,
    db: AsyncSession = Depends(get_db),
) -> InterviewCreateResponse:
    service = InterviewService(db)
    return await service.create_interview(req)
