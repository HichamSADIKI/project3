"""Tests — synchronisation portal ↔ back-office via /client/me/profile.

Couvre :
- POST /auth/register/client       → crée aussi une fiche Client CRM (eager link)
- GET  /client/me/profile          → renvoie la fiche du client connecté
- PATCH /client/me/profile         → modifie les champs whitelistés
- Après PATCH, GET /clients/{id} côté admin reflète la modif (sync portal → back-office)
- Un user role=agent ne peut pas accéder à /me/profile (RBAC)
- GET /me/profile crée la fiche à la volée si elle manque (filet de sécurité)
"""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import encode_jwt, hash_password
from app.models.client import Client
from app.models.company import Company
from app.models.user import User, UserRole, UserStatus

pytestmark = pytest.mark.asyncio


async def _client_token(user: User) -> str:
    return encode_jwt(
        {
            "sub": str(user.id),
            "company_id": str(user.company_id),
            "role": user.role,
            "status": user.status,
            "email": user.email,
        }
    )


async def _make_client_user(
    db_session: AsyncSession, company: Company, *, email: str | None = None
) -> User:
    user = User(
        id=uuid.uuid4(),
        company_id=company.id,
        email=email or f"client-{uuid.uuid4().hex[:8]}@sgi.test",
        hashed_password=hash_password("ClientPass!23"),
        full_name="Marie Dupont",
        role=UserRole.CLIENT.value,
        status=UserStatus.ACTIVE.value,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


# ── Sync à l'inscription ─────────────────────────────────────────────────


async def test_register_client_creates_crm_client(
    client: AsyncClient,
    seed_company: Company,
    db_session: AsyncSession,
    unique_email: str,
) -> None:
    """Un POST /auth/register/client doit créer la fiche Client CRM en même
    temps que le User — pour qu'elle soit visible dans le back-office dès la
    soumission du formulaire d'inscription."""
    payload = {
        "email": unique_email,
        "password": "StrongPass!23",
        "full_name": "Alice Martin",
        "company_slug": seed_company.slug,
        "preferred_language": "fr",
    }
    resp = await client.post("/api/v1/auth/register/client", json=payload)
    assert resp.status_code == 201, resp.text

    # La fiche Client doit exister immédiatement, par email + tenant
    result = await db_session.execute(
        select(Client).where(
            Client.email == unique_email,
            Client.company_id == seed_company.id,
            Client.deleted_at.is_(None),
        )
    )
    crm_client = result.scalar_one_or_none()
    assert crm_client is not None
    assert crm_client.type == "individual"
    assert crm_client.first_name == "Alice"
    assert crm_client.last_name == "Martin"
    assert crm_client.source == "portal"


# ── /me/profile : GET ────────────────────────────────────────────────────


async def test_get_me_profile_returns_linked_client(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    user = await _make_client_user(db_session, seed_company)
    # Pré-crée la fiche Client (cas standard : user inscrit via le portail)
    crm = Client(
        id=uuid.uuid4(),
        company_id=seed_company.id,
        type="individual",
        first_name="Marie",
        last_name="Dupont",
        email=user.email,
        phone="+971501234567",
        source="portal",
    )
    db_session.add(crm)
    await db_session.commit()

    token = await _client_token(user)
    resp = await client.get(
        "/api/v1/client/me/profile",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["email"] == user.email
    assert body["first_name"] == "Marie"
    assert body["last_name"] == "Dupont"
    assert body["phone"] == "+971501234567"


async def test_get_me_profile_creates_client_on_the_fly(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    """Filet de sécurité : un user role=client sans fiche CRM doit voir une
    fiche créée automatiquement à la première visite du profil (legacy users)."""
    user = await _make_client_user(db_session, seed_company)
    token = await _client_token(user)

    resp = await client.get(
        "/api/v1/client/me/profile",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["email"] == user.email
    assert body["type"] == "individual"
    # first_name vient du parsing du full_name "Marie Dupont"
    assert body["first_name"] == "Marie"


# ── /me/profile : PATCH + sync vers /clients/{id} ────────────────────────


async def test_patch_me_profile_syncs_to_backoffice_db(
    client: AsyncClient,
    seed_company: Company,
    db_session: AsyncSession,
) -> None:
    """Cœur de la fonctionnalité : un PATCH du portail écrit immédiatement
    dans la table `clients` (la même que celle lue par le back-office). On
    vérifie via lecture directe en base : pas de mémoire intermédiaire, pas
    de cache — la sync est garantie par l'unicité de la source de vérité."""
    user = await _make_client_user(db_session, seed_company)
    token = await _client_token(user)

    # 1) Portal récupère son profil (création à la volée)
    r_get = await client.get(
        "/api/v1/client/me/profile",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r_get.status_code == 200
    client_id = uuid.UUID(r_get.json()["id"])

    # 2) Portal patch ses infos
    r_patch = await client.patch(
        "/api/v1/client/me/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "phone": "+971555000111",
            "nationality": "French",
            "country_of_residence": "United Arab Emirates",
            "budget_min": 1500000,
            "budget_max": 3000000,
            "preferred_location": "Dubai Marina",
            "preferred_property_type": "apartment",
        },
    )
    assert r_patch.status_code == 200, r_patch.text
    assert r_patch.json()["phone"] == "+971555000111"
    assert r_patch.json()["preferred_location"] == "Dubai Marina"

    # 3) Le back-office lit la même table `clients` — vérification directe
    #    sur la ligne stockée, tenant-scoped.
    result = await db_session.execute(
        select(Client).where(
            Client.id == client_id,
            Client.company_id == seed_company.id,
            Client.deleted_at.is_(None),
        )
    )
    stored = result.scalar_one()
    assert stored.phone == "+971555000111"
    assert stored.nationality == "French"
    assert stored.country_of_residence == "United Arab Emirates"
    assert float(stored.budget_min) == 1500000.0
    assert float(stored.budget_max) == 3000000.0
    assert stored.preferred_location == "Dubai Marina"
    assert stored.preferred_property_type == "apartment"


async def test_patch_me_profile_partial_update(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    """Un PATCH partiel ne doit pas écraser les champs non fournis."""
    user = await _make_client_user(db_session, seed_company)
    token = await _client_token(user)

    await client.patch(
        "/api/v1/client/me/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={"phone": "+971500000001", "nationality": "British"},
    )
    r2 = await client.patch(
        "/api/v1/client/me/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={"preferred_location": "Downtown Dubai"},
    )
    assert r2.status_code == 200
    body = r2.json()
    # Champs précédemment patchés préservés
    assert body["phone"] == "+971500000001"
    assert body["nationality"] == "British"
    # Nouveau champ appliqué
    assert body["preferred_location"] == "Downtown Dubai"


# ── RBAC ─────────────────────────────────────────────────────────────────


async def test_agent_cannot_access_me_profile(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    """Le router exige role=client. Un agent doit être refusé en 403."""
    agent = User(
        id=uuid.uuid4(),
        company_id=seed_company.id,
        email=f"agent-{uuid.uuid4().hex[:8]}@sgi.test",
        hashed_password=hash_password("AgentPass!23"),
        full_name="Test Agent",
        role=UserRole.AGENT.value,
        status=UserStatus.ACTIVE.value,
        is_active=True,
    )
    db_session.add(agent)
    await db_session.commit()
    await db_session.refresh(agent)
    token = await _client_token(agent)

    resp = await client.get(
        "/api/v1/client/me/profile",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


async def test_unauthenticated_blocked(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/client/me/profile")
    assert resp.status_code == 403


async def test_patch_me_profile_visible_via_backoffice_clients_endpoint(
    client: AsyncClient,
    seed_company: Company,
    db_session: AsyncSession,
    seed_admin: tuple[User, str],
) -> None:
    """Le scénario complet de l'énoncé : un client modifie son profil sur le
    portal (3001), un admin du back-office (5001) ouvre l'écran clients et
    voit la modification via GET /api/v1/clients/{id} et GET /api/v1/clients/."""
    user = await _make_client_user(db_session, seed_company)
    token = await _client_token(user)
    _admin, admin_token = seed_admin

    # Portal : récupère puis patch
    r_get = await client.get(
        "/api/v1/client/me/profile",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r_get.status_code == 200
    client_id = r_get.json()["id"]

    await client.patch(
        "/api/v1/client/me/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "phone": "+971555444333",
            "preferred_location": "Business Bay",
            "budget_max": 5000000,
        },
    )

    # Back-office : GET /clients/{id}
    r_detail = await client.get(
        f"/api/v1/clients/{client_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r_detail.status_code == 200, r_detail.text
    data = r_detail.json()["data"]
    assert data["phone"] == "+971555444333"
    assert data["preferred_location"] == "Business Bay"
    assert float(data["budget_max"]) == 5000000.0

    # Back-office : GET /clients?type=individual liste bien le client
    r_list = await client.get(
        "/api/v1/clients/?type=individual&limit=100",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r_list.status_code == 200, r_list.text
    listed = [c for c in r_list.json()["data"] if c["id"] == client_id]
    assert len(listed) == 1
    assert listed[0]["phone"] == "+971555444333"
