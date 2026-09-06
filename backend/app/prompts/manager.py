"""Prompt manager for loading and rendering templates."""

from functools import lru_cache
from pathlib import Path

import structlog

logger = structlog.get_logger()

PROMPTS_DIR = Path(__file__).parent


@lru_cache(maxsize=32)
def _load_template(version: str, category: str, name: str) -> str:
    path = PROMPTS_DIR / version / category / f"{name}.txt"
    return path.read_text(encoding="utf-8")


def render_prompt(
    version: str,
    category: str,
    name: str,
    **kwargs: object,
) -> str:
    template = _load_template(version, category, name)
    try:
        return template.format(**kwargs)
    except KeyError as e:
        logger.error("prompt.render_failed", template=f"{version}/{category}/{name}", missing_key=str(e))
        raise
