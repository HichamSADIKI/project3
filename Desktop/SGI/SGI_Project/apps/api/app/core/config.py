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

    # Rôle applicatif restreint (C1) — non-superuser, RLS appliquée.
    # Utilisé par les requêtes API. Si APP_DB_PASSWORD est vide, l'API retombe
    # sur le rôle privilégié (comportement historique, RLS non appliquée).
    APP_DB_USER: str = "sgi_app"
    APP_DB_PASSWORD: str = ""

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

    JWT_ACCESS_EXPIRE_HOURS: int = 8
    JWT_REFRESH_EXPIRE_DAYS: int = 30
    # Coût bcrypt (2^rounds). 12 en prod ; les tests l'abaissent à 4 (≈250× plus
    # rapide) — le hachage des mots de passe dans les fixtures dominait le temps.
    BCRYPT_ROUNDS: int = 12

    @property
    def DATABASE_URL(self) -> str:
        """Connexion privilégiée (sgi_user) — migrations + worker Celery."""
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def APP_DATABASE_URL(self) -> str:
        """Connexion restreinte (sgi_app) pour les requêtes API — RLS appliquée.

        Retombe sur DATABASE_URL si APP_DB_PASSWORD n'est pas fourni, pour ne
        pas casser un environnement qui n'a pas encore créé le rôle restreint.
        """
        if not self.APP_DB_PASSWORD:
            return self.DATABASE_URL
        return (
            f"postgresql+asyncpg://{self.APP_DB_USER}:{self.APP_DB_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


settings = Settings()
