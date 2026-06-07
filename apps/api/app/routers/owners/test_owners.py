"""Tests unitaires — helpers métier purs du module owners.

Couverture : helpers de mandat (actif, jours restants, alerte renouvellement).
Tests d'intégration DB → à ajouter avec conftest.py async + tenant fixture.
"""

import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.company import Company
from app.models.party_owner import Owner
from app.routers.owners.service import (
    days_until_mandate_expiry,
    expiring_mandates,
    mandate_expiry_state,
    mandate_is_active,
    needs_renewal_alert,
)

# ─── mandate_is_active ─────────────────────────────────────────────────────


class TestMandateIsActive:
    def test_both_dates_none_returns_false(self) -> None:
        assert mandate_is_active(date(2026, 5, 28), None, None) is False

    def test_within_period_returns_true(self) -> None:
        assert mandate_is_active(date(2026, 5, 28), date(2026, 1, 1), date(2026, 12, 31)) is True

    def test_before_start_returns_false(self) -> None:
        assert mandate_is_active(date(2025, 12, 31), date(2026, 1, 1), date(2026, 12, 31)) is False

    def test_after_end_returns_false(self) -> None:
        assert mandate_is_active(date(2027, 1, 1), date(2026, 1, 1), date(2026, 12, 31)) is False

    def test_exact_start_date_is_active(self) -> None:
        assert mandate_is_active(date(2026, 1, 1), date(2026, 1, 1), date(2026, 12, 31)) is True

    def test_exact_end_date_is_active(self) -> None:
        assert mandate_is_active(date(2026, 12, 31), date(2026, 1, 1), date(2026, 12, 31)) is True

    def test_no_end_open_ended_active_when_after_start(self) -> None:
        assert mandate_is_active(date(2030, 1, 1), date(2026, 1, 1), None) is True

    def test_no_start_only_end_active_until_expiry(self) -> None:
        assert mandate_is_active(date(2026, 5, 28), None, date(2027, 1, 1)) is True


# ─── days_until_mandate_expiry ─────────────────────────────────────────────


class TestDaysUntilMandateExpiry:
    def test_none_when_no_end_date(self) -> None:
        assert days_until_mandate_expiry(date(2026, 5, 28), None) is None

    def test_positive_when_in_future(self) -> None:
        assert days_until_mandate_expiry(date(2026, 5, 28), date(2026, 7, 27)) == 60

    def test_zero_on_expiry_day(self) -> None:
        assert days_until_mandate_expiry(date(2026, 5, 28), date(2026, 5, 28)) == 0

    def test_negative_when_expired(self) -> None:
        assert days_until_mandate_expiry(date(2026, 5, 28), date(2026, 5, 20)) == -8


# ─── needs_renewal_alert ───────────────────────────────────────────────────


class TestNeedsRenewalAlert:
    def test_false_when_no_end_date(self) -> None:
        assert needs_renewal_alert(date(2026, 5, 28), None) is False

    def test_true_within_default_60_day_window(self) -> None:
        assert needs_renewal_alert(date(2026, 5, 28), date(2026, 6, 27)) is True

    def test_false_when_expired(self) -> None:
        assert needs_renewal_alert(date(2026, 5, 28), date(2026, 5, 20)) is False

    def test_false_when_too_far_in_future(self) -> None:
        assert needs_renewal_alert(date(2026, 5, 28), date(2026, 12, 31)) is False

    @pytest.mark.parametrize(
        "threshold,days_ahead,expected",
        [
            (30, 25, True),
            (30, 35, False),
            (90, 60, True),
            (90, 91, False),
        ],
    )
    def test_custom_threshold(self, threshold: int, days_ahead: int, expected: bool) -> None:
        from datetime import timedelta

        today = date(2026, 5, 28)
        end = today + timedelta(days=days_ahead)
        assert needs_renewal_alert(today, end, threshold) is expected


# ─── mandate_expiry_state (pur) ──────────────────────────────────────────────


class TestMandateExpiryState:
    today = date(2026, 6, 1)

    def test_none_when_no_end(self) -> None:
        assert mandate_expiry_state(self.today, None) is None

    def test_expired(self) -> None:
        assert mandate_expiry_state(self.today, date(2026, 5, 20)) == "expired"

    def test_expiring_soon(self) -> None:
        assert mandate_expiry_state(self.today, date(2026, 6, 20)) == "expiring_soon"
        # borne 60 jours → encore expiring_soon
        assert mandate_expiry_state(self.today, date(2026, 7, 31)) == "expiring_soon"

    def test_active(self) -> None:
        assert mandate_expiry_state(self.today, date(2026, 12, 1)) == "active"


# ─── expiring_mandates (intégration service) ─────────────────────────────────


