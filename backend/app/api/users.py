"""User-related API endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.factory import get_llm_provider
from app.api.deps import CurrentUser
from app.db.session import get_db
from app.schemas.report import InterviewHistoryItem, InterviewHistoryResponse
from app.services.interview_service import InterviewService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me/interviews", response_model=InterviewHistoryResponse)
async def get_user_interviews(
    user: CurrentUser,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> InterviewHistoryResponse:
    service = InterviewService(db, llm_provider=get_llm_provider())
    rows, total = await service.get_user_interviews(user.id, limit=limit, offset=offset)

    items = []
    for iv, report_score in rows:
        items.append(InterviewHistoryItem(
            id=iv.id,
            role_name=iv.role.name,
            experience_level=iv.experience_level,
            status=iv.status,
            overall_score=report_score,
            questions_asked=iv.questions_asked,
            interview_mode=iv.interview_mode,
            started_at=iv.started_at,
            completed_at=iv.completed_at,
        ))

    return InterviewHistoryResponse(
        interviews=items,
        total=total,
        limit=limit,
        offset=offset,
    )
