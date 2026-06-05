"""Tests module Maintenance.

Couvre :
- Helpers purs (generate_reference, is_valid_transition, compute_sla_due, is_sla_breached)
- CRUD tickets (création, lecture, mise à jour, soft-delete)
- Machine à états (transitions valides et invalides)
- Assignation technicien / vendor
- Isolation multi-tenant (tenant A ne voit pas les tickets de tenant B)
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.building import Building
from app.models.client import Client
from app.models.company import Company
from app.models.user import User
from app.routers.maintenance.schemas import (
    QuoteCreate,
    TicketAssign,
    TicketCreate,
    TicketStatusUpdate,
    TicketUpdate,
)
from app.routers.maintenance.service import (
    SLA_HOURS,
    approve_quote,
    assign_ticket,
    compute_sla_due,
    create_quote,
    create_ticket,
    generate_reference,
    get_ticket,
    is_sla_breached,
    is_valid_transition,
    list_tickets,
    next_cron_run,
    reject_quote,
    sla_state,
    soft_delete_ticket,
    summarize_sla,
    update_ticket,
    update_ticket_status,
)

# ── Helpers purs ─────────────────────────────────────────────────────────


def test_generate_reference_format() -> None:
    assert generate_reference(2026, 1) == "MNT-2026-000001"
    assert generate_reference(2026, 999) == "MNT-2026-000999"


def test_generate_reference_lexicographic_order() -> None:
    refs = [generate_reference(2026, n) for n in (3, 1, 2, 100)]
    assert sorted(refs) == [
        generate_reference(2026, 1),
        generate_reference(2026, 2),
        generate_reference(2026, 3),
        generate_reference(2026, 100),
    ]


# ── next_cron_run (helper pur, sans dépendance) ──────────────────────────────


class TestNextCronRun:
    def test_monthly_first_at_9h(self) -> None:
        # "0 9 1 * *" = le 1er de chaque mois à 9h00.
        after = datetime(2026, 5, 15, 10, 0, tzinfo=UTC)
        nxt = next_cron_run("0 9 1 * *", after)
        assert nxt == datetime(2026, 6, 1, 9, 0, tzinfo=UTC)

    def test_same_day_later_today(self) -> None:
        # "30 14 * * *" = tous les jours à 14h30 → aujourd'hui si encore à venir.
        after = datetime(2026, 5, 15, 8, 0, tzinfo=UTC)
        nxt = next_cron_run("30 14 * * *", after)
        assert nxt == datetime(2026, 5, 15, 14, 30, tzinfo=UTC)

    def test_strictly_after(self) -> None:
        # Pile à l'heure → renvoie la PROCHAINE occurrence, pas la courante.
        after = datetime(2026, 5, 15, 14, 30, tzinfo=UTC)
        nxt = next_cron_run("30 14 * * *", after)
        assert nxt == datetime(2026, 5, 16, 14, 30, tzinfo=UTC)

    def test_day_of_week_monday(self) -> None:
        # "0 0 * * 1" = chaque lundi à minuit. 2026-05-15 = vendredi → 2026-05-18.
        after = datetime(2026, 5, 15, 12, 0, tzinfo=UTC)
        nxt = next_cron_run("0 0 * * 1", after)
        assert nxt == datetime(2026, 5, 18, 0, 0, tzinfo=UTC)

    def test_step_every_15_minutes(self) -> None:
        after = datetime(2026, 5, 15, 10, 7, tzinfo=UTC)
        nxt = next_cron_run("*/15 * * * *", after)
        assert nxt == datetime(2026, 5, 15, 10, 15, tzinfo=UTC)

    def test_quarterly_via_month_list(self) -> None:
        # "0 9 1 1,4,7,10 *" = 1er jan/avr/juil/oct à 9h.
        after = datetime(2026, 5, 1, 0, 0, tzinfo=UTC)
        nxt = next_cron_run("0 9 1 1,4,7,10 *", after)
        assert nxt == datetime(2026, 7, 1, 9, 0, tzinfo=UTC)

    def test_naive_datetime_assumed_utc(self) -> None:
        nxt = next_cron_run("0 9 1 * *", datetime(2026, 5, 15, 10, 0))
        assert nxt == datetime(2026, 6, 1, 9, 0, tzinfo=UTC)

    def test_invalid_expression_returns_none(self) -> None:
        assert next_cron_run("not a cron", datetime(2026, 5, 15, tzinfo=UTC)) is None
        assert next_cron_run("0 9 1 *", datetime(2026, 5, 15, tzinfo=UTC)) is None  # 4 champs
        assert next_cron_run("99 9 1 * *", datetime(2026, 5, 15, tzinfo=UTC)) is None  # hors borne


def test_is_valid_transition_allowed() -> None:
    assert is_valid_transition("new", "triaged")
    assert is_valid_transition("new", "assigned")
    assert is_valid_transition("assigned", "in_progress")
    assert is_valid_transition("in_progress", "resolved")
    assert is_valid_transition("resolved", "closed")
    assert is_valid_transition("in_progress", "on_hold")
    assert is_valid_transition("on_hold", "in_progress")


def test_is_valid_transition_forbidden() -> None:
    assert not is_valid_transition("new", "closed")
    assert not is_valid_transition("new", "resolved")
    assert not is_valid_transition("closed", "new")
    assert not is_valid_transition("cancelled", "new")
    assert not is_valid_transition("in_progress", "new")


def test_is_valid_transition_terminal_states() -> None:
    assert not is_valid_transition("closed", "triaged")
    assert not is_valid_transition("cancelled", "assigned")


def test_compute_sla_due_urgent() -> None:
    now = datetime(2026, 5, 30, 8, 0, tzinfo=UTC)
    due = compute_sla_due("urgent", now)
    assert due == now + timedelta(hours=SLA_HOURS["urgent"])
    assert due == now + timedelta(hours=4)


def test_compute_sla_due_all_priorities() -> None:
    now = datetime(2026, 5, 30, 0, 0, tzinfo=UTC)
    assert compute_sla_due("low", now) == now + timedelta(hours=168)
    assert compute_sla_due("medium", now) == now + timedelta(hours=72)
    assert compute_sla_due("high", now) == now + timedelta(hours=24)
    assert compute_sla_due("urgent", now) == now + timedelta(hours=4)


def test_compute_sla_due_naive_datetime() -> None:
    """Un datetime sans tzinfo doit être traité comme UTC."""
    naive_now = datetime(2026, 5, 30, 0, 0)
    due = compute_sla_due("high", naive_now)
    assert due == naive_now.replace(tzinfo=UTC) + timedelta(hours=24)


def test_is_sla_breached_when_overdue() -> None:
    ticket = MagicMock()
    ticket.status = "in_progress"
    ticket.sla_due_at = datetime.now(UTC) - timedelta(hours=1)
    assert is_sla_breached(ticket) is True


def test_is_sla_breached_when_not_yet_due() -> None:
    ticket = MagicMock()
    ticket.status = "in_progress"
    ticket.sla_due_at = datetime.now(UTC) + timedelta(hours=10)
    assert is_sla_breached(ticket) is False


def test_is_sla_breached_on_terminal_status() -> None:
    for terminal in ("closed", "cancelled", "resolved"):
        ticket = MagicMock()
        ticket.status = terminal
        ticket.sla_due_at = datetime.now(UTC) - timedelta(hours=1)
        assert is_sla_breached(ticket) is False, f"should not breach on {terminal}"


def test_is_sla_breached_no_due_date() -> None:
    ticket = MagicMock()
    ticket.status = "new"
    ticket.sla_due_at = None
    assert is_sla_breached(ticket) is False


# ── sla_state / summarize_sla (purs) ─────────────────────────────────────────


_NOW = datetime(2026, 6, 1, 12, 0, tzinfo=UTC)


def test_sla_state_terminal_is_none() -> None:
    for st in ("resolved", "closed", "cancelled"):
        assert sla_state(_NOW, _NOW + timedelta(hours=5), st) is None


def test_sla_state_no_sla() -> None:
    assert sla_state(_NOW, None, "new") == "no_sla"


def test_sla_state_breached() -> None:
    assert sla_state(_NOW, _NOW - timedelta(hours=1), "in_progress") == "breached"


def test_sla_state_due_soon() -> None:
    assert sla_state(_NOW, _NOW + timedelta(hours=10), "assigned") == "due_soon"
    # borne : exactement 24 h → encore due_soon
    assert sla_state(_NOW, _NOW + timedelta(hours=24), "assigned") == "due_soon"


def test_sla_state_on_track() -> None:
    assert sla_state(_NOW, _NOW + timedelta(hours=48), "triaged") == "on_track"


def _mock_ticket(status: str, priority: str, sla_due_at: datetime | None) -> MagicMock:
    t = MagicMock()
    t.status = status
    t.priority = priority
    t.sla_due_at = sla_due_at
    return t


def test_summarize_sla_counts() -> None:
    tickets = [
        _mock_ticket("in_progress", "urgent", _NOW - timedelta(hours=1)),  # breached
        _mock_ticket("assigned", "high", _NOW + timedelta(hours=5)),  # due_soon
        _mock_ticket("new", "medium", _NOW + timedelta(hours=48)),  # on_track
        _mock_ticket("triaged", "low", None),  # no_sla
        _mock_ticket("closed", "urgent", _NOW - timedelta(hours=1)),  # ignoré (terminal)
    ]
    s = summarize_sla(tickets, _NOW)
    assert s["by_sla"] == {"breached": 1, "due_soon": 1, "on_track": 1, "no_sla": 1}
    assert s["by_priority"] == {"urgent": 1, "high": 1, "medium": 1, "low": 1}
    assert s["total_open"] == 4


def test_summarize_sla_empty() -> None:
    s = summarize_sla([], _NOW)
    assert s["total_open"] == 0
    assert s["by_sla"]["breached"] == 0


# ── Tests d'intégration : CRUD tickets + devis (DB) ──────────────────────────


async def _building(db: AsyncSession, company: Company) -> uuid.UUID:
    b = Building(
        id=uuid.uuid4(),
        company_id=company.id,
        reference=f"BLD-{uuid.uuid4().hex[:10]}",
        building_type="residential_tower",
    )
    db.add(b)
    await db.commit()
    return b.id


async def _ticket(db, company, admin, **overrides):
    building_id = await _building(db, company)
    data = TicketCreate(
        title=overrides.pop("title", "Fuite robinet"),
        category=overrides.pop("category", "plumbing"),
        priority=overrides.pop("priority", "medium"),
        building_id=building_id,
        **overrides,
    )
    return await create_ticket(db, company.id, data, admin.id)


def _company_of(admin: User) -> Company:
    c = Company(id=admin.company_id, name="x", slug="x")
    return c


# ── CRUD tickets ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_ticket_reference_and_sla(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    ticket = await _ticket(db_session, _company_of(admin), admin)
    assert ticket.reference.startswith("MNT-")
    assert ticket.status == "new"
    assert ticket.sla_due_at is not None


@pytest.mark.asyncio
async def test_create_ticket_requires_location(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    with pytest.raises(HTTPException) as exc:
        await create_ticket(
            db_session,
            admin.company_id,
            TicketCreate(title="Sans lieu", category="plumbing"),
            admin.id,
        )
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_get_cross_tenant_none(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    ticket = await _ticket(db_session, _company_of(admin), admin)
    other = Company(
        id=uuid.uuid4(),
        name="Autre",
        slug=f"co-{uuid.uuid4().hex[:8]}",
        plan="pro",
        is_active=True,
    )
    db_session.add(other)
    await db_session.commit()
    assert await get_ticket(db_session, other.id, ticket.id) is None


@pytest.mark.asyncio
async def test_list_filter_by_status(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    company = _company_of(admin)
    await _ticket(db_session, company, admin)
    _, n_new = await list_tickets(db_session, company.id, status="new")
    assert n_new >= 1


@pytest.mark.asyncio
async def test_update_priority_recomputes_sla(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    company = _company_of(admin)
    ticket = await _ticket(db_session, company, admin, priority="low")
    updated = await update_ticket(
        db_session, company.id, ticket.id, TicketUpdate(priority="urgent")
    )
    assert updated is not None and updated.priority == "urgent"
    # SLA urgent < SLA low → l'échéance recalculée est plus proche.
    assert updated.sla_due_at is not None


# ── Transitions de statut ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_status_valid_and_resolved_sets_timestamp(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    company = _company_of(admin)
    ticket = await _ticket(db_session, company, admin)
    # new → triaged → assigned → in_progress → resolved
    for target in ("triaged", "assigned", "in_progress", "resolved"):
        ticket = await update_ticket_status(
            db_session, company.id, ticket.id, TicketStatusUpdate(status=target)
        )
    assert ticket is not None and ticket.status == "resolved"
    assert ticket.resolved_at is not None


@pytest.mark.asyncio
async def test_status_invalid_transition_422(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    company = _company_of(admin)
    ticket = await _ticket(db_session, company, admin)
    with pytest.raises(HTTPException) as exc:
        await update_ticket_status(
            db_session, company.id, ticket.id, TicketStatusUpdate(status="closed")
        )
    assert exc.value.status_code == 422


# ── Assignation ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_assign_requires_exactly_one_target(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    company = _company_of(admin)
    ticket = await _ticket(db_session, company, admin)
    # Aucun des deux → 422
    with pytest.raises(HTTPException) as exc:
        await assign_ticket(db_session, company.id, ticket.id, TicketAssign(), admin.id)
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_assign_to_technician(db_session: AsyncSession, seed_admin: tuple[User, str]) -> None:
    admin, _ = seed_admin
    company = _company_of(admin)
    ticket = await _ticket(db_session, company, admin)
    assigned = await assign_ticket(
        db_session, company.id, ticket.id, TicketAssign(technician_id=admin.id), admin.id
    )
    assert assigned is not None
    assert assigned.assigned_technician_id == admin.id
    assert assigned.status == "assigned"


@pytest.mark.asyncio
async def test_soft_delete(db_session: AsyncSession, seed_admin: tuple[User, str]) -> None:
    admin, _ = seed_admin
    company = _company_of(admin)
    ticket = await _ticket(db_session, company, admin)
    assert await soft_delete_ticket(db_session, company.id, ticket.id) is True
    assert await get_ticket(db_session, company.id, ticket.id) is None


# ── Devis (quotes) ───────────────────────────────────────────────────────────


async def _vendor_party(db: AsyncSession, company: Company) -> uuid.UUID:
    c = Client(
        id=uuid.uuid4(),
        company_id=company.id,
        type="company",
        company_name="Vendor FZE",
    )
    db.add(c)
    await db.commit()
    return c.id


@pytest.mark.asyncio
async def test_create_and_approve_quote_updates_ticket_cost(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    company = _company_of(admin)
    ticket = await _ticket(db_session, company, admin)
    vendor_id = await _vendor_party(db_session, company)

    quote = await create_quote(
        db_session,
        company.id,
        ticket.id,
        QuoteCreate(vendor_party_id=vendor_id, amount_aed=Decimal("1500.00")),
    )
    assert quote is not None and quote.status == "pending"

    approved = await approve_quote(db_session, company.id, quote.id)
    assert approved is not None and approved.status == "approved"
    # Le coût estimé du ticket reflète le devis approuvé.
    refreshed = await get_ticket(db_session, company.id, ticket.id)
    assert refreshed is not None and refreshed.cost_estimate_aed == Decimal("1500.00")


@pytest.mark.asyncio
async def test_reject_quote_then_cannot_reapprove(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    company = _company_of(admin)
    ticket = await _ticket(db_session, company, admin)
    vendor_id = await _vendor_party(db_session, company)
    quote = await create_quote(
        db_session,
        company.id,
        ticket.id,
        QuoteCreate(vendor_party_id=vendor_id, amount_aed=Decimal("900.00")),
    )
    rejected = await reject_quote(db_session, company.id, quote.id)
    assert rejected is not None and rejected.status == "rejected"
    # Un devis non-pending ne peut plus être approuvé.
    with pytest.raises(HTTPException) as exc:
        await approve_quote(db_session, company.id, quote.id)
    assert exc.value.status_code == 422


# ── Tests d'intégration ENDPOINT (auth HTTP + contexte tenant + machine à états) ──
# Passent par le client HTTP (JWT + middleware + get_db_session) — couvrent la
# couche réseau/auth que les tests « service » ci-dessus n'exercent pas.
# Requièrent PostgreSQL — lancer via : docker compose exec api uv run pytest


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _create_ticket_http(client: AsyncClient, token: str) -> str:
    """Crée un bâtiment puis un ticket de maintenance ; renvoie l'id du ticket."""
    b = await client.post(
        "/api/v1/buildings/",
        headers=_auth(token),
        json={"reference": f"BLD-{uuid.uuid4().hex[:8]}", "building_type": "residential_tower"},
    )
    assert b.status_code == 201, b.text
    building_id = b.json()["data"]["id"]
    t = await client.post(
        "/api/v1/maintenance/tickets",
        headers=_auth(token),
        json={
            "title": "Fuite robinet cuisine",
            "category": "plumbing",
            "priority": "high",
            "building_id": building_id,
        },
    )
    assert t.status_code == 201, t.text
    return t.json()["data"]["id"]


