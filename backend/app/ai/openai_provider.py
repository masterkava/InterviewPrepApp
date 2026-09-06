"""OpenAI LLM provider implementation."""

import json

import structlog
from openai import AsyncOpenAI
from pydantic import BaseModel, ValidationError

from app.ai.provider import LLMProvider, T
from app.config import settings
from app.exceptions import AIError

logger = structlog.get_logger()


class OpenAIProvider(LLMProvider):
    def __init__(self) -> None:
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def chat_completion(
        self,
        messages: list[dict[str, str]],
        output_schema: type[T],
        model: str | None = None,
    ) -> T:
        model = model or settings.llm_model_generation
        max_retries = settings.llm_max_retries

        for attempt in range(max_retries):
            try:
                response = await self._client.chat.completions.create(
                    model=model,
                    messages=messages,
                    response_format={"type": "json_object"},
                    temperature=0.7,
                    timeout=settings.llm_timeout_seconds,
                )
                content = response.choices[0].message.content
                if not content:
                    raise AIError("LLM returned empty response")

                data = json.loads(content)
                return output_schema.model_validate(data)

            except ValidationError as e:
                logger.warning(
                    "llm.schema_validation_failed",
                    attempt=attempt + 1,
                    error=str(e),
                )
                if attempt < max_retries - 1:
                    messages.append({"role": "assistant", "content": content})
                    messages.append({
                        "role": "user",
                        "content": f"Your JSON response did not match the expected schema. Fix these errors and try again: {e}",
                    })
                    continue
                raise AIError(f"LLM output schema validation failed after {max_retries} attempts") from e

            except json.JSONDecodeError as e:
                logger.warning("llm.json_parse_failed", attempt=attempt + 1)
                if attempt < max_retries - 1:
                    messages.append({
                        "role": "user",
                        "content": "Your response was not valid JSON. Respond with valid JSON only.",
                    })
                    continue
                raise AIError("LLM returned invalid JSON") from e

            except Exception as e:
                if "openai" in type(e).__module__.lower():
                    logger.error("llm.api_error", attempt=attempt + 1, error=str(e))
                    if attempt < max_retries - 1:
                        continue
                    raise AIError(f"OpenAI API error: {e}") from e
                raise
