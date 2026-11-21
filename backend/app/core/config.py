import os
from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "menu-design-dev-secret-key-change-in-production-min-32-chars-long!"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    DATABASE_URL: str = "sqlite:///./app.db"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Auth rate limiting (SEC-F02): max attempts per client IP per minute, per endpoint
    AUTH_RATE_LIMIT_ENABLED: bool = True
    AUTH_RATE_LIMIT_PER_MINUTE: int = 10
    # Comma-separated IPs/CIDRs of reverse proxies whose CF-Connecting-IP / X-Forwarded-For
    # headers are trusted (e.g. the docker network of cloudflared). Empty = never trust them.
    TRUSTED_PROXY_IPS: str = ""

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @field_validator("AUTH_RATE_LIMIT_PER_MINUTE")
    @classmethod
    def validate_rate_limit(cls, v: int) -> int:
        if v < 1:
            raise ValueError("AUTH_RATE_LIMIT_PER_MINUTE must be >= 1 (use AUTH_RATE_LIMIT_ENABLED=false to disable).")
        return v

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str, info) -> str:
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long for security.")
        env = info.data.get("ENVIRONMENT", "development")
        if env == "production" and "change-in-production" in v:
            raise ValueError("Default development SECRET_KEY is not allowed in production.")
        return v

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
