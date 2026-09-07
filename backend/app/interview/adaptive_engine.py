"""Adaptive question engine — picks questions from the seed question bank."""

import random

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.schemas import QuestionGenerationOutput
from app.interview.state import InterviewState
from app.models.role import SeedQuestion, Skill

logger = structlog.get_logger()

DIFFICULTY_ORDER = ["easy", "medium", "hard"]


class AdaptiveQuestionEngine:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def pick_question(self, state: InterviewState) -> QuestionGenerationOutput:
        target_skill = self._pick_next_skill(state)
        target_difficulty = self._pick_difficulty(state)

        question = await self._find_question(state, target_skill, target_difficulty)

        if question is None:
            question = await self._find_fallback(state, target_skill, target_difficulty)

        if question is None:
            question = await self._find_any_question(state)

        if question is None:
            return QuestionGenerationOutput(
                question_text="Tell me about a challenging technical problem you've solved recently.",
                difficulty=target_difficulty,
                skill_area=target_skill,
                reasoning="No more questions available in the bank; using generic fallback.",
            )

        return QuestionGenerationOutput(
            question_text=question.question_text,
            difficulty=question.difficulty,
            skill_area=target_skill,
            reasoning=f"Selected from question bank: {target_skill} at {question.difficulty} difficulty.",
        )

    async def _find_question(
        self,
        state: InterviewState,
        skill_slug: str,
        difficulty: str,
    ) -> SeedQuestion | None:
        asked_texts = {q.question_text for q in state.questions}

        stmt = (
            select(SeedQuestion)
            .join(Skill, SeedQuestion.skill_id == Skill.id)
            .where(
                SeedQuestion.role_id == state.role_id,
                Skill.slug == skill_slug,
                SeedQuestion.difficulty == difficulty,
                SeedQuestion.is_active.is_(True),
            )
        )

        result = await self._db.execute(stmt)
        candidates = [q for q in result.scalars().all() if q.question_text not in asked_texts]

        if not candidates:
            return None
        return random.choice(candidates)

    async def _find_fallback(
        self,
        state: InterviewState,
        skill_slug: str,
        target_difficulty: str,
    ) -> SeedQuestion | None:
        idx = DIFFICULTY_ORDER.index(target_difficulty)
        adjacent = []
        if idx > 0:
            adjacent.append(DIFFICULTY_ORDER[idx - 1])
        if idx < len(DIFFICULTY_ORDER) - 1:
            adjacent.append(DIFFICULTY_ORDER[idx + 1])

        for diff in adjacent:
            q = await self._find_question(state, skill_slug, diff)
            if q is not None:
                logger.info(
                    "adaptive.difficulty_fallback",
                    target=target_difficulty,
                    actual=diff,
                    skill=skill_slug,
                )
                return q

        other_skills = [s for s in state.skill_weights if s != skill_slug]
        random.shuffle(other_skills)
        for skill in other_skills:
            q = await self._find_question(state, skill, target_difficulty)
            if q is not None:
                logger.info(
                    "adaptive.skill_fallback",
                    target_skill=skill_slug,
                    actual_skill=skill,
                )
                return q

        return None

    async def _find_any_question(self, state: InterviewState) -> SeedQuestion | None:
        asked_texts = {q.question_text for q in state.questions}

        stmt = (
            select(SeedQuestion)
            .where(
                SeedQuestion.role_id == state.role_id,
                SeedQuestion.is_active.is_(True),
            )
        )
        result = await self._db.execute(stmt)
        candidates = [q for q in result.scalars().all() if q.question_text not in asked_texts]

        if not candidates:
            return None
        return random.choice(candidates)

    def _pick_next_skill(self, state: InterviewState) -> str:
        remaining = state.skills_remaining
        if remaining:
            if state.focus_areas:
                focus_remaining = [s for s in remaining if s in state.focus_areas]
                if focus_remaining:
                    return self._weighted_choice(focus_remaining, state.skill_weights)
            return self._weighted_choice(remaining, state.skill_weights)
        all_skills = list(state.skill_weights.keys())
        return random.choice(all_skills)

    def _weighted_choice(self, skills: list[str], weights: dict[str, int]) -> str:
        w = [weights.get(s, 5) for s in skills]
        return random.choices(skills, weights=w, k=1)[0]

    def _pick_difficulty(self, state: InterviewState) -> str:
        if state.difficulty != "adaptive":
            return state.difficulty
        if state.questions_asked == 0:
            level_map = {"fresher": "easy", "junior": "easy", "mid": "medium", "senior": "medium"}
            return level_map.get(state.experience_level, "medium")
        recent = [q.overall_score for q in state.questions[-3:] if q.overall_score is not None]
        if not recent:
            return "medium"
        avg = sum(recent) / len(recent)
        if avg >= 7:
            return "hard"
        if avg <= 4:
            return "easy"
        return "medium"
