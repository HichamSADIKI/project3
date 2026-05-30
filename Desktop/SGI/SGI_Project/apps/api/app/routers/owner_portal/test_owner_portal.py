"""Tests Owner Portal — /api/v1/owner.

Le propriétaire se connecte avec role=client et est lié à une fiche `clients`
par email (find_linked_client_id). Ces tests couvrent : gardes de rôle/auth,
le cas "propriétaire non lié" (réponses vides), les listes (biens, revenus,
relevés, notifications) pour un propriétaire lié, et les protections anti-BOLA
intra-tenant (relevé / notification / devis d'un autre propriétaire → 404).

⚠️ Tests d'intégration : requièrent PostgreSQL via `DATABASE_URL` du conteneur.
Lancer avec : `docker compose exec api uv run pytest app/routers/owner_portal/test_owner_portal.py`.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import encode_jwt, hash_password
from app.models.building import Building
from app.models.client import Client
from app.models.company import Company
from app.models.notification import Notification
from app.models.owner_statement import OwnerStatement
from app.models.party_owner import Owner
from app.models.payment import PaymentRequest
from app.models.user import User, UserRole, UserStatus

pytestmark = pytest.mark.asyncio


# ── Helpers de seeding ───────────────────────────────────────────────────────


async def _make_user(
    db: AsyncSession, company: Company, role: str, email: str | None = None
) -> tuple[User, str]:
    email = email or f"{role}-{uuid.uuid4().hex[:8]}@sgi.test"
    user = User(
        id=uuid.uuid4(),
        company_id=company.id,
        email=email,
        hashed_password=hash_password("Passw0rd!23"),
        full_name=f"Test {role}",
        role=role,
        status=UserStatus.ACTIVE.value,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
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


async def _make_client(db: AsyncSession, company: Company, email: str) -> Client:
    client = Client(
        id=uuid.uuid4(),
        company_id=company.id,
        type="individual",
        first_name="Owner",
        last_name="Person",
        email=email,
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


async def _make_owner_profile(db: AsyncSession, company: Company, party_id: uuid.UUID) -> Owner:
    owner = Owner(party_id=party_id, company_id=company.id, residency_uae=True)
    db.add(owner)
    await db.commit()
    return owner


async def _make_building(
    db: AsyncSession, company: Company, owner_party_id: uuid.UUID, name_en: str
) -> Building:
    b = Building(
        id=uuid.uuid4(),
        company_id=company.id,
        reference=f"BLD-{uuid.uuid4().hex[:10]}",
        building_type="residential_tower",
        owner_party_id=owner_party_id,
        name_en=name_en,
    )
    db.add(b)
    await db.commit()
    await db.refresh(b)
    return b


async def _make_payment_request(
    db: AsyncSession,
    company: Company,
    owner_client_id: uuid.UUID,
    status: str,
    amount: str,
) -> PaymentRequest:
    pr = PaymentRequest(
        id=uuid.uuid4(),
        company_id=company.id,
        reference=f"PAY-{uuid.uuid4().hex[:10]}",
        owner_client_id=owner_client_id,
        payment_type="rent",
        status=status,
        amount_aed=Decimal(amount),
        due_date=date(2026, 5, 1),
    )
    db.add(pr)
    await db.commit()
    await db.refresh(pr)
    return pr


async def _make_statement(
    db: AsyncSession,
    company: Company,
    owner_party_id: uuid.UUID,
    month: int,
    net: str,
) -> OwnerStatement:
    st = OwnerStatement(
        id=uuid.uuid4(),
        company_id=company.id,
        owner_party_id=owner_party_id,
        period_year=2026,
        period_month=month,
        gross_revenue_aed=Decimal("10000"),
        expenses_aed=Decimal("1000"),
        commission_aed=Decimal("500"),
        net_payout_aed=Decimal(net),
        line_items=[{"label": "loyer", "amount": "10000"}],
        generated_at=datetime.now(timezone.utc),
    )
    db.add(st)
    await db.commit()
    await db.refresh(st)
    return st


async def _make_notification(
    db: AsyncSession,
    company: Company,
    recipient_party_id: uuid.UUID,
    status: str = "sent",
) -> Notification:
    n = Notification(
        id=uuid.uuid4(),
        company_id=company.id,
        recipient_party_id=recipient_party_id,
        type="statement_ready",
        title="Relevé disponible",
        body="Votre relevé mensuel est prêt.",
        status=status,
        sent_at=datetime.now(timezone.utc),
    )
    db.add(n)
    await db.commit()
    await db.refresh(n)
    return n


async def _linked_owner(
    db: AsyncSession, company: Company, *, with_profile: bool = False
) -> tuple[Client, str]:
    """Crée un user role=client + sa fiche Client (même email) → lien owner.
    Si `with_profile`, ajoute la ligne `owners` (requise pour Buildings/Statements)."""
    email = f"owner-{uuid.uuid4().hex[:8]}@sgi.test"
    _, token = await _make_user(db, company, UserRole.CLIENT.value, email=email)
    client = await _make_client(db, company, email)
    if with_profile:
        await _make_owner_profile(db, company, client.id)
    return client, token


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ── Gardes auth / rôle ───────────────────────────────────────────────────────


async def test_owner_requires_authentication(client: AsyncClient) -> None:
    """Sans JWT, la garde de rôle refuse l'accès (403)."""
    resp = await client.get("/api/v1/owner/dashboard")
    assert resp.status_code == 403


