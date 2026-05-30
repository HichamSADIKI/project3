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


async def test_register_client_creates_active_account(
    client: AsyncClient, seed_company: Company, unique_email: str
) -> None:
    """Un client s'inscrit `active` : connexion immédiate, pas de validation
    admin (contrairement au fournisseur, qui reste `pending`)."""
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
    assert body["status"] == "active"
    assert body["message"] == "registration_active"


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


async def test_register_rejects_unknown_company(client: AsyncClient, unique_email: str) -> None:
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
    """Un compte en `pending` (fournisseur non validé) ne peut pas se connecter
    — le motif `account_pending` n'est révélé qu'après mot de passe correct."""
    payload = {
        "email": unique_email,
        "password": "VerySecret!23",
        "full_name": "Pending Vendor",
        "company_slug": seed_company.slug,
    }
    r1 = await client.post("/api/v1/auth/register/fournisseur", json=payload)
    assert r1.status_code == 201

    r2 = await client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "VerySecret!23"},
    )
    assert r2.status_code == 403
    assert r2.json()["detail"] == "account_pending"


# ── Validation company_slug au login (nouvelle exigence portal) ─────────────


async def _activate(db_session, email: str) -> None:
    """Helper : passe un compte de `pending` à `active` directement en DB."""
    from sqlalchemy import update

    from app.models.user import User as _User

    await db_session.execute(update(_User).where(_User.email == email).values(status="active"))
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

    # Crée un fournisseur pending (le client, lui, est actif d'emblée)
    r1 = await client.post(
        "/api/v1/auth/register/fournisseur",
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


# ── Inscription fournisseur prestataire unifiée (compte + profil + licence) ──

_FAKE_LICENSE = ("licence.pdf", b"%PDF-1.4\nfake trade licence\n%%EOF", "application/pdf")


async def _query_vendor_by_account(db_session, user_id: str):
    from sqlalchemy import select as _select

    from app.models.party_vendor import Vendor as _Vendor

    return (
        await db_session.execute(
            _select(_Vendor).where(_Vendor.account_user_id == uuid.UUID(user_id))
        )
    ).scalar_one_or_none()


async def test_register_fournisseur_profile_creates_pending_vendor(
    client: AsyncClient,
    seed_company: Company,
    unique_email: str,
    db_session,
) -> None:
    resp = await client.post(
        "/api/v1/auth/register/fournisseur-profile",
        data={
            "email": unique_email,
            "password": "VerySecret!23",
            "full_name": "Cleaning Co LLC",
            "company_slug": seed_company.slug,
            "vendor_type": "cleaning",
            "preferred_language": "fr",
        },
        files={"commercial_license": _FAKE_LICENSE},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["role"] == "fournisseur"
    assert body["status"] == "pending"
    assert body["vendor_type"] == "cleaning"
    assert body["verification_status"] == "pending"
    assert isinstance(body["license_uploaded"], bool)

    # Le profil Vendor a bien été créé, lié au compte, en attente de validation.
    vendor = await _query_vendor_by_account(db_session, body["user_id"])
    assert vendor is not None
    assert vendor.vendor_type == "cleaning"
    assert vendor.verification_status == "pending"
    assert vendor.party_id == uuid.UUID(body["party_id"])


async def test_register_fournisseur_profile_rejects_bad_vendor_type(
    client: AsyncClient, seed_company: Company, unique_email: str
) -> None:
    resp = await client.post(
        "/api/v1/auth/register/fournisseur-profile",
        data={
            "email": unique_email,
            "password": "VerySecret!23",
            "full_name": "Bad Type",
            "company_slug": seed_company.slug,
            "vendor_type": "banking",  # hors VendorType
        },
        files={"commercial_license": _FAKE_LICENSE},
    )
    assert resp.status_code == 422
    assert resp.json()["detail"] == "invalid_vendor_type"


async def test_register_fournisseur_profile_rejects_unsupported_file(
    client: AsyncClient, seed_company: Company, unique_email: str
) -> None:
    resp = await client.post(
        "/api/v1/auth/register/fournisseur-profile",
        data={
            "email": unique_email,
            "password": "VerySecret!23",
            "full_name": "Wrong File",
            "company_slug": seed_company.slug,
            "vendor_type": "cleaning",
        },
        files={"commercial_license": ("notes.txt", b"hello", "text/plain")},
    )
    assert resp.status_code == 422
    assert resp.json()["detail"] == "unsupported_license_type"


async def test_pending_fournisseurs_requires_admin(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/auth/pending-fournisseurs")
    assert resp.status_code == 403


async def test_admin_validation_activates_account_and_vendor(
    client: AsyncClient,
    seed_company: Company,
    seed_admin: tuple[User, str],
    unique_email: str,
    db_session,
) -> None:
    # 1. Le fournisseur s'inscrit avec sa licence.
    r1 = await client.post(
        "/api/v1/auth/register/fournisseur-profile",
        data={
            "email": unique_email,
            "password": "VerySecret!23",
            "full_name": "HVAC Pro LLC",
            "company_slug": seed_company.slug,
            "vendor_type": "hvac",
        },
        files={"commercial_license": _FAKE_LICENSE},
    )
    assert r1.status_code == 201, r1.text
    user_id = r1.json()["user_id"]

    # 2. L'admin le voit dans la file de validation, avec sa catégorie.
    _admin, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    r2 = await client.get("/api/v1/auth/pending-fournisseurs", headers=headers)
    assert r2.status_code == 200, r2.text
    matched = [f for f in r2.json() if f["user_id"] == user_id]
    assert matched and matched[0]["vendor_type"] == "hvac"
    assert matched[0]["verification_status"] == "pending"

    # 3. L'admin approuve → compte actif ET profil prestataire vérifié.
    r3 = await client.post(
        f"/api/v1/auth/pending-users/{user_id}/decision",
        json={"approve": True},
        headers=headers,
    )
    assert r3.status_code == 200, r3.text
    assert r3.json()["status"] == "active"

    vendor = await _query_vendor_by_account(db_session, user_id)
    assert vendor is not None
    assert vendor.verification_status == "verified"
    assert vendor.verified_at is not None


async def test_admin_rejection_marks_vendor_rejected(
    client: AsyncClient,
    seed_company: Company,
    seed_admin: tuple[User, str],
    unique_email: str,
    db_session,
) -> None:
    r1 = await client.post(
        "/api/v1/auth/register/fournisseur-profile",
        data={
            "email": unique_email,
            "password": "VerySecret!23",
            "full_name": "Dodgy Vendor",
            "company_slug": seed_company.slug,
            "vendor_type": "other",
        },
        files={"commercial_license": _FAKE_LICENSE},
    )
    user_id = r1.json()["user_id"]

    _admin, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    r2 = await client.post(
        f"/api/v1/auth/pending-users/{user_id}/decision",
        json={"approve": False, "reason": "licence illisible"},
        headers=headers,
    )
    assert r2.status_code == 200
    assert r2.json()["status"] == "rejected"

    vendor = await _query_vendor_by_account(db_session, user_id)
    assert vendor is not None
    assert vendor.verification_status == "rejected"
    assert vendor.rejection_reason == "licence illisible"
