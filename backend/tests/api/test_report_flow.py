"""Integration tests for report generation and user interview history."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.role import Role, RoleSkill, Skill
from app.models.user import User


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
        description="Test role",
        is_active=True,
        display_order=1,
    )
    db.add(role)

    for skill, weight in zip(skills, [9, 8, 7]):
        rs = RoleSkill(id=uuid.uuid4(), role_id=role.id, skill_id=skill.id, weight=weight)
        db.add(rs)

    await db.commit()
    return role, {s.slug: s.id for s in skills}


async def _run_full_interview(client: AsyncClient, role_id: uuid.UUID, auth_headers: dict) -> str:
    """Run an interview to completion and return the interview id."""
    create_resp = await client.post(
        "/api/v1/interviews",
        json={
            "role_id": str(role_id),
            "experience_level": "junior",
            "difficulty": "adaptive",
            "duration_minutes": 15,
        },
        headers=auth_headers,
    )
    interview_id = create_resp.json()["id"]

    start_resp = await client.post(
        f"/api/v1/interviews/{interview_id}/start", headers=auth_headers
    )
    question_id = start_resp.json()["question"]["id"]

    for i in range(5):
        answer_resp = await client.post(
            f"/api/v1/interviews/{interview_id}/answer",
            json={
                "question_id": question_id,
                "answer_text": f"Answer to question {i + 1}",
                "response_time_seconds": 30,
            },
            headers=auth_headers,
        )
        data = answer_resp.json()
        if data["interview_complete"]:
            break
        question_id = data["next_question"]["id"]

    return interview_id


async def test_get_report_after_completion(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict
):
    """Report is generated on first GET and cached on subsequent GETs."""
    role, _ = await _seed_role_with_skills(db_session)
    interview_id = await _run_full_interview(client, role.id, auth_headers)

    resp1 = await client.get(
        f"/api/v1/interviews/{interview_id}/report", headers=auth_headers
    )
    assert resp1.status_code == 200
    report = resp1.json()

    assert report["session_id"] == interview_id
    assert 0 <= report["overall_score"] <= 100
    assert 0 <= report["technical_score"] <= 100
    assert 0 <= report["communication_score"] <= 100
    assert 0 <= report["problem_solving_score"] <= 100
    assert 0 <= report["confidence_score"] <= 100
    assert report["readiness_level"] in [
        "not_ready", "needs_work", "almost_ready", "ready", "strong",
    ]
    assert isinstance(report["summary"], str)
    assert len(report["strengths"]) > 0
    assert len(report["weaknesses"]) > 0
    assert len(report["recommendations"]) > 0
    assert len(report["questions"]) > 0
    assert "category_breakdown" in report

    for q in report["questions"]:
        assert "question_text" in q
        assert "answer_text" in q
        assert "evaluation" in q
        assert "overall_score" in q["evaluation"]
        assert "feedback" in q["evaluation"]

    resp2 = await client.get(
        f"/api/v1/interviews/{interview_id}/report", headers=auth_headers
    )
    assert resp2.status_code == 200
    assert resp2.json()["id"] == report["id"]


async def test_report_on_incomplete_interview(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict
):
    """Requesting a report before completion returns 409."""
    role, _ = await _seed_role_with_skills(db_session)

    create_resp = await client.post(
        "/api/v1/interviews",
        json={"role_id": str(role.id), "experience_level": "junior"},
        headers=auth_headers,
    )
    interview_id = create_resp.json()["id"]
    await client.post(
        f"/api/v1/interviews/{interview_id}/start", headers=auth_headers
    )

    resp = await client.get(
        f"/api/v1/interviews/{interview_id}/report", headers=auth_headers
    )
    assert resp.status_code == 409


async def test_report_on_early_complete(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict
):
    """Report works for an interview completed early after answering at least one question."""
    role, _ = await _seed_role_with_skills(db_session)

    create_resp = await client.post(
        "/api/v1/interviews",
        json={
            "role_id": str(role.id),
            "experience_level": "junior",
            "duration_minutes": 15,
        },
        headers=auth_headers,
    )
    interview_id = create_resp.json()["id"]

    start_resp = await client.post(
        f"/api/v1/interviews/{interview_id}/start", headers=auth_headers
    )
    question_id = start_resp.json()["question"]["id"]

    await client.post(
        f"/api/v1/interviews/{interview_id}/answer",
        json={
            "question_id": question_id,
            "answer_text": "My answer",
            "response_time_seconds": 20,
        },
        headers=auth_headers,
    )

    await client.post(
        f"/api/v1/interviews/{interview_id}/complete", headers=auth_headers
    )

    resp = await client.get(
        f"/api/v1/interviews/{interview_id}/report", headers=auth_headers
    )
    assert resp.status_code == 200
    report = resp.json()
    assert report["overall_score"] >= 0
    assert len(report["questions"]) >= 1


async def test_user_interview_history(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict
):
    """User history endpoint returns paginated interviews."""
    role, _ = await _seed_role_with_skills(db_session)

    await _run_full_interview(client, role.id, auth_headers)

    # Create a second interview (configured, not started)
    await client.post(
        "/api/v1/interviews",
        json={
            "role_id": str(role.id),
            "experience_level": "senior",
        },
        headers=auth_headers,
    )

    resp = await client.get("/api/v1/users/me/interviews", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["interviews"]) == 2
    assert data["limit"] == 20
    assert data["offset"] == 0

    statuses = [iv["status"] for iv in data["interviews"]]
    assert "configured" in statuses
    assert "completed" in statuses


async def test_user_interview_history_pagination(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict
):
    """Pagination parameters work correctly."""
    role, _ = await _seed_role_with_skills(db_session)
    await _run_full_interview(client, role.id, auth_headers)

    resp = await client.get(
        "/api/v1/users/me/interviews?limit=1&offset=0", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert len(data["interviews"]) == 1
    assert data["limit"] == 1

    resp2 = await client.get(
        "/api/v1/users/me/interviews?limit=1&offset=1", headers=auth_headers
    )
    assert resp2.status_code == 200
    assert len(resp2.json()["interviews"]) == 0


async def test_user_interview_history_no_auth(client: AsyncClient):
    """History without auth returns 422."""
    resp = await client.get("/api/v1/users/me/interviews")
    assert resp.status_code == 422
