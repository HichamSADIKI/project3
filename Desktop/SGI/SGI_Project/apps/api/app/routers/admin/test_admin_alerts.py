"""Tests du sous-routeur app-admin « alerts » (`/admin/alerts`, tenant, Loi 1).

Couvre : helpers purs (comparateur, machine à états), CRUD règles, validation 422,
isolation Loi 1 (second_admin), et le cycle de vie des événements (ack/resolve + 409).
"""

import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin import AlertEvent, AlertRule
from app.routers.admin.alerts import can_transition, evaluate_comparator

AUTH = "Authorization"


# ── Helpers purs ───────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("value", "comp", "thr", "expected"),
    [
        (10, "gt", 5, True),
        (5, "gt", 5, False),
        (5, "gte", 5, True),
        (3, "lt", 5, True),
        (5, "lte", 5, True),
        (5, "bogus", 5, False),
    ],
)
def test_evaluate_comparator(value: float, comp: str, thr: float, expected: bool) -> None:
    assert evaluate_comparator(value, comp, thr) is expected


@pytest.mark.parametrize(
    ("current", "target", "ok"),
    [
        ("open", "acked", True),
        ("open", "resolved", True),
        ("acked", "resolved", True),
        ("acked", "acked", False),
        ("resolved", "acked", False),
        ("resolved", "resolved", False),
    ],
)
def test_can_transition(current: str, target: str, ok: bool) -> None:
    assert can_transition(current, target) is ok


# ── CRUD règles ──────────────────────────────────────────────────────────────


def _rule_body() -> dict[str, object]:
    return {
        "name": f"rule-{uuid.uuid4().hex[:6]}",
        "metric": "distinct_ips",
        "comparator": "gt",
        "threshold": 10,
        "window_seconds": 300,
        "severity": "warning",
    }


@pytest.mark.asyncio
async def test_rules_require_role(client: AsyncClient) -> None:
    # Non authentifié → 401 (garde require_admin).
    resp = await client.get("/api/v1/admin/alerts/rules")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_rule_crud(client: AsyncClient, seed_admin) -> None:
    _admin, token = seed_admin
    h = {AUTH: f"Bearer {token}"}

    # create
    resp = await client.post("/api/v1/admin/alerts/rules", headers=h, json=_rule_body())
    assert resp.status_code == 201
    rule_id = resp.json()["data"]["id"]

    # list + get
    assert (await client.get("/api/v1/admin/alerts/rules", headers=h)).json()["meta"]["total"] >= 1
    assert (await client.get(f"/api/v1/admin/alerts/rules/{rule_id}", headers=h)).status_code == 200

    # patch
    resp = await client.patch(
        f"/api/v1/admin/alerts/rules/{rule_id}", headers=h, json={"is_active": False}
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["is_active"] is False

    # delete (soft) → 204, puis 404
    assert (
        await client.delete(f"/api/v1/admin/alerts/rules/{rule_id}", headers=h)
    ).status_code == 204
    assert (await client.get(f"/api/v1/admin/alerts/rules/{rule_id}", headers=h)).status_code == 404


@pytest.mark.asyncio
async def test_rule_validation_422(client: AsyncClient, seed_admin) -> None:
    _admin, token = seed_admin
    h = {AUTH: f"Bearer {token}"}
    bad = _rule_body() | {"metric": "unknown_metric"}
    assert (await client.post("/api/v1/admin/alerts/rules", headers=h, json=bad)).status_code == 422
    bad2 = _rule_body() | {"comparator": "≈"}
    assert (
        await client.post("/api/v1/admin/alerts/rules", headers=h, json=bad2)
    ).status_code == 422


# ── Isolation Loi 1 ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_rules_tenant_isolation(client: AsyncClient, seed_admin, second_admin) -> None:
    _admin, token_a = seed_admin
    _other, token_b = second_admin
    resp = await client.post(
        "/api/v1/admin/alerts/rules", headers={AUTH: f"Bearer {token_a}"}, json=_rule_body()
    )
    rule_id = resp.json()["data"]["id"]

    # Tenant B ne voit pas / ne modifie pas la règle de A.
    hb = {AUTH: f"Bearer {token_b}"}
    assert (
        await client.get(f"/api/v1/admin/alerts/rules/{rule_id}", headers=hb)
    ).status_code == 404
    assert (
        await client.patch(
            f"/api/v1/admin/alerts/rules/{rule_id}", headers=hb, json={"is_active": False}
        )
    ).status_code == 404
    ids_b = {
        r["id"] for r in (await client.get("/api/v1/admin/alerts/rules", headers=hb)).json()["data"]
    }
    assert rule_id not in ids_b


# ── Cycle de vie des événements ──────────────────────────────────────────────────


async def _seed_event(db: AsyncSession, company_id: uuid.UUID) -> uuid.UUID:
    rule = AlertRule(
        company_id=company_id,
        name="r",
        metric="audit_events",
        comparator="gt",
        threshold=Decimal("1"),
        window_seconds=300,
    )
    db.add(rule)
    await db.flush()
    event = AlertEvent(
        company_id=company_id, rule_id=rule.id, observed_value=Decimal("5"), status="open"
    )
    db.add(event)
    await db.commit()
    return event.id


@pytest.mark.asyncio
async def test_event_ack_resolve_and_conflict(
    client: AsyncClient, db_session: AsyncSession, seed_admin
) -> None:
    admin, token = seed_admin
    h = {AUTH: f"Bearer {token}"}
    event_id = await _seed_event(db_session, admin.company_id)

    # open → acked
    resp = await client.post(f"/api/v1/admin/alerts/events/{event_id}/ack", headers=h)
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "acked"

    # acked → resolved
    resp = await client.post(f"/api/v1/admin/alerts/events/{event_id}/resolve", headers=h)
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "resolved"

    # resolved → ack : transition interdite (409)
    resp = await client.post(f"/api/v1/admin/alerts/events/{event_id}/ack", headers=h)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_event_isolation(
    client: AsyncClient, db_session: AsyncSession, seed_admin, second_admin
) -> None:
    admin, _ta = seed_admin
    _other, token_b = second_admin
    event_id = await _seed_event(db_session, admin.company_id)
    # Tenant B ne peut pas ack l'événement de A.
    resp = await client.post(
        f"/api/v1/admin/alerts/events/{event_id}/ack", headers={AUTH: f"Bearer {token_b}"}
    )
    assert resp.status_code == 404
