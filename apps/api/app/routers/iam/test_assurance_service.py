"""Tests — persistance des niveaux d'assurance (Brique 2, DB).

Requièrent PostgreSQL — lancer via : docker compose exec api uv run pytest.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.routers.iam.assurance_service import (
    get_assurance,
    is_valid_subject_type,
    upsert_verification,
)


def test_is_valid_subject_type() -> None:
    assert is_valid_subject_type("user") is True
    assert is_valid_subject_type("client") is True
    assert is_valid_subject_type("bogus") is False


@pytest.mark.asyncio
async def test_first_proof_creates_record(db_session: AsyncSession, seed_company: Company) -> None:
    sid = uuid.uuid4()
    rec = await upsert_verification(
        db_session, seed_company.id, "client", sid, email_verified=True, mobile_verified=True
    )
    assert rec.level == "L1"
    assert rec.email_verified is True
    assert rec.emirates_id_verified is False


@pytest.mark.asyncio
async def test_progressive_level_up(db_session: AsyncSession, seed_company: Company) -> None:
    sid = uuid.uuid4()
    # L1
    await upsert_verification(
        db_session, seed_company.id, "client", sid, email_verified=True, mobile_verified=True
    )
    # + Emirates ID → L2
    rec = await upsert_verification(
        db_session, seed_company.id, "client", sid, emirates_id_verified=True
    )
    assert rec.level == "L2"
    # + contrôle renforcé → L3 (les drapeaux précédents sont conservés)
    rec = await upsert_verification(
        db_session, seed_company.id, "client", sid, strong_auth_verified=True
    )
    assert rec.level == "L3"
    assert rec.email_verified is True and rec.mobile_verified is True


@pytest.mark.asyncio
async def test_partial_update_keeps_other_flags(
    db_session: AsyncSession, seed_company: Company
) -> None:
    sid = uuid.uuid4()
    await upsert_verification(
        db_session,
        seed_company.id,
        "user",
        sid,
        email_verified=True,
        mobile_verified=True,
        emirates_id_verified=True,
    )
    # On ne touche QUE le mobile (retrait) → recalcul : retombe à L0.
    rec = await upsert_verification(db_session, seed_company.id, "user", sid, mobile_verified=False)
    assert rec.email_verified is True  # inchangé
    assert rec.emirates_id_verified is True  # inchangé
    assert rec.level == "L0"  # email seul + eid mais sans mobile → L0


@pytest.mark.asyncio
async def test_get_assurance_tenant_isolation(
    db_session: AsyncSession, seed_company: Company
) -> None:
    sid = uuid.uuid4()
    await upsert_verification(
        db_session, seed_company.id, "client", sid, email_verified=True, mobile_verified=True
    )
    other = Company(
        id=uuid.uuid4(), name="Autre", slug=f"co-{uuid.uuid4().hex[:8]}", plan="pro", is_active=True
    )
    db_session.add(other)
    await db_session.commit()
    # Même subject_id, autre société → invisible (Loi 1).
    assert await get_assurance(db_session, other.id, "client", sid) is None
    assert await get_assurance(db_session, seed_company.id, "client", sid) is not None
