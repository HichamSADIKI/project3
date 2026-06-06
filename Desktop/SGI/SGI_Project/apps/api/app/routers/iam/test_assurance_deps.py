"""Tests — step-up par niveau d'assurance (Brique 3a, DB)."""

from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.routers.iam.assurance_deps import assert_assurance, current_assurance_level
from app.routers.iam.assurance_service import upsert_verification


@pytest.mark.asyncio
async def test_current_level_l0_when_absent(
    db_session: AsyncSession, seed_company: Company
) -> None:
    level = await current_assurance_level(db_session, seed_company.id, uuid.uuid4())
    assert level == "L0"


@pytest.mark.asyncio
async def test_current_level_reflects_record(
    db_session: AsyncSession, seed_company: Company
) -> None:
    uid = uuid.uuid4()
    await upsert_verification(
        db_session,
        seed_company.id,
        "user",
        uid,
        email_verified=True,
        mobile_verified=True,
        emirates_id_verified=True,
    )
    assert await current_assurance_level(db_session, seed_company.id, uid) == "L2"


@pytest.mark.asyncio
async def test_assert_assurance_blocks_below_threshold(
    db_session: AsyncSession, seed_company: Company
) -> None:
    uid = uuid.uuid4()
    # L1 seulement (email + mobile) → ne peut pas signer (L2 requis).
    await upsert_verification(
        db_session, seed_company.id, "user", uid, email_verified=True, mobile_verified=True
    )
    with pytest.raises(HTTPException) as exc:
        await assert_assurance(db_session, seed_company.id, uid, "sign_document")
    assert exc.value.status_code == 403
    assert exc.value.detail["error"] == "assurance_step_up_required"
    assert exc.value.detail["required_level"] == "L2"
    assert exc.value.detail["current_level"] == "L1"


@pytest.mark.asyncio
async def test_assert_assurance_passes_when_sufficient(
    db_session: AsyncSession, seed_company: Company
) -> None:
    uid = uuid.uuid4()
    await upsert_verification(
        db_session,
        seed_company.id,
        "user",
        uid,
        email_verified=True,
        mobile_verified=True,
        emirates_id_verified=True,
    )
    level = await assert_assurance(db_session, seed_company.id, uid, "sign_document")
    assert level == "L2"


@pytest.mark.asyncio
async def test_assert_assurance_qualified_needs_l3(
    db_session: AsyncSession, seed_company: Company
) -> None:
    uid = uuid.uuid4()
    await upsert_verification(
        db_session,
        seed_company.id,
        "user",
        uid,
        email_verified=True,
        mobile_verified=True,
        emirates_id_verified=True,
    )  # L2 → ne suffit pas pour une action L3
    with pytest.raises(HTTPException) as exc:
        await assert_assurance(db_session, seed_company.id, uid, "approve_payment")
    assert exc.value.detail["required_level"] == "L3"
