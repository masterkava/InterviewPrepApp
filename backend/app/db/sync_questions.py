"""Question bank sync — loads batched JSON question files into the database.

Reads from docs/question_bank/<RoleName>/ directories (schema v2 format).
Supports clear-and-reseed, incremental adds, and multiple roles.

Usage:
    python -m app.db.sync_questions                 # sync all directories
    python -m app.db.sync_questions BackendEngineer  # sync one directory
    python -m app.db.sync_questions --clear          # clear all synced questions first
"""

import asyncio
import json
import sys
import uuid
from pathlib import Path

import structlog
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory, engine
from app.models.base import Base
from app.models.role import Role, RoleSkill, SeedQuestion, Skill

logger = structlog.get_logger()

QUESTION_BANK_ROOT = (
    Path(__file__).resolve().parent.parent.parent.parent / "docs" / "question_bank"
)

DIFFICULTY_NORMALIZE: dict[str, str] = {
    "easy": "easy",
    "medium": "medium",
    "hard": "hard",
    "expert": "hard",
}

# ──────────────────────────────────────────────────────────────────────
# Per-directory sync configuration.
# To add a new role (e.g. FrontendEngineer), add an entry here and
# create the corresponding directory under docs/question_bank/.
# ──────────────────────────────────────────────────────────────────────

SYNC_CONFIG: dict[str, dict] = {
    "BackendEngineer": {
        "role": {
            "slug": "backend-engineer",
            "name": "Backend Engineer",
            "description": (
                "Technical interview for backend engineering roles. "
                "Covers HTTP & Web Protocols, REST API Design, "
                "Databases (SQL & NoSQL), Authentication, Caching, "
                "Messaging, and Distributed Systems."
            ),
            "display_order": 4,
        },
        "extra_skills": {
            "http": {"name": "HTTP & Web Protocols", "category": "concept"},
            "nosql": {"name": "NoSQL Databases", "category": "concept"},
            "authentication": {
                "name": "Authentication & Authorization",
                "category": "concept",
            },
        },
        "role_skills": [
            ("web-frameworks", 7),
            ("http", 8),
            ("api-design", 9),
            ("authentication", 7),
            ("sql", 8),
            ("nosql", 7),
            ("databases", 8),
            ("caching", 7),
            ("messaging", 7),
            ("distributed-systems", 8),
            ("system-design", 7),
            ("security", 7),
        ],
        "domain_to_skill": {
            "backend_fundamentals": "web-frameworks",
            "http_web_protocols": "http",
            "http_networking": "http",
            "rest_api_design": "api-design",
            "authentication_authorization": "authentication",
            "sql_relational_databases": "sql",
            "nosql_data_modeling": "nosql",
            "caching_strategies": "caching",
            "messaging_async_processing": "messaging",
            "distributed_systems": "distributed-systems",
            "distributed_systems_fundamentals": "distributed-systems",
            "distributed_systems_consensus": "distributed-systems",
            "distributed_systems_consistency": "distributed-systems",
            "distributed_systems_replication": "distributed-systems",
            "distributed_systems_time": "distributed-systems",
            "distributed_systems_coordination": "distributed-systems",
        },
        "fallback_skill": "web-frameworks",
    },
}


async def _get_or_create_skill(
    session: AsyncSession,
    slug: str,
    skill_cache: dict[str, uuid.UUID],
    extra_skills: dict[str, dict],
) -> uuid.UUID | None:
    if slug in skill_cache:
        return skill_cache[slug]

    result = await session.execute(select(Skill).where(Skill.slug == slug))
    skill = result.scalar_one_or_none()
    if skill:
        skill_cache[slug] = skill.id
        return skill.id

    if slug in extra_skills:
        info = extra_skills[slug]
        skill = Skill(
            id=uuid.uuid4(),
            slug=slug,
            name=info["name"],
            category=info["category"],
        )
        session.add(skill)
        await session.flush()
        skill_cache[slug] = skill.id
        logger.info("sync.skill_created", slug=slug)
        return skill.id

    return None


