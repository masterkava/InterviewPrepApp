"""Question generation engine."""

import random

import structlog

from app.ai.provider import LLMProvider
from app.ai.schemas import FollowUpOutput, QuestionGenerationOutput
from app.config import settings
from app.interview.state import InterviewState
from app.prompts.manager import render_prompt

logger = structlog.get_logger()


class QuestionEngine:
    def __init__(self, provider: LLMProvider) -> None:
        self._provider = provider

    async def generate_question(self, state: InterviewState) -> QuestionGenerationOutput:
        target_skill = self._pick_next_skill(state)
        target_difficulty = self._pick_difficulty(state)

        previous_questions = "\n".join(
            f"- {q.question_text}" for q in state.questions
        ) or "None yet."

        last_exchange = ""
        if state.last_question and state.last_question.answer_text:
            last_exchange = (
                f"Last question: {state.last_question.question_text}\n"
                f"Last answer: {state.last_question.answer_text}"
            )

        system_prompt = render_prompt(
            settings.prompt_version, "interviewer", "system",
            role_name=state.role_name,
            experience_level=state.experience_level,
            difficulty=state.difficulty,
            total_questions=state.question_budget,
        )
        user_prompt = render_prompt(
            settings.prompt_version, "interviewer", "question_generation",
            question_number=state.questions_asked + 1,
            total_questions=state.question_budget,
            target_skill=target_skill,
            target_difficulty=target_difficulty,
            skills_covered=", ".join(state.skills_covered) or "None yet",
            previous_questions=previous_questions,
            last_exchange=last_exchange or "This is the first question.",
            experience_level=state.experience_level,
            role_name=state.role_name,
        )

        return await self._provider.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            output_schema=QuestionGenerationOutput,
            model=settings.llm_model_generation,
        )

    async def generate_follow_up(
        self,
        state: InterviewState,
        original_question: str,
        candidate_answer: str,
        overall_score: float,
        follow_up_reason: str,
    ) -> FollowUpOutput:
        purpose = "probe deeper into the topic"
        if overall_score <= 4:
            purpose = "give the candidate a chance to clarify or recover"
        elif overall_score >= 7:
            purpose = "probe for deeper understanding"

        system_prompt = render_prompt(
            settings.prompt_version, "interviewer", "system",
            role_name=state.role_name,
            experience_level=state.experience_level,
            difficulty=state.difficulty,
            total_questions=state.question_budget,
        )
        user_prompt = render_prompt(
            settings.prompt_version, "interviewer", "follow_up",
            original_question=original_question,
            candidate_answer=candidate_answer,
            overall_score=overall_score,
            follow_up_reason=follow_up_reason,
            follow_up_purpose=purpose,
        )

        return await self._provider.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            output_schema=FollowUpOutput,
            model=settings.llm_model_generation,
        )

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
