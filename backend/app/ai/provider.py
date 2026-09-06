"""LLM provider abstraction."""

from abc import ABC, abstractmethod
from typing import TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class LLMProvider(ABC):
    @abstractmethod
    async def chat_completion(
        self,
        messages: list[dict[str, str]],
        output_schema: type[T],
        model: str | None = None,
    ) -> T:
        ...
