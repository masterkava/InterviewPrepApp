"""Answer evaluation engine — LLM-based semantic evaluation."""

import structlog

from app.ai.provider import LLMProvider
from app.ai.schemas import EvaluationOutput
from app.config import settings
from app.prompts.manager import render_prompt

logger = structlog.get_logger()


def _build_grading_context(
    reference_answer: str | None,
    expected_concepts: list[str] | None,
) -> str:
    parts = []
    if reference_answer:
        parts.append(
            "\nREFERENCE ANSWER (use as grading context — the candidate does NOT need to match "
            "this word-for-word; paraphrasing, different examples, or alternative correct "
            "approaches are equally valid):\n"
            f"{reference_answer}"
        )
    if expected_concepts:
        concepts_str = "\n".join(f"- {c}" for c in expected_concepts)
        parts.append(
            "\nEXPECTED CONCEPTS (check whether the candidate's answer covers these ideas "
            "semantically — exact wording is NOT required; synonyms, paraphrasing, and examples "
            "that demonstrate the concept all count as covered):\n"
            f"{concepts_str}"
        )
    if parts:
        return "\n".join(parts) + "\n"
    return ""


class AnswerEvaluator:
    def __init__(self, provider: LLMProvider) -> None:
        self._provider = provider

    async def evaluate(
        self,
        role_name: str,
        experience_level: str,
        question_text: str,
        answer_text: str,
        reference_answer: str | None = None,
        expected_concepts: list[str] | None = None,
    ) -> EvaluationOutput:
        grading_context = _build_grading_context(reference_answer, expected_concepts)

        user_prompt = render_prompt(
            settings.prompt_version, "evaluator", "answer_evaluation",
            role_name=role_name,
            experience_level=experience_level,
            question_text=question_text,
            answer_text=answer_text,
            grading_context=grading_context,
        )

        return await self._provider.chat_completion(
            messages=[
                {"role": "system", "content": "You are an expert technical interviewer evaluating candidate answers. Score based on semantic understanding, not keyword matching. Respond only with valid JSON."},
                {"role": "user", "content": user_prompt},
            ],
            output_schema=EvaluationOutput,
            model=settings.llm_model_evaluation,
        )
