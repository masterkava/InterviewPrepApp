"""Role and skill API endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.role import RolesListResponse, RoleSkillsResponse
from app.services.role_service import RoleService

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("", response_model=RolesListResponse)
async def list_roles(db: AsyncSession = Depends(get_db)) -> RolesListResponse:
    service = RoleService(db)
    return await service.list_roles()


@router.get("/{role_id}/skills", response_model=RoleSkillsResponse)
async def get_role_skills(
    role_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> RoleSkillsResponse:
    service = RoleService(db)
    return await service.get_role_skills(role_id)
