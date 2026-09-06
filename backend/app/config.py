from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/interviewprep"

    # AI
    openai_api_key: str = ""
    llm_model_evaluation: str = "gpt-4o"
    llm_model_generation: str = "gpt-4o-mini"
    llm_max_retries: int = 3
    llm_timeout_seconds: int = 30

    # Interview
    default_question_budget: int = 10
    max_follow_ups_per_topic: int = 2
    prompt_version: str = "v1"

    # App
    cors_origins: list[str] = ["http://localhost:5173"]
    log_level: str = "INFO"
    app_version: str = "0.1.0"


settings = Settings()