async def _seed_owner(db: AsyncSession, company_id, *, mandate_end: date | None):
    client = Client(
        id=uuid.uuid4(),
        company_id=company_id,
        type="individual",
        first_name="Prop",
        last_name="Test",
    )
    db.add(client)
    await db.commit()
    owner = Owner(
        company_id=company_id,
        party_id=client.id,
        mandate_reference=f"MND-{uuid.uuid4().hex[:6]}",
        mandate_end_date=mandate_end,
    )
    db.add(owner)
    await db.commit()
    return client.id


@pytest.mark.asyncio
async def test_expiring_mandates_states_and_order(
    db_session: AsyncSession, seed_company: Company
) -> None:
    today = date.today()
    soon_id = await _seed_owner(db_session, seed_company.id, mandate_end=today + timedelta(days=20))
    overdue_id = await _seed_owner(
        db_session, seed_company.id, mandate_end=today - timedelta(days=5)
    )
    await _seed_owner(
        db_session, seed_company.id, mandate_end=today + timedelta(days=200)
    )  # hors 90j
    await _seed_owner(db_session, seed_company.id, mandate_end=None)  # sans échéance → exclu

    rows = await expiring_mandates(db_session, seed_company.id, today, days=90)
    by_id = {r["party_id"]: r for r in rows}
    assert soon_id in by_id and by_id[soon_id]["state"] == "expiring_soon"
    assert overdue_id in by_id and by_id[overdue_id]["state"] == "expired"
    assert len(rows) == 2  # le lointain et le sans-échéance sont exclus
    # tri par date de fin → l'expiré avant le proche
    ids = [r["party_id"] for r in rows]
    assert ids.index(overdue_id) < ids.index(soon_id)
    assert by_id[soon_id]["needs_renewal"] is True


@pytest.mark.asyncio
async def test_expiring_mandates_tenant_isolation(
    db_session: AsyncSession, seed_company: Company
) -> None:
    today = date.today()
    await _seed_owner(db_session, seed_company.id, mandate_end=today + timedelta(days=10))
    other = Company(
        id=uuid.uuid4(), name="Autre", slug=f"co-{uuid.uuid4().hex[:8]}", plan="pro", is_active=True
    )
    db_session.add(other)
    await db_session.commit()
    rows = await expiring_mandates(db_session, other.id, today, days=90)
    assert rows == []


# ─── Enforcement assurance « UAE PASS Infinity » (change_owner_iban, L3) ──────
# Requièrent PostgreSQL — lancer via : docker compose exec api uv run pytest

from httpx import AsyncClient

from app.models.user import User
from app.routers.iam.assurance_service import upsert_verification


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _seed_owner_for_company(db: AsyncSession, company_id) -> uuid.UUID:
    """Crée un Client + son profil Owner ; renvoie le party_id (= id du Client)."""
    client = Client(
        id=uuid.uuid4(),
        company_id=company_id,
        type="individual",
        first_name="Prop",
        last_name="IBAN",
    )
    db.add(client)
    await db.commit()
    owner = Owner(company_id=company_id, party_id=client.id, bank_iban="AE000000000000000000000")
    db.add(owner)
    await db.commit()
    return client.id


async def _grant_assurance_l3(db: AsyncSession, user: User) -> None:
    await upsert_verification(
        db,
        user.company_id,
        "user",
        user.id,
        email_verified=True,
        mobile_verified=True,
        emirates_id_verified=True,
        strong_auth_verified=True,
    )


@pytest.mark.asyncio
async def test_iban_change_blocked_without_l3(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    """Modifier `bank_iban` sans niveau L3 → 403 structuré (step-up)."""
    admin, token = seed_admin  # L0 par défaut
    party_id = await _seed_owner_for_company(db_session, admin.company_id)

    resp = await client.patch(
        f"/api/v1/owners/{party_id}",
        headers=_auth(token),
        json={"bank_iban": "AE999999999999999999999"},
    )
    assert resp.status_code == 403, resp.text
    detail = resp.json()["detail"]
    assert detail["error"] == "assurance_step_up_required"
    assert detail["action"] == "change_owner_iban"
    assert detail["required_level"] == "L3"
    assert detail["current_level"] == "L0"


@pytest.mark.asyncio
async def test_non_iban_update_not_gated(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    """Une mise à jour ne touchant PAS l'IBAN n'exige aucun step-up (L0 → 200)."""
    admin, token = seed_admin  # L0
    party_id = await _seed_owner_for_company(db_session, admin.company_id)

    resp = await client.patch(
        f"/api/v1/owners/{party_id}",
        headers=_auth(token),
        json={"residency_uae": True},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["residency_uae"] is True


@pytest.mark.asyncio
async def test_iban_change_allowed_with_l3(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    """Avec L3, le changement d'IBAN passe (200) et est persisté."""
    admin, token = seed_admin
    await _grant_assurance_l3(db_session, admin)
    party_id = await _seed_owner_for_company(db_session, admin.company_id)

    new_iban = "AE123456789012345678901"
    resp = await client.patch(
        f"/api/v1/owners/{party_id}",
        headers=_auth(token),
        json={"bank_iban": new_iban},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["bank_iban"] == new_iban
