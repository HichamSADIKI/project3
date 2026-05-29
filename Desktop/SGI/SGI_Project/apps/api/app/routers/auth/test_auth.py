"""Tests Phase 0 — inscription publique Client/Partner + validation admin.

Couvre :
- POST /api/v1/auth/register/client      → 201 + status="pending"
- POST /api/v1/auth/register/fournisseur     → 201 + status="pending"
- POST /api/v1/auth/register/client      → 409 si email déjà utilisé
- POST /api/v1/auth/register/client      → 404 si company_slug inconnu
- POST /api/v1/auth/login                → 401 si status="pending" (compte non validé)
- GET  /api/v1/auth/pending-users        → 403 si non admin/manager
- POST /api/v1/auth/pending-users/.../decision → bascule pending → active
- POST /api/v1/auth/pending-users/.../decision (approve=false) → pending → rejected
"""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from app.models.company import Company
from app.models.user import User


pytestmark = pytest.mark.asyncio


async def test_register_client_creates_pending_account(
    client: AsyncClient, seed_company: Company, unique_email: str
) -> None:
    payload = {
        "email": unique_email,
        "password": "VerySecret!23",
        "full_name": "Alice Client",
        "company_slug": seed_company.slug,
    }
    resp = await client.post("/api/v1/auth/register/client", json=payload)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["email"] == unique_email
    assert body["role"] == "client"
    assert body["status"] == "pending"
    assert body["message"] == "registration_pending_admin_validation"


async def test_register_partner_creates_pending_account(
    client: AsyncClient, seed_company: Company, unique_email: str
) -> None:
    payload = {
        "email": unique_email,
        "password": "VerySecret!23",
        "full_name": "Bob Partner",
        "company_slug": seed_company.slug,
    }
    resp = await client.post("/api/v1/auth/register/fournisseur", json=payload)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["role"] == "fournisseur"
    assert body["status"] == "pending"


async def test_register_rejects_duplicate_email(
    client: AsyncClient, seed_company: Company, unique_email: str
) -> None:
    payload = {
        "email": unique_email,
        "password": "VerySecret!23",
        "full_name": "Dup",
        "company_slug": seed_company.slug,
    }
    r1 = await client.post("/api/v1/auth/register/client", json=payload)
    assert r1.status_code == 201
    r2 = await client.post("/api/v1/auth/register/client", json=payload)
    assert r2.status_code == 409
    assert r2.json()["detail"] == "email_already_registered"


async def test_register_rejects_unknown_company(
    client: AsyncClient, unique_email: str
) -> None:
    payload = {
        "email": unique_email,
        "password": "VerySecret!23",
        "full_name": "Ghost",
        "company_slug": f"does-not-exist-{uuid.uuid4().hex[:6]}",
    }
    resp = await client.post("/api/v1/auth/register/client", json=payload)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "company_not_found"


async def test_login_rejects_pending_account(
    client: AsyncClient, seed_company: Company, unique_email: str
) -> None:
    """Un compte en `pending` ne doit pas pouvoir se connecter."""
    payload = {
        "email": unique_email,
        "password": "VerySecret!23",
        "full_name": "Pending User",
        "company_slug": seed_company.slug,
    }
    r1 = await client.post("/api/v1/auth/register/client", json=payload)
    assert r1.status_code == 201

    r2 = await client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "VerySecret!23"},
    )
    assert r2.status_code == 401
    assert r2.json()["detail"] == "invalid_credentials"


# ── Validation company_slug au login (nouvelle exigence portal) ─────────────


async def _activate(db_session, email: str) -> None:
    """Helper : passe un compte de `pending` à `active` directement en DB."""
    from sqlalchemy import update

    from app.models.user import User as _User

    await db_session.execute(
        update(_User).where(_User.email == email).values(status="active")
    )
    await db_session.commit()


async def test_login_fournisseur_requires_company_slug(
    client: AsyncClient,
    seed_company: Company,
    unique_email: str,
    db_session,
) -> None:
    """Un fournisseur doit fournir company_slug à la connexion (422)."""
    r1 = await client.post(
        "/api/v1/auth/register/fournisseur",
        json={
            "email": unique_email,
            "password": "VerySecret!23",
            "full_name": "Vendor X",
            "company_slug": seed_company.slug,
        },
    )
    assert r1.status_code == 201
    await _activate(db_session, unique_email)

    # Login sans company_slug → 422 company_required
    r2 = await client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "VerySecret!23"},
    )
    assert r2.status_code == 422
    assert r2.json()["detail"] == "company_required"


async def test_login_fournisseur_rejects_wrong_company_slug(
    client: AsyncClient,
    seed_company: Company,
    unique_email: str,
    db_session,
) -> None:
    """Un fournisseur avec un mauvais slug → 422 company_mismatch."""
    r1 = await client.post(
        "/api/v1/auth/register/fournisseur",
        json={
            "email": unique_email,
            "password": "VerySecret!23",
            "full_name": "Vendor Y",
            "company_slug": seed_company.slug,
        },
    )
    assert r1.status_code == 201
    await _activate(db_session, unique_email)

    r2 = await client.post(
        "/api/v1/auth/login",
        json={
            "email": unique_email,
            "password": "VerySecret!23",
            "company_slug": f"wrong-slug-{uuid.uuid4().hex[:6]}",
        },
    )
    assert r2.status_code == 422
    assert r2.json()["detail"] == "company_mismatch"


