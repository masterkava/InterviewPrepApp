"""Answer evaluation engine."""

import structlog

from app.ai.provider import LLMProvider
from app.ai.schemas import EvaluationOutput
from app.config import settings
from app.prompts.manager import render_prompt

logger = structlog.get_logger()


class AnswerEvaluator:
    def __init__(self, provider: LLMProvider) -> None:
        self._provider = provider

    async def evaluate(
        self,
        role_name: str,
        experience_level: str,
        question_text: str,
        answer_text: str,
    ) -> EvaluationOutput:
        user_prompt = render_prompt(
            settings.prompt_version, "evaluator", "answer_evaluation",
            role_name=role_name,
            experience_level=experience_level,
            question_text=question_text,
            answer_text=answer_text,
        )

        return await self._provider.chat_completion(
            messages=[
                {"role": "system", "content": "You are an expert technical interviewer evaluating candidate answers. Respond only with valid JSON."},
                {"role": "user", "content": user_prompt},
            ],
            output_schema=EvaluationOutput,
            model=settings.llm_model_evaluation,
        )
