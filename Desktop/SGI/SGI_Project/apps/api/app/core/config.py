from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DEBUG: bool = False
    SECRET_KEY: str
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "sgi"
    POSTGRES_USER: str = "sgi_user"
    POSTGRES_PASSWORD: str

    VALKEY_URL: str = "redis://valkey:6379/0"

    MEILI_HOST: str = "http://meilisearch:7700"
    MEILI_MASTER_KEY: str

    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str
    MINIO_SECRET_KEY: str
    MINIO_BUCKET: str = "sgi-media"

    GOOGLE_MAPS_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # Agenda Real Estate — source Google Calendar (ID/email du calendrier) +
    # fuseau d'affichage. Miroir serveur de NEXT_PUBLIC_GOOGLE_CALENDAR_SRC.
    GOOGLE_CALENDAR_SRC: str = ""
    AGENDA_TIMEZONE: str = "Asia/Dubai"

    JWT_ACCESS_EXPIRE_HOURS: int = 8
    JWT_REFRESH_EXPIRE_DAYS: int = 30

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


settings = Settings()
