from collections.abc import Generator
from contextlib import contextmanager

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

# Engine PRIVILÉGIÉ (sgi_user) — migrations bootstrap + tâches Celery cron qui
# scannent légitimement toutes les sociétés (cross-tenant). Bypasse la RLS.
engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG, pool_pre_ping=True)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)

# Engine APPLICATIF RESTREINT (sgi_app) — requêtes API. La RLS s'applique
# réellement (rôle non-superuser, non-propriétaire). Retombe sur l'engine
# privilégié si APP_DB_PASSWORD n'est pas configuré (comportement historique).
app_engine = create_async_engine(
    settings.APP_DATABASE_URL, echo=settings.DEBUG, pool_pre_ping=True
)
app_session_maker = async_sessionmaker(app_engine, expire_on_commit=False)


@contextmanager
def sync_session_maker() -> Generator[AsyncSession]:
    """Context manager synchrone pour les tâches Celery (rôle privilégié sgi_user).

    Chaque appel ouvre son PROPRE event loop ET son PROPRE engine `NullPool` :
    les connexions asyncpg sont créées et fermées dans ce loop, jamais reprises
    d'un pool partagé lié à un autre loop. Cela élimine l'erreur asyncpg
    « <Future> attached to a different loop » lorsqu'un worker Celery réutilise
    le process pour des tâches successives.

    On n'utilise donc PAS l'`async_session_maker` global (engine + pool partagés).

    Usage :
        with sync_session_maker() as db:
            db.execute(...)   # ← wrappé via run_until_complete
    """
    import asyncio

    from sqlalchemy.pool import NullPool

    class _SyncProxy:
        """Proxy qui exécute chaque méthode async via le loop dédié."""
        def __init__(self):
            self._session = None
            self._engine = None
            self._loop = asyncio.new_event_loop()

        def _run(self, coro):
            return self._loop.run_until_complete(coro)

        def __enter__(self):
            # Engine éphémère NullPool — connexions liées à CE loop uniquement.
            self._engine = create_async_engine(
                settings.DATABASE_URL, poolclass=NullPool
            )
            self._session = AsyncSession(self._engine, expire_on_commit=False)
            self._run(self._session.__aenter__())
            return self

        def execute(self, stmt, *args, **kwargs):
            return self._run(self._session.execute(stmt, *args, **kwargs))

        def add(self, obj):
            self._session.add(obj)

        def commit(self):
            self._run(self._session.commit())

        def rollback(self):
            self._run(self._session.rollback())

        def __exit__(self, *exc):
            try:
                self._run(self._session.__aexit__(*exc))
            finally:
                # Libère les connexions de CE loop avant de le fermer.
                self._run(self._engine.dispose())
                self._loop.close()

    proxy = _SyncProxy()
    with proxy as p:
        yield p


async def create_db_pool() -> None:
    async with engine.begin():
        pass


async def get_db() -> AsyncSession:
    """Session API — rôle restreint sgi_app (RLS appliquée), connexion épinglée.

    La session est liée à UNE connexion physique pour toute la requête : le GUC
    tenant posé au niveau session (cf. get_db_session) survit ainsi aux commits
    des services (commit puis refresh), au lieu d'être perdu si la session
    reprenait une autre connexion du pool après commit.
    """
    async with app_engine.connect() as conn:
        async with AsyncSession(bind=conn, expire_on_commit=False) as session:
            yield session