async def test_login_fournisseur_succeeds_with_correct_slug(
    client: AsyncClient,
    seed_company: Company,
    unique_email: str,
    db_session,
) -> None:
    """Un fournisseur avec le bon slug se connecte → 200."""
    r1 = await client.post(
        "/api/v1/auth/register/fournisseur",
        json={
            "email": unique_email,
            "password": "VerySecret!23",
            "full_name": "Vendor Z",
            "company_slug": seed_company.slug,
        },
    )
    assert r1.status_code == 201
    await _activate(db_session, unique_email)

    r2 = await client.post(
        "/api/v1/auth/login",
        json={
            "email": unique_email,
            "password": "VerySecret!23",
            "company_slug": seed_company.slug,
        },
    )
    assert r2.status_code == 200, r2.text
    assert "access_token" in r2.json()


async def test_login_client_accepts_optional_slug(
    client: AsyncClient,
    seed_company: Company,
    unique_email: str,
    db_session,
) -> None:
    """Un client peut se connecter avec OU sans company_slug ; si fourni, il doit matcher."""
    r1 = await client.post(
        "/api/v1/auth/register/client",
        json={
            "email": unique_email,
            "password": "VerySecret!23",
            "full_name": "Client Q",
            "company_slug": seed_company.slug,
        },
    )
    assert r1.status_code == 201
    await _activate(db_session, unique_email)

    # Sans slug : OK
    r_no_slug = await client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "VerySecret!23"},
    )
    assert r_no_slug.status_code == 200

    # Avec bon slug : OK
    r_ok = await client.post(
        "/api/v1/auth/login",
        json={
            "email": unique_email,
            "password": "VerySecret!23",
            "company_slug": seed_company.slug,
        },
    )
    assert r_ok.status_code == 200

    # Avec mauvais slug : 422 (défense en profondeur)
    r_bad = await client.post(
        "/api/v1/auth/login",
        json={
            "email": unique_email,
            "password": "VerySecret!23",
            "company_slug": "wrong-slug-aaa",
        },
    )
    assert r_bad.status_code == 422
    assert r_bad.json()["detail"] == "company_mismatch"


async def test_pending_users_requires_admin_or_manager(client: AsyncClient) -> None:
    """Sans JWT admin/manager → 403."""
    resp = await client.get("/api/v1/auth/pending-users")
    # Pas de token = pas de rôle = require_roles refuse
    assert resp.status_code == 403


async def test_admin_can_approve_pending_user(
    client: AsyncClient,
    seed_company: Company,
    seed_admin: tuple[User, str],
    unique_email: str,
) -> None:
    _admin, token = seed_admin

    # Crée un client pending
    r1 = await client.post(
        "/api/v1/auth/register/client",
        json={
            "email": unique_email,
            "password": "VerySecret!23",
            "full_name": "To Approve",
            "company_slug": seed_company.slug,
        },
    )
    assert r1.status_code == 201
    new_user_id = r1.json()["user_id"]

    # Admin liste les pending
    headers = {"Authorization": f"Bearer {token}"}
    r2 = await client.get("/api/v1/auth/pending-users", headers=headers)
    assert r2.status_code == 200
    pending_ids = [u["id"] for u in r2.json()]
    assert new_user_id in pending_ids

    # Admin approuve
    r3 = await client.post(
        f"/api/v1/auth/pending-users/{new_user_id}/decision",
        json={"approve": True},
        headers=headers,
    )
    assert r3.status_code == 200, r3.text
    assert r3.json()["status"] == "active"


async def test_admin_can_reject_pending_user(
    client: AsyncClient,
    seed_company: Company,
    seed_admin: tuple[User, str],
    unique_email: str,
) -> None:
    _admin, token = seed_admin
    r1 = await client.post(
        "/api/v1/auth/register/fournisseur",
        json={
            "email": unique_email,
            "password": "VerySecret!23",
            "full_name": "To Reject",
            "company_slug": seed_company.slug,
        },
    )
    new_user_id = r1.json()["user_id"]

    headers = {"Authorization": f"Bearer {token}"}
    r3 = await client.post(
        f"/api/v1/auth/pending-users/{new_user_id}/decision",
        json={"approve": False, "reason": "incomplete docs"},
        headers=headers,
    )
    assert r3.status_code == 200
    assert r3.json()["status"] == "rejected"


async def test_decision_404_on_unknown_user(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.post(
        f"/api/v1/auth/pending-users/{uuid.uuid4()}/decision",
        json={"approve": True},
        headers=headers,
    )
    assert resp.status_code == 404
