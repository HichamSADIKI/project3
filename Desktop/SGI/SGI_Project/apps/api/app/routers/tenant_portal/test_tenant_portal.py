"""Tests Tenant Portal — /api/v1/tenant.

Le locataire se connecte avec role=client, lié à une fiche `clients` par email
(find_linked_client_id). Couverture : gardes auth/rôle, cas "non lié" (réponses
vides), paiement (liste scopée + pay anti-BOLA), tickets (création requester
forcé + liste scopée + détail/commentaire anti-BOLA), chat (conversations du
participant + envoi + non-participant → 404), et isolation multi-tenant (Loi 1).

⚠️ Tests d'intégration : requièrent PostgreSQL via `DATABASE_URL` du conteneur.
Lancer avec : `docker compose exec api uv run pytest app/routers/tenant_portal/test_tenant_portal.py`.
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import encode_jwt, hash_password
from app.models.client import Client
from app.models.company import Company
from app.models.conversation import Conversation, ConversationParticipant
from app.models.payment import PaymentRequest
from app.models.user import User, UserRole, UserStatus
from app.routers.ticketing.models import ServiceTicket

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
        first_name="Tenant",
        last_name="Person",
        email=email,
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


async def _linked_tenant(db: AsyncSession, company: Company) -> tuple[User, Client, str]:
    """Crée un user role=client + sa fiche Client (même email) → lien locataire."""
    email = f"tenant-{uuid.uuid4().hex[:8]}@sgi.test"
    user, token = await _make_user(db, company, UserRole.CLIENT.value, email=email)
    client = await _make_client(db, company, email)
    return user, client, token


async def _make_payment_request(
    db: AsyncSession,
    company: Company,
    tenant_client_id: uuid.UUID,
    status: str,
    amount: str,
    due: date = date(2026, 5, 1),
) -> PaymentRequest:
    pr = PaymentRequest(
        id=uuid.uuid4(),
        company_id=company.id,
        reference=f"PAY-{uuid.uuid4().hex[:10]}",
        tenant_client_id=tenant_client_id,
        payment_type="rent",
        status=status,
        amount_aed=Decimal(amount),
        due_date=due,
    )
    db.add(pr)
    await db.commit()
    await db.refresh(pr)
    return pr


async def _make_ticket(
    db: AsyncSession,
    company: Company,
    requester_client_id: uuid.UUID,
    status: str = "open",
    subject: str = "Fuite d'eau",
) -> ServiceTicket:
    t = ServiceTicket(
        id=uuid.uuid4(),
        company_id=company.id,
        reference=f"TCK-{uuid.uuid4().hex[:10]}",
        subject=subject,
        priority="medium",
        status=status,
        requester_client_id=requester_client_id,
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return t


async def _make_conversation(
    db: AsyncSession, company: Company, participant_user_id: uuid.UUID
) -> Conversation:
    conv = Conversation(
        id=uuid.uuid4(),
        company_id=company.id,
        type="direct",
        subject="Support",
        created_by=participant_user_id,
    )
    db.add(conv)
    await db.flush()
    db.add(
        ConversationParticipant(
            id=uuid.uuid4(),
            company_id=company.id,
            conversation_id=conv.id,
            user_id=participant_user_id,
            role="member",
        )
    )
    await db.commit()
    await db.refresh(conv)
    return conv


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ── Gardes auth / rôle ───────────────────────────────────────────────────────


async def test_tenant_requires_authentication(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/tenant/dashboard")
    assert resp.status_code == 403


async def test_fournisseur_role_forbidden(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    _, token = await _make_user(db_session, seed_company, UserRole.PARTNER.value)
    resp = await client.get("/api/v1/tenant/dashboard", headers=_auth(token))
    assert resp.status_code == 403


# ── Locataire non lié → réponses vides ───────────────────────────────────────


async def test_dashboard_unlinked_returns_zeros(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    _, token = await _make_user(db_session, seed_company, UserRole.CLIENT.value)
    resp = await client.get("/api/v1/tenant/dashboard", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["pending_payments"] == 0
    assert body["open_tickets"] == 0


@pytest.mark.parametrize("path", ["payments", "tickets"])
async def test_list_endpoints_unlinked_empty(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession, path: str
) -> None:
    _, token = await _make_user(db_session, seed_company, UserRole.CLIENT.value)
    resp = await client.get(f"/api/v1/tenant/{path}", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["items"] == [] and body["total"] == 0


# ── Paiement ─────────────────────────────────────────────────────────────────


async def test_payments_list_scoped_to_tenant(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    _user, tenant, token = await _linked_tenant(db_session, seed_company)
    await _make_payment_request(db_session, seed_company, tenant.id, "pending", "3000")
    # Paiement d'un AUTRE locataire (même tenant) — ne doit pas apparaître.
    other = await _make_client(db_session, seed_company, f"o-{uuid.uuid4().hex[:8]}@sgi.test")
    await _make_payment_request(db_session, seed_company, other.id, "pending", "9999")

    resp = await client.get("/api/v1/tenant/payments", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["amount_aed"] == "3000.00"


async def test_pay_own_request(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    _user, tenant, token = await _linked_tenant(db_session, seed_company)
    pr = await _make_payment_request(db_session, seed_company, tenant.id, "pending", "2500")

    resp = await client.post(
        f"/api/v1/tenant/payments/{pr.id}/pay",
        json={"method": "online"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "paid"


async def test_pay_other_tenant_request_is_404(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    """Anti-BOLA : un locataire ne peut pas payer la demande d'un autre."""
    victim = await _make_client(db_session, seed_company, f"v-{uuid.uuid4().hex[:8]}@sgi.test")
    pr = await _make_payment_request(db_session, seed_company, victim.id, "pending", "7000")

    _attacker, _c, token = await _linked_tenant(db_session, seed_company)
    resp = await client.post(
        f"/api/v1/tenant/payments/{pr.id}/pay", json={"method": "online"}, headers=_auth(token)
    )
    assert resp.status_code == 404


