"""Seed data for roles, skills, role-skill mappings, and question bank.

Reads questions from question_banks/*.json (the single source of truth).
"""

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

BANKS_DIR = Path(__file__).parent / "question_banks"

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
    # New skills for backend domains
    {"slug": "api-design", "name": "API Design", "category": "concept"},
    {"slug": "system-design", "name": "System Design", "category": "concept"},
    {"slug": "security", "name": "Security", "category": "concept"},
    {"slug": "caching", "name": "Caching", "category": "concept"},
    {"slug": "distributed-systems", "name": "Distributed Systems", "category": "concept"},
    {"slug": "messaging", "name": "Messaging & Async", "category": "concept"},
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
            "Web Frameworks, Databases, API Design, System Design, "
            "and Security."
        ),
        "display_order": 3,
        "skills": [
            ("python", 9),
            ("data-structures", 7),
            ("oop", 7),
            ("web-frameworks", 6),
            ("databases", 8),
            ("api-design", 7),
            ("system-design", 6),
            ("security", 6),
            ("caching", 5),
            ("distributed-systems", 5),
            ("messaging", 5),
            ("testing", 6),
        ],
    },
]


# --- Question bank file → role and topic/domain → skill mappings ---

PYTHON_TOPIC_TO_SKILL: dict[str, str] = {
    "Python Fundamentals": "python",
    "Functions & Modules": "python",
    "Collections & Iteration": "python",
    "Object-Oriented Python": "oop",
    "Exceptions, Concurrency & Advanced Python": "python",
    "Advanced Python": "python",
}

AI_ML_TOPIC_TO_SKILL: dict[str, str] = {
    "AI Fundamentals": "machine-learning",
    "Machine Learning Fundamentals": "machine-learning",
    "Statistics & Probability": "statistics",
    "Supervised Learning": "machine-learning",
    "Unsupervised & Representation Learning": "machine-learning",
    "Feature Engineering & Data Preparation": "feature-engineering",
    "Model Evaluation & Experimentation": "data-analysis",
    "Deep Learning": "deep-learning",
    "Computer Vision": "deep-learning",
    "NLP & Transformers": "deep-learning",
    "Generative AI & LLMs": "deep-learning",
    "MLOps & Model Serving": "mlops",
    "AI System Design & Production Scenarios": "mlops",
}

BACKEND_DOMAIN_TO_SKILL: dict[str, str] = {
    "backend_fundamentals": "web-frameworks",
    "http_api": "api-design",
    "databases_sql": "databases",
    "authentication_security": "security",
    "caching": "caching",
    "messaging_async": "messaging",
    "distributed_systems": "distributed-systems",
    "microservices": "system-design",
    "performance_observability": "system-design",
    "system_design_production": "system-design",
}

# Which files seed which roles
FILE_TO_ROLES: dict[str, list[str]] = {
    "python.json": ["ai-ml-engineer", "data-scientist", "python-developer"],
    "ai_ml.json": ["ai-ml-engineer", "data-scientist"],
    "backend.json": ["python-developer"],
}

DIFFICULTY_NORMALIZE: dict[str, str] = {
    "easy": "easy",
    "medium": "medium",
    "hard": "hard",
    "expert": "hard",
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
    count = 0

    for filename, role_slugs in FILE_TO_ROLES.items():
        bank_path = BANKS_DIR / filename
        if not bank_path.exists():
            logger.warning("seed.bank_not_found", path=str(bank_path))
            continue

        with open(bank_path, encoding="utf-8") as f:
            bank = json.load(f)

        questions = bank["question_bank"]["questions"]
        cfg = BANK_CONFIG[filename]
        topic_map = cfg["topic_map"]
        topic_field = cfg["topic_field"]

        for q in questions:
            topic_key = q.get(topic_field, "")
            skill_slug = topic_map.get(topic_key)
            if not skill_slug or skill_slug not in skill_map:
                skill_slug = cfg["fallback_skill"]

            difficulty = DIFFICULTY_NORMALIZE.get(q["difficulty"].lower(), "medium")
            concepts = q.get("key_concepts", [])
            answer = q.get("answer", "")

            for role_slug in role_slugs:
                if role_slug not in role_map:
                    continue
                # Check the role actually has this skill
                role_id = role_map[role_slug]
                skill_id = skill_map.get(skill_slug)
                if skill_id is None:
                    continue

                seed_q = SeedQuestion(
                    id=uuid.uuid4(),
                    role_id=role_id,
                    skill_id=skill_id,
                    question_text=q["question"],
                    difficulty=difficulty,
                    expected_concepts=concepts if concepts else None,
                    reference_answer=answer if answer else None,
                    time_limit_seconds=90,
                    question_type="standard",
                    is_active=True,
                )
                session.add(seed_q)
                count += 1

        logger.info("seed.bank_loaded", file=filename, questions=len(questions), roles=role_slugs)

    return count


BANK_CONFIG: dict[str, dict] = {
    "python.json": {
        "topic_field": "topic",
        "topic_map": PYTHON_TOPIC_TO_SKILL,
        "fallback_skill": "python",
    },
    "ai_ml.json": {
        "topic_field": "topic",
        "topic_map": AI_ML_TOPIC_TO_SKILL,
        "fallback_skill": "machine-learning",
    },
    "backend.json": {
        "topic_field": "domain",
        "topic_map": BACKEND_DOMAIN_TO_SKILL,
        "fallback_skill": "web-frameworks",
    },
}


async def run_seed() -> None:
    async with async_session_factory() as session:
        await seed_data(session)


if __name__ == "__main__":
    asyncio.run(run_seed())
