"""Repository for role and skill data access."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.role import Role, RoleSkill, Skill


class RoleRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_active(self) -> list[Role]:
        stmt = (
            select(Role)
            .where(Role.is_active.is_(True))
            .options(selectinload(Role.role_skills).selectinload(RoleSkill.skill))
            .order_by(Role.display_order)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().unique().all())

    async def get_by_id(self, role_id: UUID) -> Role | None:
        stmt = (
            select(Role)
            .where(Role.id == role_id)
            .options(selectinload(Role.role_skills).selectinload(RoleSkill.skill))
        )
        result = await self._session.execute(stmt)
        return result.scalars().unique().one_or_none()