async def _ensure_role(
    session: AsyncSession,
    config: dict,
    skill_cache: dict[str, uuid.UUID],
) -> uuid.UUID:
    role_cfg = config["role"]

    result = await session.execute(
        select(Role).where(Role.slug == role_cfg["slug"])
    )
    role = result.scalar_one_or_none()

    if role is not None:
        return role.id

    role = Role(
        id=uuid.uuid4(),
        slug=role_cfg["slug"],
        name=role_cfg["name"],
        description=role_cfg["description"],
        display_order=role_cfg["display_order"],
        is_active=True,
    )
    session.add(role)
    await session.flush()
    logger.info("sync.role_created", slug=role_cfg["slug"])

    for skill_slug, weight in config.get("role_skills", []):
        skill_id = skill_cache.get(skill_slug)
        if skill_id is None:
            continue
        existing = await session.execute(
            select(RoleSkill).where(
                RoleSkill.role_id == role.id,
                RoleSkill.skill_id == skill_id,
            )
        )
        if existing.scalar_one_or_none() is None:
            rs = RoleSkill(
                id=uuid.uuid4(),
                role_id=role.id,
                skill_id=skill_id,
                weight=weight,
            )
            session.add(rs)

    await session.flush()
    return role.id


def _load_questions_from_directory(dir_path: Path) -> list[dict]:
    """Load all batch JSON files, deduplicate by source_id.

    Draft files are loaded first so proper batch files overwrite them.
    """
    questions: dict[str, dict] = {}

    def _sort_key(f: Path) -> tuple[int, str]:
        name = f.stem.lower()
        priority = 0 if "draft" in name else 1
        return (priority, name)

    files = sorted(dir_path.glob("*.json"), key=_sort_key)

    for filepath in files:
        try:
            data = json.loads(filepath.read_text(encoding="utf-8"))
            bank = data.get("question_bank", data)
            raw_questions = bank.get("questions", [])

            for q in raw_questions:
                source_id = q.get("id", "")
                if not source_id:
                    continue

                if source_id in questions:
                    old_file = questions[source_id].get("_source_file", "unknown")
                    logger.warning(
                        "sync.duplicate_id_overwritten",
                        source_id=source_id,
                        old_file=old_file,
                        new_file=filepath.name,
                    )

                q["_source_file"] = filepath.name
                questions[source_id] = q

        except Exception as e:
            logger.error("sync.file_load_error", file=filepath.name, error=str(e))

    return list(questions.values())