async def _create_vendor_http(client: AsyncClient, token: str) -> str:
    """Crée un client (party) + sa fiche vendor ; renvoie le party_id."""
    c = await client.post(
        "/api/v1/clients/",
        headers=_auth(token),
        json={"type": "company", "company_name": "Cool Plumbing LLC"},
    )
    assert c.status_code == 201, c.text
    party_id = c.json()["data"]["id"]
    v = await client.post(
        "/api/v1/vendors/",
        headers=_auth(token),
        json={"party_id": party_id, "vendor_type": "maintenance"},
    )
    assert v.status_code == 201, v.text
    return party_id


async def test_maintenance_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/maintenance/tickets")
    assert resp.status_code in (401, 403)


async def test_create_then_list_ticket_http(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    ticket_id = await _create_ticket_http(client, token)

    listed = await client.get("/api/v1/maintenance/tickets", headers=_auth(token))
    assert listed.status_code == 200, listed.text
    ids = [t["id"] for t in listed.json()["data"]]
    assert ticket_id in ids


async def test_status_valid_transition_http(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    ticket_id = await _create_ticket_http(client, token)
    # new → triaged : transition autorisée.
    resp = await client.post(
        f"/api/v1/maintenance/tickets/{ticket_id}/status",
        headers=_auth(token),
        json={"status": "triaged"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "triaged"


async def test_status_invalid_transition_422_http(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    ticket_id = await _create_ticket_http(client, token)
    # new → resolved : saut interdit par la machine à états.
    resp = await client.post(
        f"/api/v1/maintenance/tickets/{ticket_id}/status",
        headers=_auth(token),
        json={"status": "resolved"},
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["detail"].startswith("invalid_transition")


async def test_quote_approve_then_reapprove_422_http(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    ticket_id = await _create_ticket_http(client, token)
    vendor_id = await _create_vendor_http(client, token)
    q = await client.post(
        f"/api/v1/maintenance/tickets/{ticket_id}/quotes",
        headers=_auth(token),
        json={"vendor_party_id": vendor_id, "amount_aed": "1250.00"},
    )
    assert q.status_code == 201, q.text
    quote_id = q.json()["id"]

    approve = await client.post(
        f"/api/v1/maintenance/quotes/{quote_id}/approve", headers=_auth(token)
    )
    assert approve.status_code == 200, approve.text
    # Un devis déjà approuvé n'est plus « pending ».
    again = await client.post(
        f"/api/v1/maintenance/quotes/{quote_id}/approve", headers=_auth(token)
    )
    assert again.status_code == 422, again.text
    assert again.json()["detail"] == "quote_not_pending"


async def test_ticket_tenant_isolation_http(
    client: AsyncClient, seed_admin: tuple[User, str], second_admin: tuple[Company, str]
) -> None:
    """Un ticket de la société A n'est pas visible par la société B (Loi 1)."""
    _admin, token_a = seed_admin
    _company_b, token_b = second_admin
    ticket_id = await _create_ticket_http(client, token_a)

    list_b = await client.get("/api/v1/maintenance/tickets", headers=_auth(token_b))
    assert list_b.status_code == 200
    ids_b = [t["id"] for t in list_b.json()["data"]]
    assert ticket_id not in ids_b


# ── Endpoint /maintenance/sla-summary (intégration) ──────────────────────────


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def test_sla_summary_endpoint(
    client: AsyncClient,
    db_session: AsyncSession,
    seed_company: Company,
    seed_admin: tuple[User, str],
) -> None:
    admin, token = seed_admin
    await _ticket(db_session, seed_company, admin, priority="medium")
    r = await client.get("/api/v1/maintenance/sla-summary", headers=_bearer(token))
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["total_open"] >= 1
    assert data["by_priority"]["medium"] >= 1


async def test_sla_summary_tenant_isolation(
    client: AsyncClient,
    db_session: AsyncSession,
    seed_company: Company,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
) -> None:
    """La synthèse de B ne compte pas les tickets de A (Loi 1)."""
    admin, _token_a = seed_admin
    _company_b, token_b = second_admin
    await _ticket(db_session, seed_company, admin, priority="high")
    r = await client.get("/api/v1/maintenance/sla-summary", headers=_bearer(token_b))
    assert r.status_code == 200
    assert r.json()["data"]["total_open"] == 0
