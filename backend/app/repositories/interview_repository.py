"""Repository for interview session data access."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.interview import InterviewSession


class InterviewRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, interview: InterviewSession) -> InterviewSession:
        self._session.add(interview)
        await self._session.flush()
        return interview

    async def get_by_id(self, interview_id: UUID) -> InterviewSession | None:
        result = await self._session.execute(
            select(InterviewSession).where(InterviewSession.id == interview_id)
        )
        return result.scalars().one_or_none()

    async def list_by_user(self, user_id: UUID) -> list[InterviewSession]:
        result = await self._session.execute(
            select(InterviewSession)
            .where(InterviewSession.user_id == user_id)
            .order_by(InterviewSession.created_at.desc())
        )
        return list(result.scalars().all())