async def sync_questions(
    session: AsyncSession,
    directory: str | None = None,
    clear: bool = False,
) -> dict:
    """Sync questions from batch files into the database.

    Args:
        session: Database session.
        directory: Specific directory name (e.g. "BackendEngineer").
                   If None, sync all configured directories.
        clear: If True, delete existing synced questions before re-inserting.

    Returns:
        Summary dict with counts.
    """
    dirs_to_sync: dict[str, dict] = {}

    if directory:
        if directory not in SYNC_CONFIG:
            return {"error": f"Unknown directory '{directory}'. Known: {list(SYNC_CONFIG.keys())}"}
        dirs_to_sync[directory] = SYNC_CONFIG[directory]
    else:
        dirs_to_sync = dict(SYNC_CONFIG)

    # Build skill cache from DB
    skill_cache: dict[str, uuid.UUID] = {}
    result = await session.execute(select(Skill))
    for skill in result.scalars().all():
        skill_cache[skill.slug] = skill.id

    stats: dict[str, dict] = {}

    for dir_name, config in dirs_to_sync.items():
        dir_path = QUESTION_BANK_ROOT / dir_name
        if not dir_path.exists():
            stats[dir_name] = {"error": f"Directory not found: {dir_path}"}
            logger.warning("sync.directory_not_found", directory=dir_name)
            continue

        # Ensure skills from this config exist
        for slug, info in config.get("extra_skills", {}).items():
            await _get_or_create_skill(session, slug, skill_cache, config["extra_skills"])

        # Ensure role exists
        role_id = await _ensure_role(session, config, skill_cache)

        # Clear existing synced questions for this role
        if clear:
            deleted = await session.execute(
                delete(SeedQuestion).where(SeedQuestion.role_id == role_id)
            )
            logger.info(
                "sync.cleared_role",
                role=config["role"]["slug"],
                deleted=deleted.rowcount,
            )
        else:
            deleted = await session.execute(
                delete(SeedQuestion).where(
                    SeedQuestion.role_id == role_id,
                    SeedQuestion.source_id.isnot(None),
                )
            )
            logger.info(
                "sync.cleared_synced",
                role=config["role"]["slug"],
                deleted=deleted.rowcount,
            )

        # Load questions
        questions = _load_questions_from_directory(dir_path)
        domain_to_skill = config.get("domain_to_skill", {})
        fallback_skill = config.get("fallback_skill", "web-frameworks")

        inserted = 0
        skipped = 0

        for q in questions:
            domain = q.get("domain", "")
            skill_slug = domain_to_skill.get(domain, fallback_skill)
            skill_id = skill_cache.get(skill_slug)
            if skill_id is None:
                skill_id = skill_cache.get(fallback_skill)
            if skill_id is None:
                skipped += 1
                logger.warning(
                    "sync.skill_not_found",
                    skill=skill_slug,
                    question=q.get("id"),
                )
                continue

            difficulty = DIFFICULTY_NORMALIZE.get(
                q.get("difficulty", "Medium").lower(), "medium"
            )

            extra_data: dict = {}
            for field in (
                "expected_points",
                "common_mistakes",
                "example",
                "follow_up_questions",
                "evaluation_rubric",
                "skills",
                "roles",
                "tags",
            ):
                val = q.get(field)
                if val:
                    extra_data[field] = val

            seed_q = SeedQuestion(
                id=uuid.uuid4(),
                role_id=role_id,
                skill_id=skill_id,
                source_id=q.get("id"),
                domain=domain,
                subtopic=q.get("subtopic"),
                question_text=q.get("question", ""),
                difficulty=difficulty,
                question_type=q.get("question_type", "conceptual"),
                expected_concepts=q.get("key_concepts") or None,
                reference_answer=q.get("answer") or None,
                extra_data=extra_data if extra_data else None,
                time_limit_seconds=90,
                is_active=True,
            )
            session.add(seed_q)
            inserted += 1

        await session.flush()

        stats[dir_name] = {
            "role": config["role"]["slug"],
            "files_scanned": len(list(dir_path.glob("*.json"))),
            "unique_questions": len(questions),
            "inserted": inserted,
            "skipped": skipped,
        }

        logger.info(
            "sync.directory_complete",
            directory=dir_name,
            **stats[dir_name],
        )

    # Log any unconfigured directories
    if directory is None and QUESTION_BANK_ROOT.exists():
        for d in QUESTION_BANK_ROOT.iterdir():
            if d.is_dir() and d.name not in SYNC_CONFIG:
                logger.warning(
                    "sync.unconfigured_directory",
                    directory=d.name,
                    hint="Add an entry to SYNC_CONFIG in sync_questions.py",
                )

    return stats


async def _migrate_seed_questions_table() -> None:
    """Add missing columns to seed_questions if the table already exists (SQLite)."""
    if not str(engine.url).startswith("sqlite"):
        return

    new_columns = {
        "source_id": "VARCHAR(20)",
        "domain": "VARCHAR(100)",
        "subtopic": "VARCHAR(200)",
        "extra_data": "TEXT",
    }

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        for col_name, col_type in new_columns.items():
            try:
                from sqlalchemy import text
                await conn.execute(
                    text(f"ALTER TABLE seed_questions ADD COLUMN {col_name} {col_type}")
                )
                logger.info("sync.column_added", column=col_name)
            except Exception:
                pass


async def run_sync(directory: str | None = None, clear: bool = False) -> dict:
    """Run sync as a standalone operation."""
    await _migrate_seed_questions_table()

    async with async_session_factory() as session:
        result = await sync_questions(session, directory=directory, clear=clear)
        await session.commit()
        return result


if __name__ == "__main__":
    args = sys.argv[1:]
    do_clear = "--clear" in args
    dirs = [a for a in args if not a.startswith("--")]
    target_dir = dirs[0] if dirs else None

    print(f"Syncing question bank{' (' + target_dir + ')' if target_dir else ' (all)'}...")
    if do_clear:
        print("  --clear: will delete existing questions before inserting.")

    result = asyncio.run(run_sync(directory=target_dir, clear=do_clear))

    for dir_name, info in result.items():
        if "error" in info:
            print(f"  {dir_name}: ERROR - {info['error']}")
        else:
            print(
                f"  {dir_name}: {info['inserted']} questions inserted "
                f"({info['unique_questions']} unique from {info['files_scanned']} files) "
                f"-> role '{info['role']}'"
            )
            if info["skipped"]:
                print(f"    WARNING: {info['skipped']} questions skipped (skill not found)")
