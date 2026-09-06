"""User-related API endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.factory import get_llm_provider
from app.db.session import get_db
from app.schemas.report import InterviewHistoryItem, InterviewHistoryResponse
from app.services.interview_service import InterviewService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}/interviews", response_model=InterviewHistoryResponse)
async def get_user_interviews(
    user_id: UUID,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> InterviewHistoryResponse:
    service = InterviewService(db, llm_provider=get_llm_provider())
    interviews, total = await service.get_user_interviews(user_id, limit=limit, offset=offset)

    items = []
    for iv in interviews:
        items.append(InterviewHistoryItem(
            id=iv.id,
            role_name=iv.role.name,
            experience_level=iv.experience_level,
            status=iv.status,
            overall_score=None,
            questions_asked=iv.questions_asked,
            started_at=iv.started_at,
            completed_at=iv.completed_at,
        ))

    return InterviewHistoryResponse(
        interviews=items,
        total=total,
        limit=limit,
        offset=offset,
    )
