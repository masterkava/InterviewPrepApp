"""Pydantic schemas for roles and skills."""

from uuid import UUID

from pydantic import BaseModel


class SkillResponse(BaseModel):
    id: UUID
    slug: str
    name: str
    category: str
    weight: int


class RoleResponse(BaseModel):
    id: UUID
    slug: str
    name: str
    description: str
    skills: list[SkillResponse]


class RolesListResponse(BaseModel):
    roles: list[RoleResponse]


class RoleSkillsResponse(BaseModel):
    role_id: UUID
    role_name: str
    skills: list[SkillResponse]
