"""Tests for interview session endpoints."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.role import Role, RoleSkill, Skill
from app.models.user import User


async def _seed_role(db: AsyncSession) -> Role:
    skill = Skill(id=uuid.uuid4(), slug="python", name="Python", category="language")
    db.add(skill)
    role = Role(
        id=uuid.uuid4(),
        slug="backend-developer",
        name="Backend Developer",
        description="Test role",
        is_active=True,
        display_order=1,
    )
    db.add(role)
    db.add(RoleSkill(id=uuid.uuid4(), role_id=role.id, skill_id=skill.id, weight=9))
    await db.commit()
    return role


async def test_create_interview(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict
):
    role = await _seed_role(db_session)
    resp = await client.post(
        "/api/v1/interviews",
        json={
            "role_id": str(role.id),
            "experience_level": "junior",
            "difficulty": "adaptive",
            "duration_minutes": 30,
            "focus_areas": ["python"],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "configured"
    assert data["role"]["name"] == "Backend Developer"
    assert data["experience_level"] == "junior"
    assert data["question_budget"] == 10
    assert data["user_id"] is not None


async def test_create_interview_with_user_id(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict, test_user: User
):
    role = await _seed_role(db_session)
    resp = await client.post(
        "/api/v1/interviews",
        json={
            "role_id": str(role.id),
            "experience_level": "fresher",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["user_id"] == str(test_user.id)


async def test_create_interview_invalid_role(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/v1/interviews",
        json={
            "role_id": str(uuid.uuid4()),
            "experience_level": "junior",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_create_interview_invalid_experience(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict
):
    role = await _seed_role(db_session)
    resp = await client.post(
        "/api/v1/interviews",
        json={
            "role_id": str(role.id),
            "experience_level": "expert",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_create_interview_no_auth(client: AsyncClient, db_session: AsyncSession):
    role = await _seed_role(db_session)
    resp = await client.post(
        "/api/v1/interviews",
        json={
            "role_id": str(role.id),
            "experience_level": "junior",
        },
    )
    assert resp.status_code == 422
