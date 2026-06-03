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

    # ── Watcher de portails immobiliers (couche sources) ──────────────────
    # Désactivé par défaut : aucun scraping tant que les cibles ne sont pas
    # validées légalement (robots.txt / CGU — doc P3). Aucune URL en dur.
    WATCHER_ENABLED: bool = False
    # JSON : [{"company_id":"<uuid>","source_type":"other","channel":"bayut",
    #          "urls":["https://..."]}]
    WATCHER_TARGETS: str = ""
    # Délai poli (secondes) entre deux fetchs successifs (anti-bot / rate-limit).
    WATCHER_FETCH_DELAY_S: float = 2.0

    # Vitrine immobilière publique (mono-agence). Vide = fail-safe : aucune
    # annonce exposée, aucune fuite tenant (la dép get_public_db renvoie vide).
    PUBLIC_SITE_COMPANY_SLUG: str = ""
    PUBLIC_PHOTO_URL_TTL_S: int = 86400

    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str
    MINIO_SECRET_KEY: str
    MINIO_BUCKET: str = "sgi-media"

    GOOGLE_MAPS_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # ── Téléphonie / Asterisk AMI ────────────────────────────────────────
    # Consommé par le module telephony (pont AMI → WebSocket). Si le listener
    # ne peut joindre l'AMI, il se met en reconnexion silencieuse (l'API reste
    # up). TELEPHONY_AMI_ENABLED=false coupe le listener au démarrage.
    AMI_HOST: str = "asterisk"
    AMI_PORT: int = 5038
    AMI_USER: str = "sgi-api"
    AMI_PASSWORD: str = ""
    TELEPHONY_AMI_ENABLED: bool = True
    # Technologie de canal pour l'Originate (click-to-call) et le parsing des
    # noms de canaux AMI. "PJSIP" pour Asterisk ≥12 (dev dockerisé), "SIP" pour
    # un Asterisk 11 (chan_sip) → canal `SIP/1012`. Insensible à la casse.
    TELEPHONY_CHANNEL_TECH: str = "PJSIP"
    # Contexte du dialplan utilisé par l'Originate pour router le numéro composé.
    # En dev : "internal". Sur un Asterisk réel, mettre le contexte qui sait
    # joindre l'extérieur/le trunk (souvent "from-internal").
    TELEPHONY_ORIGINATE_CONTEXT: str = "internal"
    # Enregistrements : répertoire local du volume Asterisk lu par le worker
    # d'upload, et durée de rétention PDPL (purge au-delà → MinIO + recording_url).
    RECORDING_MONITOR_DIR: str = "/var/spool/asterisk/monitor"
    RECORDING_RETENTION_DAYS: int = 365
    # PDPL fail-closed : un CDR créé par l'AMI n'est PAS présumé consenti.
    # L'annonce de consentement est jouée par le dialplan, mais l'API ne reçoit
    # aujourd'hui aucun signal le confirmant → par défaut consent=False (pas
    # d'upload/exposition d'enregistrement). Mettre =true en dev pour activer
    # l'enregistrement automatique des appels AMI. Mécanisme propre à venir :
    # UserEvent Asterisk portant le consentement effectif.
    TELEPHONY_ASSUME_RECORDING_CONSENT: bool = False

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

    @property
    def RLS_ENFORCED(self) -> bool:
        """True quand l'API se connecte via le rôle restreint `sgi_app` et que la
        RLS multi-tenant est donc réellement appliquée par PostgreSQL.

        False = fallback sur le rôle privilégié (`sgi_user`, BYPASSRLS) : les
        policies `tenant_isolation` sont **inertes** et l'isolation ne repose plus
        que sur le filtrage applicatif `company_id`. Le boot refuse ce cas en prod
        (cf. `main.py`)."""
        return bool(self.APP_DB_PASSWORD)


settings = Settings()
