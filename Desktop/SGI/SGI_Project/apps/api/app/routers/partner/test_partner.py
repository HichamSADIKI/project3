"""Tests Phase 1 — espace Partenaire.

Couvre :
- GET  /partner/dashboard         → 200 + stats à zéro
- POST /partner/submissions       → 201
- GET  /partner/submissions       → 200
- POST /partner/leads             → 201
- GET  /partner/leads             → 200
- GET  /partner/commissions       → 200 + []
- POST /partner/services          → 201
- PATCH /partner/services/{id}    → 200
- Un user role=client est refusé sur /partner/* → 403
"""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import encode_jwt, hash_password
from app.models.company import Company
from app.models.user import User, UserRole, UserStatus

pytestmark = pytest.mark.asyncio


async def _make_partner_user(
    db_session: AsyncSession, company: Company
) -> tuple[User, str]:
    user = User(
        id=uuid.uuid4(),
        company_id=company.id,
        email=f"partner-{uuid.uuid4().hex[:8]}@sgi.test",
        hashed_password=hash_password("PartnerPass!23"),
        full_name="Test Partner",
        role=UserRole.PARTNER.value,
        status=UserStatus.ACTIVE.value,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    token = encode_jwt(
        {
            "sub": str(user.id),
            "company_id": str(user.company_id),
            "role": user.role,
            "status": user.status,
            "email": user.email,
        }
    )
    return user, token


async def _make_client_user(
    db_session: AsyncSession, company: Company
) -> tuple[User, str]:
    user = User(
        id=uuid.uuid4(),
        company_id=company.id,
        email=f"cli-{uuid.uuid4().hex[:8]}@sgi.test",
        hashed_password=hash_password("ClientPass!23"),
        full_name="Test Client",
        role=UserRole.CLIENT.value,
        status=UserStatus.ACTIVE.value,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    token = encode_jwt(
        {
            "sub": str(user.id),
            "company_id": str(user.company_id),
            "role": user.role,
            "status": user.status,
            "email": user.email,
        }
    )
    return user, token


# ── Dashboard ────────────────────────────────────────────────────────────


async def test_partner_dashboard_empty(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    _user, token = await _make_partner_user(db_session, seed_company)
    resp = await client.get(
        "/api/v1/fournisseur/dashboard", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["pending_submissions"] == 0
    assert body["active_leads"] == 0
    assert body["active_services"] == 0
    assert float(body["commissions_pending_aed"]) == 0.0


# ── RBAC ─────────────────────────────────────────────────────────────────


async def test_client_cannot_access_partner_endpoints(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    _user, token = await _make_client_user(db_session, seed_company)
    resp = await client.get(
        "/api/v1/fournisseur/dashboard", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 403


# ── Submissions ──────────────────────────────────────────────────────────


async def test_property_submission_create_and_list(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    _user, token = await _make_partner_user(db_session, seed_company)
    headers = {"Authorization": f"Bearer {token}"}

    r1 = await client.post(
        "/api/v1/fournisseur/submissions",
        json={
            "title": "Marina Tower 3BR",
            "type": "apartment",
            "district": "Dubai Marina",
            "city": "Dubai",
            "asking_price": "2500000.00",
            "area_sqm": "180.50",
            "bedrooms": 3,
            "bathrooms": 2,
            "contact_phone": "+971501234567",
            "images": [],
        },
        headers=headers,
    )
    assert r1.status_code == 201, r1.text
    assert r1.json()["status"] == "pending"

    r2 = await client.get("/api/v1/fournisseur/submissions", headers=headers)
    assert r2.status_code == 200
    assert len(r2.json()) == 1
    assert r2.json()[0]["title"] == "Marina Tower 3BR"


# ── Leads ────────────────────────────────────────────────────────────────


async def test_partner_lead_create_and_list(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    _user, token = await _make_partner_user(db_session, seed_company)
    headers = {"Authorization": f"Bearer {token}"}

    r1 = await client.post(
        "/api/v1/fournisseur/leads",
        json={
            "prospect_first_name": "John",
            "prospect_last_name": "Doe",
            "prospect_email": "john.doe@example.com",
            "prospect_phone": "+971502222333",
            "interest_type": "buy",
            "budget_aed": "3000000.00",
            "notes": "Interested in Palm Jumeirah",
        },
        headers=headers,
    )
    assert r1.status_code == 201, r1.text
    assert r1.json()["status"] == "new"

    r2 = await client.get("/api/v1/fournisseur/leads", headers=headers)
    assert r2.status_code == 200
    assert len(r2.json()) == 1


async def test_partner_lead_rejects_invalid_interest(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    _user, token = await _make_partner_user(db_session, seed_company)
    headers = {"Authorization": f"Bearer {token}"}

    r1 = await client.post(
        "/api/v1/fournisseur/leads",
        json={
            "prospect_first_name": "John",
            "prospect_phone": "+971502222333",
            "interest_type": "INVALID",
        },
        headers=headers,
    )
    assert r1.status_code == 422  # pydantic validation


# ── Commissions ──────────────────────────────────────────────────────────


async def test_commissions_empty_list(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    _user, token = await _make_partner_user(db_session, seed_company)
    resp = await client.get(
        "/api/v1/fournisseur/commissions",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json() == []


# ── Services ─────────────────────────────────────────────────────────────


async def test_service_create_and_update(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    _user, token = await _make_partner_user(db_session, seed_company)
    headers = {"Authorization": f"Bearer {token}"}

    r1 = await client.post(
        "/api/v1/fournisseur/services",
        json={
            "service_type": "notary",
            "title": "Notary services Dubai",
            "description": "Authentication of property contracts",
            "fee_aed": "1500.00",
        },
        headers=headers,
    )
    assert r1.status_code == 201, r1.text
    service_id = r1.json()["id"]
    assert r1.json()["is_active"] is True

    r2 = await client.patch(
        f"/api/v1/fournisseur/services/{service_id}",
        json={"fee_aed": "1800.00", "is_active": False},
        headers=headers,
    )
    assert r2.status_code == 200, r2.text
    assert float(r2.json()["fee_aed"]) == 1800.0
    assert r2.json()["is_active"] is False


async def test_patch_service_not_found(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    _user, token = await _make_partner_user(db_session, seed_company)
    resp = await client.patch(
        f"/api/v1/fournisseur/services/{uuid.uuid4()}",
        json={"title": "Updated title"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404
