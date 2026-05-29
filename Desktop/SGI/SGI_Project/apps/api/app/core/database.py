from contextlib import contextmanager
from typing import Generator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG, pool_pre_ping=True)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)


@contextmanager
def sync_session_maker() -> Generator[AsyncSession, None, None]:
    """Context manager synchrone pour les tâches Celery.

    Exécute une session async dans un event loop dédié (asyncio.run) pour
    rester compatible avec asyncpg (seul driver disponible dans l'image).
    Usage :
        with sync_session_maker() as db:
            db.execute(...)   # ← wrappé via asyncio.run
    """
    import asyncio

    class _SyncProxy:
        """Proxy qui exécute chaque méthode async via asyncio.run."""
        def __init__(self):
            self._session = None
            self._loop = asyncio.new_event_loop()

        def _run(self, coro):
            return self._loop.run_until_complete(coro)

        def __enter__(self):
            self._session = async_session_maker()
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
            self._run(self._session.__aexit__(*exc))
            self._loop.close()

    proxy = _SyncProxy()
    with proxy as p:
        yield p


async def create_db_pool() -> None:
    async with engine.begin():
        pass


async def get_db() -> AsyncSession:
    async with async_session_maker() as session:
        yield session
