"""Repository for user data access."""

import uuid as uuid_mod
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, user_id: UUID) -> User | None:
        result = await self._session.execute(select(User).where(User.id == user_id))
        return result.scalars().one_or_none()

    async def create(self, user_id: UUID | None = None) -> User:
        user = User(id=user_id or uuid_mod.uuid4())
        self._session.add(user)
        await self._session.flush()
        return user
