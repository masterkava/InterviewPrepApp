"""LLM provider factory."""

from app.ai.mock_provider import MockProvider
from app.ai.openai_provider import OpenAIProvider
from app.ai.provider import LLMProvider
from app.config import settings


def get_llm_provider() -> LLMProvider:
    if settings.openai_api_key and settings.openai_api_key != "mock":
        return OpenAIProvider()
    return MockProvider()
