"""Tests for role and skill endpoints."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.role import Role, RoleSkill, Skill


async def _seed_role(db: AsyncSession) -> tuple[Role, list[Skill]]:
    skill_python = Skill(id=uuid.uuid4(), slug="python", name="Python", category="language")
    skill_sql = Skill(id=uuid.uuid4(), slug="sql", name="SQL", category="language")
    db.add_all([skill_python, skill_sql])

    role = Role(
        id=uuid.uuid4(),
        slug="backend-developer",
        name="Backend Developer",
        description="Test role",
        is_active=True,
        display_order=1,
    )
    db.add(role)

    db.add_all([
        RoleSkill(id=uuid.uuid4(), role_id=role.id, skill_id=skill_python.id, weight=9),
        RoleSkill(id=uuid.uuid4(), role_id=role.id, skill_id=skill_sql.id, weight=7),
    ])
    await db.commit()
    return role, [skill_python, skill_sql]


async def test_list_roles_empty(client: AsyncClient):
    resp = await client.get("/api/v1/roles")
    assert resp.status_code == 200
    data = resp.json()
    assert data["roles"] == []


async def test_list_roles(client: AsyncClient, db_session: AsyncSession):
    role, skills = await _seed_role(db_session)
    resp = await client.get("/api/v1/roles")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["roles"]) == 1
    r = data["roles"][0]
    assert r["slug"] == "backend-developer"
    assert len(r["skills"]) == 2


async def test_get_role_skills(client: AsyncClient, db_session: AsyncSession):
    role, skills = await _seed_role(db_session)
    resp = await client.get(f"/api/v1/roles/{role.id}/skills")
    assert resp.status_code == 200
    data = resp.json()
    assert data["role_name"] == "Backend Developer"
    assert len(data["skills"]) == 2
    slugs = {s["slug"] for s in data["skills"]}
    assert "python" in slugs
    assert "sql" in slugs


async def test_get_role_skills_not_found(client: AsyncClient):
    fake_id = uuid.uuid4()
    resp = await client.get(f"/api/v1/roles/{fake_id}/skills")
    assert resp.status_code == 404
