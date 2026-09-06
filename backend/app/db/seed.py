"""Seed data for roles, skills, and role-skill mappings."""

import asyncio
import uuid

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory
from app.models.role import Role, RoleSkill, Skill

logger = structlog.get_logger()

SKILLS: list[dict[str, str]] = [
    # Languages
    {"slug": "python", "name": "Python", "category": "language"},
    {"slug": "javascript", "name": "JavaScript", "category": "language"},
    {"slug": "typescript", "name": "TypeScript", "category": "language"},
    {"slug": "sql", "name": "SQL", "category": "language"},
    # Frameworks & Libraries
    {"slug": "react", "name": "React", "category": "framework"},
    {"slug": "fastapi", "name": "FastAPI / Flask / Django", "category": "framework"},
    {"slug": "nodejs", "name": "Node.js / Express", "category": "framework"},
    # Concepts
    {"slug": "rest-apis", "name": "REST APIs", "category": "concept"},
    {"slug": "databases", "name": "Databases & Data Modeling", "category": "concept"},
    {"slug": "system-design", "name": "System Design Basics", "category": "concept"},
    {"slug": "authentication", "name": "Authentication & Authorization", "category": "concept"},
    {"slug": "caching", "name": "Caching Strategies", "category": "concept"},
    {"slug": "testing", "name": "Testing & Debugging", "category": "concept"},
    {"slug": "http", "name": "HTTP & Networking", "category": "concept"},
    {"slug": "backend-architecture", "name": "Backend Architecture", "category": "concept"},
    {"slug": "frontend-architecture", "name": "Frontend Architecture", "category": "concept"},
    {"slug": "deployment", "name": "Deployment Basics", "category": "concept"},
    # AI/ML
    {"slug": "ml-fundamentals", "name": "Machine Learning Fundamentals", "category": "concept"},
    {"slug": "statistics", "name": "Statistics & Probability", "category": "concept"},
    {"slug": "deep-learning", "name": "Deep Learning", "category": "concept"},
    {"slug": "nlp", "name": "Natural Language Processing", "category": "concept"},
    {"slug": "llm-fundamentals", "name": "LLM Fundamentals", "category": "concept"},
    {"slug": "rag", "name": "RAG & Embeddings", "category": "concept"},
    {"slug": "vector-databases", "name": "Vector Databases", "category": "concept"},
    {"slug": "ai-system-design", "name": "AI System Design", "category": "concept"},
]

ROLES: list[dict] = [
    {
        "slug": "backend-developer",
        "name": "Backend Developer",
        "description": (
            "Technical interview for backend/software developer roles. "
            "Covers Python, APIs, databases, SQL, HTTP, system design basics, "
            "backend architecture, caching, authentication, testing, and debugging."
        ),
        "display_order": 1,
        "skills": [
            ("python", 9),
            ("rest-apis", 9),
            ("databases", 9),
            ("sql", 8),
            ("http", 7),
            ("system-design", 7),
            ("backend-architecture", 7),
            ("caching", 6),
            ("authentication", 6),
            ("testing", 6),
        ],
    },
    {
        "slug": "ai-ml-developer",
        "name": "AI / ML Developer",
        "description": (
            "Technical interview for AI/ML engineer roles. "
            "Covers Python, ML fundamentals, statistics, deep learning, NLP, "
            "LLM fundamentals, RAG, embeddings, vector databases, and AI system design."
        ),
        "display_order": 2,
        "skills": [
            ("python", 9),
            ("ml-fundamentals", 9),
            ("statistics", 8),
            ("deep-learning", 8),
            ("nlp", 7),
            ("llm-fundamentals", 8),
            ("rag", 7),
            ("vector-databases", 6),
            ("ai-system-design", 7),
            ("databases", 5),
        ],
    },
    {
        "slug": "full-stack-developer",
        "name": "Full Stack Developer",
        "description": (
            "Technical interview for full stack developer roles. "
            "Covers JavaScript/TypeScript, React, APIs, backend development, "
            "databases, authentication, frontend architecture, backend architecture, "
            "and deployment basics."
        ),
        "display_order": 3,
        "skills": [
            ("javascript", 9),
            ("typescript", 8),
            ("react", 9),
            ("rest-apis", 8),
            ("nodejs", 7),
            ("databases", 7),
            ("authentication", 6),
            ("frontend-architecture", 7),
            ("backend-architecture", 6),
            ("deployment", 5),
        ],
    },
]


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

        for skill_slug, weight in role_data["skills"]:
            role_skill = RoleSkill(
                id=uuid.uuid4(),
                role_id=role_id,
                skill_id=skill_map[skill_slug],
                weight=weight,
            )
            session.add(role_skill)

    await session.commit()
    logger.info("seed.completed", roles=len(ROLES), skills=len(SKILLS))


async def run_seed() -> None:
    async with async_session_factory() as session:
        await seed_data(session)


if __name__ == "__main__":
    asyncio.run(run_seed())
