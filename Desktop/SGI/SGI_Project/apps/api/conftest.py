"""Fixtures pytest partagées pour les tests API SGI.

- `db_session` : session SQLAlchemy isolée par test (NullPool pour éviter les
  problèmes d'event loop avec pytest-asyncio).
- `client` : httpx.AsyncClient pointant sur l'app FastAPI avec la session injectée.
- `seed_company` : crée une Company de test (slug unique par test).
- `seed_admin` : crée un admin actif (pour tester les endpoints protégés).
- `unique_email` : génère un email unique par test pour éviter les collisions.

⚠️ Tests d'intégration : requièrent PostgreSQL via `DATABASE_URL` du conteneur.
Lancer avec : `docker compose exec api uv run pytest`.
"""
from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.auth import encode_jwt, hash_password
from app.core.config import settings
from app.core.database import get_db
from app.main import app
from app.models.company import Company
from app.models.user import User, UserRole, UserStatus


# Engine de test avec NullPool — évite les "Future attached to a different loop"
# quand pytest-asyncio recrée un event loop par test.
_test_engine = create_async_engine(
    settings.DATABASE_URL, echo=False, poolclass=NullPool
)
_test_session_maker = async_sessionmaker(_test_engine, expire_on_commit=False)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Session SQLAlchemy ouverte sur une connexion fraîche (NullPool)."""
    async with _test_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Client HTTP avec la session de test injectée dans la dépendance get_db."""

    async def _override_get_db():
        # On crée une session fraîche pour chaque requête HTTP (comportement
        # FastAPI normal). NullPool garantit la propreté du loop.
        async with _test_session_maker() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def seed_company(db_session: AsyncSession) -> Company:
    """Crée une Company de test ; slug unique → pas de collisions inter-tests."""
    company = Company(
        id=uuid.uuid4(),
        name="Infinity Test",
        slug=f"test-co-{uuid.uuid4().hex[:8]}",
        plan="pro",
        is_active=True,
    )
    db_session.add(company)
    await db_session.commit()
    await db_session.refresh(company)
    return company


@pytest_asyncio.fixture
async def seed_admin(db_session: AsyncSession, seed_company: Company) -> tuple[User, str]:
    """Admin actif + son JWT (pour appeler les endpoints protégés)."""
    admin = User(
        id=uuid.uuid4(),
        company_id=seed_company.id,
        email=f"admin-{uuid.uuid4().hex[:8]}@sgi.test",
        hashed_password=hash_password("AdminPass!23"),
        full_name="Test Admin",
        role=UserRole.ADMIN.value,
        status=UserStatus.ACTIVE.value,
        is_active=True,
    )
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)
    token = encode_jwt(
        {
            "sub": str(admin.id),
            "company_id": str(admin.company_id),
            "role": admin.role,
            "status": admin.status,
            "email": admin.email,
        }
    )
    return admin, token


@pytest_asyncio.fixture
def unique_email() -> str:
    """Email unique par test pour éviter les collisions (les tests committent)."""
    return f"user-{uuid.uuid4().hex[:10]}@example.com"
