"""Tests unitaires — helpers purs des relevés propriétaires (M6)."""

from decimal import Decimal

import pytest

from app.routers.owner_statements.service import (
    compute_commission,
    is_valid_period,
    net_payout,
    statement_period_label,
)


class TestIsValidPeriod:
    @pytest.mark.parametrize("year,month", [(2026, 1), (2026, 12), (2000, 6)])
    def test_valid(self, year: int, month: int) -> None:
        assert is_valid_period(year, month) is True

    @pytest.mark.parametrize("year,month", [(2026, 0), (2026, 13), (1999, 5), (2101, 1)])
    def test_invalid(self, year: int, month: int) -> None:
        assert is_valid_period(year, month) is False


class TestStatementPeriodLabel:
    def test_pads(self) -> None:
        assert statement_period_label(2026, 5) == "2026-05"

    def test_december(self) -> None:
        assert statement_period_label(2026, 12) == "2026-12"


class TestComputeCommission:
    def test_five_pct(self) -> None:
        assert compute_commission(Decimal("100000"), Decimal("5")) == Decimal("5000.00")

    def test_zero_rate(self) -> None:
        assert compute_commission(Decimal("100000"), Decimal("0")) == Decimal("0.00")

    def test_rounds_half_up(self) -> None:
        # 333.33 * 5% = 16.6665 → 16.67
        assert compute_commission(Decimal("333.33"), Decimal("5")) == Decimal("16.67")


class TestNetPayout:
    def test_basic(self) -> None:
        # 100000 brut - 8000 dépenses - 5000 commission = 87000
        result = net_payout(Decimal("100000"), Decimal("8000"), Decimal("5000"))
        assert result == Decimal("87000.00")

    def test_can_be_negative(self) -> None:
        # dépenses + commission > brut → payout négatif (le propriétaire doit)
        result = net_payout(Decimal("1000"), Decimal("900"), Decimal("200"))
        assert result == Decimal("-100.00")

    def test_quantized(self) -> None:
        result = net_payout(Decimal("100.5"), Decimal("0"), Decimal("0"))
        assert result.as_tuple().exponent == -2


# ─── Tests d'intégration endpoints (auth + multi-tenant) ────────────────────
# Requièrent PostgreSQL — lancer via : docker compose exec api uv run pytest

import uuid

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.user import User


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _create_owner(client: AsyncClient, token: str, email: str | None = None) -> str:
    """Crée un client (party) puis son profil propriétaire ; renvoie party_id."""
    payload: dict[str, object] = {"type": "individual", "first_name": "Omar", "last_name": "Saïd"}
    if email is not None:
        payload["email"] = email
    c = await client.post("/api/v1/clients/", headers=_auth(token), json=payload)
    assert c.status_code == 201, c.text
    party_id = c.json()["data"]["id"]
    o = await client.post("/api/v1/owners/", headers=_auth(token), json={"party_id": party_id})
    assert o.status_code == 201, o.text
    return party_id


async def test_owner_statements_requires_auth(client: AsyncClient) -> None:
    resp = await client.get(f"/api/v1/owners/{uuid.uuid4()}/statements")
    assert resp.status_code == 401


async def test_generate_then_list_statement(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    party_id = await _create_owner(client, token)

    gen = await client.post(
        f"/api/v1/owners/{party_id}/statements?year=2026&month=1", headers=_auth(token)
    )
    assert gen.status_code == 201, gen.text
    body = gen.json()["data"]
    assert body["period_year"] == 2026
    assert body["status"] == "draft"

    listed = await client.get(f"/api/v1/owners/{party_id}/statements", headers=_auth(token))
    assert listed.status_code == 200
    assert any(s["period_year"] == 2026 and s["period_month"] == 1 for s in listed.json()["data"])


async def test_owner_statement_isolation(
    client: AsyncClient, seed_admin: tuple[User, str], second_admin: tuple[Company, str]
) -> None:
    """Les relevés d'un propriétaire de A ne sont pas visibles via le token B (Loi 1)."""
    _admin, token_a = seed_admin
    _company_b, token_b = second_admin
    party_id = await _create_owner(client, token_a)
    await client.post(
        f"/api/v1/owners/{party_id}/statements?year=2026&month=2", headers=_auth(token_a)
    )

    # Sous le contexte tenant B, l'owner de A n'existe pas → aucun relevé.
    list_b = await client.get(f"/api/v1/owners/{party_id}/statements", headers=_auth(token_b))
    assert list_b.status_code == 200
    assert list_b.json()["data"] == []


# ─── Déclenchement e-mail à la génération du relevé ──────────────────────────


async def test_statement_enqueues_email_when_opted_in_with_email(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Owner avec e-mail + opt-in (défaut) → la livraison e-mail est enfilée."""
    captured: dict[str, object] = {}
    monkeypatch.setattr(
        "app.routers.owner_statements.router.deliver_email_notification",
        lambda notif, *, to: captured.update(
            {"to": to, "title": notif.title, "channel": notif.channel}
        ),
    )
    _admin, token = seed_admin
    party_id = await _create_owner(client, token, email="owner@example.com")

    gen = await client.post(
        f"/api/v1/owners/{party_id}/statements?year=2026&month=3", headers=_auth(token)
    )
    assert gen.status_code == 201, gen.text
    assert captured.get("to") == "owner@example.com"
    assert captured.get("channel") == "email"
    assert "2026-03" in str(captured.get("title"))


async def test_statement_no_email_when_owner_has_no_email(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Pas d'adresse → aucune livraison e-mail enfilée (in-app seul)."""
    calls: list[object] = []
    monkeypatch.setattr(
        "app.routers.owner_statements.router.deliver_email_notification",
        lambda notif, *, to: calls.append(to),
    )
    _admin, token = seed_admin
    party_id = await _create_owner(client, token)  # sans email

    gen = await client.post(
        f"/api/v1/owners/{party_id}/statements?year=2026&month=4", headers=_auth(token)
    )
    assert gen.status_code == 201, gen.text
    assert calls == []


async def test_statement_no_email_when_opted_out(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Owner avec e-mail mais monthly_statement_enabled=False → pas d'e-mail."""
    from sqlalchemy import update as sa_update

    from app.models.party_owner import Owner

    calls: list[object] = []
    monkeypatch.setattr(
        "app.routers.owner_statements.router.deliver_email_notification",
        lambda notif, *, to: calls.append(to),
    )
    _admin, token = seed_admin
    party_id = await _create_owner(client, token, email="optout@example.com")

    await db_session.execute(
        sa_update(Owner)
        .where(Owner.party_id == uuid.UUID(party_id))
        .values(monthly_statement_enabled=False)
    )
    await db_session.commit()

    gen = await client.post(
        f"/api/v1/owners/{party_id}/statements?year=2026&month=5", headers=_auth(token)
    )
    assert gen.status_code == 201, gen.text
    assert calls == []