async def test_fournisseur_role_forbidden(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    _, token = await _make_user(db_session, seed_company, UserRole.PARTNER.value)
    resp = await client.get("/api/v1/owner/dashboard", headers=_auth(token))
    assert resp.status_code == 403


# ── Propriétaire non lié → réponses vides ────────────────────────────────────


async def test_dashboard_unlinked_returns_zeros(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    """Un user role=client sans fiche Client correspondante → dashboard à zéro."""
    _, token = await _make_user(db_session, seed_company, UserRole.CLIENT.value)
    resp = await client.get("/api/v1/owner/dashboard", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["properties_count"] == 0
    assert body["total_received_aed"] == 0


@pytest.mark.parametrize("path", ["properties", "revenues", "statements", "notifications"])
async def test_list_endpoints_unlinked_empty(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession, path: str
) -> None:
    _, token = await _make_user(db_session, seed_company, UserRole.CLIENT.value)
    resp = await client.get(f"/api/v1/owner/{path}", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json() == []


# ── Propriétaire lié → biens / revenus ───────────────────────────────────────


async def test_properties_lists_owned_buildings(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    owner, token = await _linked_owner(db_session, seed_company, with_profile=True)
    await _make_building(db_session, seed_company, owner.id, "Marina Tower")
    await _make_building(db_session, seed_company, owner.id, "Downtown Tower")

    resp = await client.get("/api/v1/owner/properties", headers=_auth(token))
    assert resp.status_code == 200
    names = {b["name"] for b in resp.json()}
    assert names == {"Marina Tower", "Downtown Tower"}


async def test_dashboard_counts_properties(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    owner, token = await _linked_owner(db_session, seed_company, with_profile=True)
    await _make_building(db_session, seed_company, owner.id, "Solo Tower")

    resp = await client.get("/api/v1/owner/dashboard", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["properties_count"] == 1


async def test_revenues_list_and_status_filter(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    owner, token = await _linked_owner(db_session, seed_company)
    await _make_payment_request(db_session, seed_company, owner.id, "paid", "5000")
    await _make_payment_request(db_session, seed_company, owner.id, "pending", "3000")

    all_resp = await client.get("/api/v1/owner/revenues", headers=_auth(token))
    assert all_resp.status_code == 200
    assert len(all_resp.json()) == 2

    paid_resp = await client.get(
        "/api/v1/owner/revenues", params={"status": "paid"}, headers=_auth(token)
    )
    assert paid_resp.status_code == 200
    paid = paid_resp.json()
    assert len(paid) == 1 and paid[0]["status"] == "paid"


# ── Relevés mensuels + anti-BOLA ─────────────────────────────────────────────


async def test_statements_list_and_detail(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    owner, token = await _linked_owner(db_session, seed_company, with_profile=True)
    st = await _make_statement(db_session, seed_company, owner.id, 4, "8500")

    listed = await client.get("/api/v1/owner/statements", headers=_auth(token))
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    detail = await client.get(
        f"/api/v1/owner/statements/{st.id}", headers=_auth(token)
    )
    assert detail.status_code == 200
    body = detail.json()
    assert body["net_payout_aed"] == "8500.00"
    assert body["line_items"] == [{"label": "loyer", "amount": "10000"}]


async def test_statement_detail_other_owner_is_404(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    """Un propriétaire ne peut pas lire le relevé d'un autre (BOLA intra-tenant)."""
    _victim, _ = await _linked_owner(db_session, seed_company, with_profile=True)
    victim_client = await _make_client(
        db_session, seed_company, f"victim-{uuid.uuid4().hex[:8]}@sgi.test"
    )
    await _make_owner_profile(db_session, seed_company, victim_client.id)
    other_st = await _make_statement(db_session, seed_company, victim_client.id, 7, "9999")

    _attacker, token = await _linked_owner(db_session, seed_company, with_profile=True)
    resp = await client.get(
        f"/api/v1/owner/statements/{other_st.id}", headers=_auth(token)
    )
    assert resp.status_code == 404


# ── Notifications + anti-BOLA ────────────────────────────────────────────────


async def test_notifications_list(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    owner, token = await _linked_owner(db_session, seed_company)
    await _make_notification(db_session, seed_company, owner.id)

    resp = await client.get("/api/v1/owner/notifications", headers=_auth(token))
    assert resp.status_code == 200
    notifs = resp.json()
    assert len(notifs) == 1
    assert notifs[0]["type"] == "statement_ready"


async def test_notification_mark_read(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    owner, token = await _linked_owner(db_session, seed_company)
    notif = await _make_notification(db_session, seed_company, owner.id)

    resp = await client.post(
        f"/api/v1/owner/notifications/{notif.id}/read", headers=_auth(token)
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "read"


async def test_notification_read_other_owner_is_404(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    victim = await _make_client(
        db_session, seed_company, f"victim-{uuid.uuid4().hex[:8]}@sgi.test"
    )
    other_notif = await _make_notification(db_session, seed_company, victim.id)

    _attacker, token = await _linked_owner(db_session, seed_company)
    resp = await client.post(
        f"/api/v1/owner/notifications/{other_notif.id}/read", headers=_auth(token)
    )
    assert resp.status_code == 404


# ── Approbation de dépense (devis non possédé) ───────────────────────────────


@pytest.mark.parametrize("action", ["approve", "reject"])
async def test_expense_action_on_unknown_quote_is_404(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession, action: str
) -> None:
    """Un devis inconnu / non rattaché à un bien du propriétaire → 404 (anti-BOLA)."""
    _owner, token = await _linked_owner(db_session, seed_company, with_profile=True)
    resp = await client.post(
        f"/api/v1/owner/expenses/{uuid.uuid4()}/{action}", headers=_auth(token)
    )
    assert resp.status_code == 404
