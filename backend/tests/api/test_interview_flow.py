"""Integration test: full interview flow with mock LLM provider."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.role import Role, RoleSkill, Skill


async def _seed_role_with_skills(db: AsyncSession) -> tuple[Role, dict[str, uuid.UUID]]:
    skills = [
        Skill(id=uuid.uuid4(), slug="python", name="Python", category="language"),
        Skill(id=uuid.uuid4(), slug="rest-apis", name="REST APIs", category="concept"),
        Skill(id=uuid.uuid4(), slug="databases", name="Databases", category="concept"),
    ]
    db.add_all(skills)

    role = Role(
        id=uuid.uuid4(),
        slug="backend-developer",
        name="Backend Developer",
        description="Test role for integration test",
        is_active=True,
        display_order=1,
    )
    db.add(role)

    skill_map = {}
    for skill, weight in zip(skills, [9, 8, 7]):
        rs = RoleSkill(id=uuid.uuid4(), role_id=role.id, skill_id=skill.id, weight=weight)
        db.add(rs)
        skill_map[skill.slug] = skill.id

    await db.commit()
    return role, skill_map


async def test_full_interview_flow(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict
):
    """Test the complete interview lifecycle: create -> start -> answer x N -> complete."""
    role, skill_map = await _seed_role_with_skills(db_session)

    create_resp = await client.post(
        "/api/v1/interviews",
        json={
            "role_id": str(role.id),
            "experience_level": "junior",
            "difficulty": "adaptive",
            "duration_minutes": 15,
            "focus_areas": ["python", "rest-apis"],
        },
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    interview_id = create_resp.json()["id"]
    assert create_resp.json()["status"] == "configured"
    assert create_resp.json()["question_budget"] == 5

    start_resp = await client.post(
        f"/api/v1/interviews/{interview_id}/start", headers=auth_headers
    )
    assert start_resp.status_code == 200
    start_data = start_resp.json()
    assert start_data["status"] == "in_progress"
    assert "interviewer_message" in start_data
    assert start_data["question"]["sequence_number"] == 1
    assert start_data["progress"]["current"] == 1
    assert start_data["progress"]["total"] == 5

    question_id = start_data["question"]["id"]

    for i in range(5):
        answer_resp = await client.post(
            f"/api/v1/interviews/{interview_id}/answer",
            json={
                "question_id": question_id,
                "answer_text": f"This is my answer to question {i + 1}. I think the key concepts are...",
                "response_time_seconds": 45,
            },
            headers=auth_headers,
        )
        assert answer_resp.status_code == 200
        answer_data = answer_resp.json()

        assert "evaluation" in answer_data
        assert answer_data["evaluation"]["overall_score"] >= 0
        assert answer_data["evaluation"]["feedback"]
        assert len(answer_data["evaluation"]["strengths"]) > 0

        if answer_data["interview_complete"]:
            assert answer_data["next_question"] is None
            assert answer_data["closing_message"] is not None
            break

        assert answer_data["next_question"] is not None
        question_id = answer_data["next_question"]["id"]


async def test_start_already_started(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict
):
    """Starting an already-started interview returns 409."""
    role, _ = await _seed_role_with_skills(db_session)

    create_resp = await client.post(
        "/api/v1/interviews",
        json={"role_id": str(role.id), "experience_level": "junior"},
        headers=auth_headers,
    )
    interview_id = create_resp.json()["id"]

    await client.post(f"/api/v1/interviews/{interview_id}/start", headers=auth_headers)
    resp = await client.post(
        f"/api/v1/interviews/{interview_id}/start", headers=auth_headers
    )
    assert resp.status_code == 409


async def test_complete_early(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict
):
    """Force-completing an interview works."""
    role, _ = await _seed_role_with_skills(db_session)

    create_resp = await client.post(
        "/api/v1/interviews",
        json={"role_id": str(role.id), "experience_level": "junior"},
        headers=auth_headers,
    )
    interview_id = create_resp.json()["id"]

    await client.post(f"/api/v1/interviews/{interview_id}/start", headers=auth_headers)
    resp = await client.post(
        f"/api/v1/interviews/{interview_id}/complete", headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"


async def test_answer_wrong_question(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict
):
    """Submitting an answer with a non-existent question ID returns 404."""
    role, _ = await _seed_role_with_skills(db_session)

    create_resp = await client.post(
        "/api/v1/interviews",
        json={"role_id": str(role.id), "experience_level": "junior"},
        headers=auth_headers,
    )
    interview_id = create_resp.json()["id"]
    await client.post(f"/api/v1/interviews/{interview_id}/start", headers=auth_headers)

    resp = await client.post(
        f"/api/v1/interviews/{interview_id}/answer",
        json={
            "question_id": str(uuid.uuid4()),
            "answer_text": "Some answer",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_answer_on_configured_interview(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict
):
    """Submitting an answer before starting returns 409."""
    role, _ = await _seed_role_with_skills(db_session)

    create_resp = await client.post(
        "/api/v1/interviews",
        json={"role_id": str(role.id), "experience_level": "junior"},
        headers=auth_headers,
    )
    interview_id = create_resp.json()["id"]

    resp = await client.post(
        f"/api/v1/interviews/{interview_id}/answer",
        json={
            "question_id": str(uuid.uuid4()),
            "answer_text": "Some answer",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 409
