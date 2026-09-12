"""Question bank API — serves browsable question banks from JSON files."""

import json
from pathlib import Path

from fastapi import APIRouter, Query

router = APIRouter(prefix="/question-bank", tags=["question-bank"])

BANK_DIR = Path(__file__).resolve().parent.parent / "db" / "question_banks"
BATCH_DIR = Path(__file__).resolve().parent.parent.parent.parent / "docs" / "question_bank"

CATEGORY_CONFIG = {
    "python": {"file": "python.json", "label": "Python", "topic_field": "topic"},
    "ai_ml": {"file": "ai_ml.json", "label": "AI/ML", "topic_field": "topic"},
    "backend": {"dir": "BackendEngineer", "label": "Backend Engineering", "topic_field": "domain"},
}

_cache: list[dict] | None = None


def _load_single_file(filepath: Path, category: str, cfg: dict) -> list[dict]:
    if not filepath.exists():
        return []
    data = json.loads(filepath.read_text(encoding="utf-8"))
    raw = data.get("question_bank", data).get("questions", [])
    questions: list[dict] = []
    for q in raw:
        topic = q.get(cfg["topic_field"], "") or q.get("topic", "")
        questions.append({
            "id": q.get("id", ""),
            "category": category,
            "category_label": cfg["label"],
            "topic": topic,
            "subtopic": q.get("subtopic", ""),
            "difficulty": q.get("difficulty", "Medium"),
            "question_type": q.get("question_type", "conceptual"),
            "question_text": q.get("question", ""),
            "answer": q.get("answer", ""),
            "key_concepts": q.get("key_concepts", []),
            "expected_points": q.get("expected_points", []),
            "common_mistakes": q.get("common_mistakes", []),
            "example": q.get("example", ""),
            "follow_up_questions": q.get("follow_up_questions", []),
            "evaluation_rubric": q.get("evaluation_rubric", {}),
        })
    return questions


def _load_batch_directory(dir_path: Path, category: str, cfg: dict) -> list[dict]:
    """Load all batch JSON files from a directory, deduplicate by ID."""
    if not dir_path.exists():
        return []

    seen: dict[str, dict] = {}

    def _sort_key(f: Path) -> tuple[int, str]:
        name = f.stem.lower()
        priority = 0 if "draft" in name else 1
        return (priority, name)

    for filepath in sorted(dir_path.glob("*.json"), key=_sort_key):
        try:
            data = json.loads(filepath.read_text(encoding="utf-8"))
            bank = data.get("question_bank", data)
            raw = bank.get("questions", [])

            for q in raw:
                qid = q.get("id", "")
                topic = q.get(cfg["topic_field"], "") or q.get("topic", "")
                entry = {
                    "id": qid,
                    "category": category,
                    "category_label": cfg["label"],
                    "topic": topic,
                    "subtopic": q.get("subtopic", ""),
                    "difficulty": q.get("difficulty", "Medium"),
                    "question_type": q.get("question_type", "conceptual"),
                    "question_text": q.get("question", ""),
                    "answer": q.get("answer", ""),
                    "key_concepts": q.get("key_concepts", []),
                    "expected_points": q.get("expected_points", []),
                    "common_mistakes": q.get("common_mistakes", []),
                    "example": q.get("example", ""),
                    "follow_up_questions": q.get("follow_up_questions", []),
                    "evaluation_rubric": q.get("evaluation_rubric", {}),
                }
                seen[qid] = entry
        except Exception:
            continue

    return list(seen.values())


def _load_all() -> list[dict]:
    questions: list[dict] = []
    for category, cfg in CATEGORY_CONFIG.items():
        if "dir" in cfg:
            dir_path = BATCH_DIR / cfg["dir"]
            questions.extend(_load_batch_directory(dir_path, category, cfg))
        elif "file" in cfg:
            filepath = BANK_DIR / cfg["file"]
            questions.extend(_load_single_file(filepath, category, cfg))
    return questions


def _get_questions() -> list[dict]:
    global _cache
    if _cache is None:
        _cache = _load_all()
    return _cache


def reload_cache() -> None:
    global _cache
    _cache = None


@router.get("")
async def list_questions(
    category: str | None = None,
    topic: str | None = None,
    difficulty: str | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    filtered = _get_questions()

    if category:
        filtered = [q for q in filtered if q["category"] == category]
    if topic:
        filtered = [q for q in filtered if q["topic"] == topic]
    if difficulty:
        filtered = [q for q in filtered if q["difficulty"].lower() == difficulty.lower()]
    if search:
        s = search.lower()
        filtered = [
            q for q in filtered
            if s in q["question_text"].lower() or s in q["answer"].lower()
        ]

    total = len(filtered)
    start = (page - 1) * limit
    page_items = filtered[start : start + limit]

    return {
        "questions": page_items,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": max(1, (total + limit - 1) // limit),
    }


@router.get("/meta")
async def get_metadata():
    questions = _get_questions()

    categories_map: dict[str, set[str]] = {}
    for q in questions:
        cat = q["category"]
        if cat not in categories_map:
            categories_map[cat] = set()
        if q["topic"]:
            categories_map[cat].add(q["topic"])

    categories = []
    for cat, cfg in CATEGORY_CONFIG.items():
        topics = sorted(categories_map.get(cat, set()))
        count = sum(1 for q in questions if q["category"] == cat)
        categories.append({
            "slug": cat,
            "label": cfg["label"],
            "topics": topics,
            "count": count,
        })

    return {"categories": categories, "total": len(questions)}