# ── Tickets ──────────────────────────────────────────────────────────────────


async def test_create_ticket_forces_requester(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    _user, tenant, token = await _linked_tenant(db_session, seed_company)
    resp = await client.post(
        "/api/v1/tenant/tickets",
        json={"subject": "Climatisation HS", "priority": "high"},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["subject"] == "Climatisation HS"
    assert body["status"] == "open"

    # Le ticket apparaît bien dans SA liste.
    listed = await client.get("/api/v1/tenant/tickets", headers=_auth(token))
    assert listed.json()["total"] == 1


async def test_tickets_list_scoped(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    _user, tenant, token = await _linked_tenant(db_session, seed_company)
    await _make_ticket(db_session, seed_company, tenant.id)
    other = await _make_client(db_session, seed_company, f"o-{uuid.uuid4().hex[:8]}@sgi.test")
    await _make_ticket(db_session, seed_company, other.id, subject="Pas le mien")

    resp = await client.get("/api/v1/tenant/tickets", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["subject"] == "Fuite d'eau"


async def test_ticket_detail_and_comment(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    _user, tenant, token = await _linked_tenant(db_session, seed_company)
    t = await _make_ticket(db_session, seed_company, tenant.id)

    detail = await client.get(f"/api/v1/tenant/tickets/{t.id}", headers=_auth(token))
    assert detail.status_code == 200
    assert "events" in detail.json()

    comment = await client.post(
        f"/api/v1/tenant/tickets/{t.id}/comments",
        json={"body": "Toujours pas réparé"},
        headers=_auth(token),
    )
    assert comment.status_code == 201
    assert comment.json()["event_type"] == "commented"


async def test_ticket_detail_other_tenant_is_404(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    victim = await _make_client(db_session, seed_company, f"v-{uuid.uuid4().hex[:8]}@sgi.test")
    t = await _make_ticket(db_session, seed_company, victim.id)

    _attacker, _c, token = await _linked_tenant(db_session, seed_company)
    resp = await client.get(f"/api/v1/tenant/tickets/{t.id}", headers=_auth(token))
    assert resp.status_code == 404


# ── Chat ─────────────────────────────────────────────────────────────────────


async def test_chat_lists_participant_conversations(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    user, _tenant, token = await _linked_tenant(db_session, seed_company)
    await _make_conversation(db_session, seed_company, user.id)
    # Conversation d'un autre user — invisible.
    other_user, _t = await _make_user(db_session, seed_company, UserRole.CLIENT.value)
    await _make_conversation(db_session, seed_company, other_user.id)

    resp = await client.get("/api/v1/tenant/chat", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["total"] == 1


async def test_chat_detail_and_send(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    user, _tenant, token = await _linked_tenant(db_session, seed_company)
    conv = await _make_conversation(db_session, seed_company, user.id)

    sent = await client.post(
        f"/api/v1/tenant/chat/{conv.id}/messages",
        json={"body": "Bonjour"},
        headers=_auth(token),
    )
    assert sent.status_code == 201
    assert sent.json()["body"] == "Bonjour"

    detail = await client.get(f"/api/v1/tenant/chat/{conv.id}", headers=_auth(token))
    assert detail.status_code == 200
    assert len(detail.json()["messages"]) == 1


async def test_chat_non_participant_is_404(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    """Anti-BOLA / anti-énumération : conversation d'autrui → 404 (pas 403)."""
    other_user, _t = await _make_user(db_session, seed_company, UserRole.CLIENT.value)
    conv = await _make_conversation(db_session, seed_company, other_user.id)

    _attacker_user, _tenant, token = await _linked_tenant(db_session, seed_company)
    resp = await client.get(f"/api/v1/tenant/chat/{conv.id}", headers=_auth(token))
    assert resp.status_code == 404


# ── Isolation multi-tenant (Loi 1) ──────────────────────────────────────────


async def test_cross_tenant_payment_invisible(
    client: AsyncClient,
    seed_company: Company,
    db_session: AsyncSession,
    second_admin: tuple[Company, str],
) -> None:
    """Le paiement d'une AUTRE société n'est jamais visible/payable (RLS Loi 1)."""
    other_company, _admin_token = second_admin
    victim = await _make_client(
        db_session, other_company, f"x-{uuid.uuid4().hex[:8]}@sgi.test"
    )
    pr = await _make_payment_request(db_session, other_company, victim.id, "pending", "4000")

    _user, _tenant, token = await _linked_tenant(db_session, seed_company)
    listed = await client.get("/api/v1/tenant/payments", headers=_auth(token))
    assert listed.json()["total"] == 0

    pay = await client.post(
        f"/api/v1/tenant/payments/{pr.id}/pay", json={"method": "online"}, headers=_auth(token)
    )
    assert pay.status_code == 404
