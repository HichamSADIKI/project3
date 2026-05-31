"""Tests d'isolation RLS (C1) — vérifient que le rôle applicatif restreint
`sgi_app` ne peut JAMAIS voir/modifier les données d'une autre société.

Ces tests se connectent réellement via APP_DATABASE_URL (rôle sgi_app). Ils
sont ignorés (skip) si APP_DB_PASSWORD n'est pas configuré (RLS non activée —
APP_DATABASE_URL retombe alors sur le rôle privilégié).

Lancer : docker compose exec api uv run pytest app/core/test_rls_isolation.py
"""

import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.models.company import Company
from app.models.property import Property


def _app_engine():
    """Engine restreint (sgi_app) avec NullPool — évite les soucis d'event loop
    pytest-asyncio (même raison que conftest._test_engine)."""
    return create_async_engine(settings.APP_DATABASE_URL, poolclass=NullPool)


pytestmark = pytest.mark.skipif(
    not settings.APP_DB_PASSWORD or settings.APP_DATABASE_URL == settings.DATABASE_URL,
    reason="Rôle applicatif restreint (APP_DB_PASSWORD) non configuré — RLS non testable.",
)


async def _seed_two_companies(db_session) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    """Crée 2 sociétés + 1 bien chacune (via le rôle privilégié). Retourne (A, B, bien_B)."""
    a, b = uuid.uuid4(), uuid.uuid4()
    pa, pb = uuid.uuid4(), uuid.uuid4()
    db_session.add_all(
        [
            Company(id=a, name="Soc A", slug=f"a-{a.hex[:8]}", plan="pro", is_active=True),
            Company(id=b, name="Soc B", slug=f"b-{b.hex[:8]}", plan="pro", is_active=True),
            Property(
                id=pa,
                company_id=a,
                reference=f"RLST-A-{pa.hex[:10]}",
                type="apartment",
                price=1,
                status="available",
            ),
            Property(
                id=pb,
                company_id=b,
                reference=f"RLST-B-{pb.hex[:10]}",
                type="villa",
                price=2,
                status="available",
            ),
        ]
    )
    await db_session.commit()
    return a, b, pb


@pytest.mark.asyncio
async def test_restricted_role_cannot_read_other_tenant(db_session):
    """Contexte société A → le bien de B est invisible (0 ligne)."""
    a, b, pb = await _seed_two_companies(db_session)
    app_engine = _app_engine()
    try:
        async with app_engine.connect() as conn:
            await conn.execute(
                text("SELECT set_config('app.current_company_id', :c, false)"), {"c": str(a)}
            )
            # Le bien de B ne doit pas être visible depuis le contexte A.
            visible_b = await conn.scalar(
                text("SELECT count(*) FROM properties WHERE id = :pid"), {"pid": str(pb)}
            )
            assert visible_b == 0
            # Seuls les biens de A sont visibles.
            other = await conn.scalar(
                text(
                    "SELECT count(*) FROM properties WHERE company_id <> :a AND deleted_at IS NULL"
                ),
                {"a": str(a)},
            )
            assert other == 0
    finally:
        await app_engine.dispose()


@pytest.mark.asyncio
async def test_restricted_role_cannot_insert_for_other_tenant(db_session):
    """INSERT d'un bien pour la société B depuis le contexte A → bloqué (WITH CHECK)."""
    a, b, _ = await _seed_two_companies(db_session)
    app_engine = _app_engine()
    try:
        async with app_engine.connect() as conn:
            await conn.execute(
                text("SELECT set_config('app.current_company_id', :c, false)"), {"c": str(a)}
            )
            with pytest.raises(Exception):  # row-level security policy violation
                await conn.execute(
                    text(
                        "INSERT INTO properties (id, company_id, reference, type, price, status) "
                        "VALUES (gen_random_uuid(), :b, :ref, 'plot', 1, 'available')"
                    ),
                    {"b": str(b), "ref": f"HACK-{uuid.uuid4().hex[:8]}"},
                )
                await conn.commit()
    finally:
        await app_engine.dispose()


@pytest.mark.asyncio
async def test_restricted_role_requires_tenant_context(db_session):
    """Sans contexte tenant, la RLS bloque l'accès (policy évaluée → erreur/0)."""
    await _seed_two_companies(db_session)
    app_engine = _app_engine()
    try:
        async with app_engine.connect() as conn:
            with pytest.raises(Exception):
                await conn.execute(text("SELECT count(*) FROM properties"))
    finally:
        await app_engine.dispose()
