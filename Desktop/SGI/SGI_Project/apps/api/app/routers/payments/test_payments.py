"""Tests Paiements — helpers purs."""

from __future__ import annotations

from datetime import date

import pytest

from app.routers.payments.service import generate_reference, is_overdue


def test_generate_reference() -> None:
    assert generate_reference(2026, 1) == "PAY-2026-000001"
    assert generate_reference(2026, 4242) == "PAY-2026-004242"


def test_generate_reference_sortable() -> None:
    refs = [generate_reference(2026, n) for n in (10, 2, 1)]
    assert sorted(refs) == [
        generate_reference(2026, 1),
        generate_reference(2026, 2),
        generate_reference(2026, 10),
    ]


def test_is_overdue_true() -> None:
    assert is_overdue(date(2026, 1, 1), "pending", date(2026, 5, 30)) is True


def test_is_overdue_not_due_yet() -> None:
    assert is_overdue(date(2026, 12, 31), "pending", date(2026, 5, 30)) is False


def test_is_overdue_already_paid() -> None:
    # Une demande payée n'est jamais en retard, même si due_date passée.
    assert is_overdue(date(2026, 1, 1), "paid", date(2026, 5, 30)) is False


def test_is_overdue_cancelled() -> None:
    assert is_overdue(date(2026, 1, 1), "cancelled", date(2026, 5, 30)) is False


pytestmark = pytest.mark.asyncio


# ─── Tests d'intégration endpoints (auth + multi-tenant + machine à états) ──
# Requièrent PostgreSQL — lancer via : docker compose exec api uv run pytest

from httpx import AsyncClient

from app.models.company import Company
from app.models.user import User


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _req_payload() -> dict:
    return {"payment_type": "rent", "amount_aed": "5000.00", "due_date": "2026-12-31"}


async def test_payments_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/payments/requests")
    assert resp.status_code == 401


async def test_create_then_list_request(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    create = await client.post(
        "/api/v1/payments/requests", headers=_auth(token), json=_req_payload()
    )
    assert create.status_code == 201, create.text
    body = create.json()
    assert body["status"] == "pending"
    ref = body["reference"]

    listed = await client.get("/api/v1/payments/requests", headers=_auth(token))
    assert listed.status_code == 200
    refs = [r["reference"] for r in listed.json()["data"]]
    assert ref in refs


async def test_pay_request_lifecycle(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    create = await client.post(
        "/api/v1/payments/requests", headers=_auth(token), json=_req_payload()
    )
    req_id = create.json()["id"]

    # pending → paid : autorisé.
    paid = await client.post(
        f"/api/v1/payments/requests/{req_id}/pay",
        headers=_auth(token),
        json={"method": "bank_transfer"},
    )
    assert paid.status_code == 200, paid.text
    assert paid.json()["status"] == "paid"

    # paid → pay : interdit (déjà réglée).
    again = await client.post(
        f"/api/v1/payments/requests/{req_id}/pay",
        headers=_auth(token),
        json={"method": "bank_transfer"},
    )
    assert again.status_code == 422
    assert again.json()["detail"] == "request_not_payable"


async def test_payments_tenant_isolation(
    client: AsyncClient, seed_admin: tuple[User, str], second_admin: tuple[Company, str]
) -> None:
    """Une demande de paiement de A n'est pas visible par B (Loi 1)."""
    _admin, token_a = seed_admin
    _company_b, token_b = second_admin

    created = await client.post(
        "/api/v1/payments/requests", headers=_auth(token_a), json=_req_payload()
    )
    assert created.status_code == 201
    ref_a = created.json()["reference"]

    list_b = await client.get("/api/v1/payments/requests", headers=_auth(token_b))
    assert list_b.status_code == 200
    refs_b = [r["reference"] for r in list_b.json()["data"]]
    assert ref_a not in refs_b
