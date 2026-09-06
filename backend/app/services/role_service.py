"""Service layer for role operations."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFoundError
from app.models.role import Role
from app.repositories.role_repository import RoleRepository
from app.schemas.role import RoleResponse, RoleSkillsResponse, RolesListResponse, SkillResponse


class RoleService:
    def __init__(self, session: AsyncSession) -> None:
        self._repo = RoleRepository(session)

    async def list_roles(self) -> RolesListResponse:
        roles = await self._repo.list_active()
        return RolesListResponse(
            roles=[self._to_role_response(r) for r in roles]
        )

    async def get_role_skills(self, role_id: UUID) -> RoleSkillsResponse:
        role = await self._repo.get_by_id(role_id)
        if role is None:
            raise NotFoundError("Role", str(role_id))
        return RoleSkillsResponse(
            role_id=role.id,
            role_name=role.name,
            skills=[
                SkillResponse(
                    id=rs.skill.id,
                    slug=rs.skill.slug,
                    name=rs.skill.name,
                    category=rs.skill.category,
                    weight=rs.weight,
                )
                for rs in role.role_skills
            ],
        )

    def _to_role_response(self, role: Role) -> RoleResponse:
        return RoleResponse(
            id=role.id,
            slug=role.slug,
            name=role.name,
            description=role.description,
            skills=[
                SkillResponse(
                    id=rs.skill.id,
                    slug=rs.skill.slug,
                    name=rs.skill.name,
                    category=rs.skill.category,
                    weight=rs.weight,
                )
                for rs in role.role_skills
            ],
        )
