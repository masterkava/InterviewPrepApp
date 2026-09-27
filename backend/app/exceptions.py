from fastapi import Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, message: str, code: str = "INTERNAL_ERROR") -> None:
        self.message = message
        self.code = code
        super().__init__(message)


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found", code: str = "NOT_FOUND") -> None:
        super().__init__(message, code)


class ConflictError(AppError):
    def __init__(self, message: str = "Conflict", code: str = "CONFLICT") -> None:
        super().__init__(message, code)


class ValidationError(AppError):
    def __init__(self, message: str = "Validation error", code: str = "VALIDATION_ERROR") -> None:
        super().__init__(message, code)


class AIError(AppError):
    def __init__(self, message: str = "AI service error", code: str = "AI_ERROR") -> None:
        super().__init__(message, code)


class AuthenticationError(AppError):
    def __init__(self, message: str = "Authentication failed", code: str = "AUTH_ERROR") -> None:
        super().__init__(message, code)


class RateLimitError(AppError):
    def __init__(self, message: str = "Too many requests", code: str = "RATE_LIMIT") -> None:
        super().__init__(message, code)


STATUS_MAP: dict[type[AppError], int] = {
    NotFoundError: 404,
    AuthenticationError: 401,
    ConflictError: 409,
    ValidationError: 422,
    RateLimitError: 429,
    AIError: 503,
}


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    status_code = STATUS_MAP.get(type(exc), 500)
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
    )
