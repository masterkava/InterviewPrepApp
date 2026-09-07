"""Seed data for roles, skills, role-skill mappings, and question bank."""

import asyncio
import json
import uuid
from pathlib import Path

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory
from app.models.role import Role, RoleSkill, SeedQuestion, Skill

logger = structlog.get_logger()

SKILLS: list[dict[str, str]] = [
    {"slug": "python", "name": "Python", "category": "language"},
    {"slug": "machine-learning", "name": "Machine Learning", "category": "concept"},
    {"slug": "deep-learning", "name": "Deep Learning", "category": "concept"},
    {"slug": "mlops", "name": "MLOps", "category": "concept"},
    {"slug": "statistics", "name": "Statistics", "category": "concept"},
    {"slug": "data-structures", "name": "Data Structures", "category": "concept"},
    {"slug": "sql", "name": "SQL", "category": "language"},
    {"slug": "data-analysis", "name": "Data Analysis", "category": "concept"},
    {"slug": "feature-engineering", "name": "Feature Engineering", "category": "concept"},
    {"slug": "oop", "name": "Object-Oriented Programming", "category": "concept"},
    {"slug": "web-frameworks", "name": "Web Frameworks", "category": "framework"},
    {"slug": "databases", "name": "Databases", "category": "concept"},
    {"slug": "testing", "name": "Testing", "category": "concept"},
]

ROLES: list[dict] = [
    {
        "slug": "ai-ml-engineer",
        "name": "AI/ML Engineer",
        "description": (
            "Technical interview for AI/ML engineer roles. "
            "Covers Python, Machine Learning, Deep Learning, MLOps, "
            "Statistics, and Data Structures."
        ),
        "display_order": 1,
        "skills": [
            ("python", 9),
            ("machine-learning", 9),
            ("deep-learning", 8),
            ("mlops", 7),
            ("statistics", 8),
            ("data-structures", 6),
        ],
    },
    {
        "slug": "data-scientist",
        "name": "Data Scientist",
        "description": (
            "Technical interview for data scientist roles. "
            "Covers Python, Statistics, Machine Learning, SQL, "
            "Data Analysis, and Feature Engineering."
        ),
        "display_order": 2,
        "skills": [
            ("python", 8),
            ("statistics", 9),
            ("machine-learning", 9),
            ("sql", 8),
            ("data-analysis", 7),
            ("feature-engineering", 7),
        ],
    },
    {
        "slug": "python-developer",
        "name": "Python Developer",
        "description": (
            "Technical interview for Python developer roles. "
            "Covers Python Core, Data Structures, OOP, "
            "Web Frameworks, Databases, and Testing."
        ),
        "display_order": 3,
        "skills": [
            ("python", 9),
            ("data-structures", 8),
            ("oop", 8),
            ("web-frameworks", 7),
            ("databases", 7),
            ("testing", 7),
        ],
    },
]

TOPIC_TO_SLUG = {
    "Python": "python",
    "Python Core": "python",
    "Machine Learning": "machine-learning",
    "Deep Learning": "deep-learning",
    "MLOps": "mlops",
    "Statistics": "statistics",
    "Data Structures": "data-structures",
    "SQL": "sql",
    "Data Analysis": "data-analysis",
    "Feature Engineering": "feature-engineering",
    "OOP": "oop",
    "Web Frameworks": "web-frameworks",
    "Databases": "databases",
    "Testing": "testing",
}

ROLE_NAME_TO_SLUG = {
    "AI/ML Engineer": "ai-ml-engineer",
    "Data Scientist": "data-scientist",
    "Python Developer": "python-developer",
}


async def seed_data(session: AsyncSession) -> None:
    existing = await session.execute(select(Role).limit(1))
    if existing.scalar_one_or_none() is not None:
        logger.info("seed.skipped", reason="Data already exists")
        return

    skill_map: dict[str, uuid.UUID] = {}
    for skill_data in SKILLS:
        skill = Skill(
            id=uuid.uuid4(),
            slug=skill_data["slug"],
            name=skill_data["name"],
            category=skill_data["category"],
        )
        session.add(skill)
        skill_map[skill_data["slug"]] = skill.id

    role_map: dict[str, uuid.UUID] = {}
    for role_data in ROLES:
        role_id = uuid.uuid4()
        role = Role(
            id=role_id,
            slug=role_data["slug"],
            name=role_data["name"],
            description=role_data["description"],
            display_order=role_data["display_order"],
            is_active=True,
        )
        session.add(role)
        role_map[role_data["slug"]] = role_id

        for skill_slug, weight in role_data["skills"]:
            role_skill = RoleSkill(
                id=uuid.uuid4(),
                role_id=role_id,
                skill_id=skill_map[skill_slug],
                weight=weight,
            )
            session.add(role_skill)

    await session.flush()

    question_count = await _seed_questions(session, role_map, skill_map)

    await session.commit()
    logger.info(
        "seed.completed",
        roles=len(ROLES),
        skills=len(SKILLS),
        questions=question_count,
    )


async def _seed_questions(
    session: AsyncSession,
    role_map: dict[str, uuid.UUID],
    skill_map: dict[str, uuid.UUID],
) -> int:
    bank_path = Path(__file__).parent / "question_bank.json"
    if not bank_path.exists():
        logger.warning("seed.question_bank_not_found", path=str(bank_path))
        return 0

    with open(bank_path, encoding="utf-8") as f:
        bank = json.load(f)

    count = 0
    for role_data in bank["roles"]:
        role_slug = ROLE_NAME_TO_SLUG.get(role_data["role_name"])
        if not role_slug or role_slug not in role_map:
            logger.warning("seed.unknown_role", role_name=role_data["role_name"])
            continue

        role_id = role_map[role_slug]

        for topic in role_data["topics"]:
            skill_slug = TOPIC_TO_SLUG.get(topic["topic_name"])
            if not skill_slug or skill_slug not in skill_map:
                logger.warning("seed.unknown_topic", topic=topic["topic_name"])
                continue

            skill_id = skill_map[skill_slug]

            for q in topic["questions"]:
                seed_q = SeedQuestion(
                    id=uuid.uuid4(),
                    role_id=role_id,
                    skill_id=skill_id,
                    question_text=q["question_text"],
                    difficulty=q["difficulty"],
                    expected_concepts=q.get("expected_concepts"),
                    reference_answer=q.get("reference_answer"),
                    time_limit_seconds=q.get("time_limit_seconds", 90),
                    question_type="standard",
                    is_active=True,
                )
                session.add(seed_q)
                count += 1

    return count


async def run_seed() -> None:
    async with async_session_factory() as session:
        await seed_data(session)


if __name__ == "__main__":
    asyncio.run(run_seed())
