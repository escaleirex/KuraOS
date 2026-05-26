from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    # Inference backend preference
    inference_mode: Literal["local", "cloud", "auto"] = "auto"

    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_default_model: str = "qwen3:8b"

    # Cloud API keys (all optional — only used when cloud fallback active)
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    groq_api_key: str = ""
    openrouter_api_key: str = ""

    # Cloud model preference order
    cloud_preferred_provider: Literal["openai", "anthropic", "groq", "openrouter"] = "groq"

    # PostgreSQL + pgvector
    postgres_dsn: str = "postgresql://kura:kura_dev@localhost:5432/kura"

    # kura-daemon API
    kura_daemon_url: str = "http://localhost:9080"
    kura_daemon_token: str = ""  # service token from /var/lib/kura/axis.token

    # CORS
    allowed_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://192.168.1.205:5173",
    ]

    class Config:
        env_file = "/etc/kura/axis.env"
        env_file_encoding = "utf-8"


settings = Settings()
