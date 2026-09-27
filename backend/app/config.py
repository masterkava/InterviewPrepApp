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

    # Voice
    tts_model: str = "tts-1"
    tts_voice: str = "nova"

    # Interview
    default_question_budget: int = 10
    max_follow_ups_per_topic: int = 2
    prompt_version: str = "v1"

    # Auth / JWT
    jwt_secret_key: str = "CHANGE-ME-IN-PRODUCTION"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    jwt_refresh_token_expire_days: int = 30

    # Email / SMTP
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_use_tls: bool = True

    # Password reset
    password_reset_expire_minutes: int = 15

    # OTP
    otp_expire_minutes: int = 5
    otp_max_attempts: int = 3
    otp_cooldown_seconds: int = 60

    # App
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:8081"]
    log_level: str = "INFO"
    app_version: str = "0.1.0"


settings = Settings()
