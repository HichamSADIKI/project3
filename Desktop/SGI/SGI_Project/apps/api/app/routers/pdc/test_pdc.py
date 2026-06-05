"""Tests unitaires — helpers métier purs du module PDC."""

from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.routers.pdc.service import (
    aggregate_outstanding,
    aging_bucket,
    days_to_due,
    generate_reference,
    is_overdue,
    is_valid_pdc_transition,
    pdc_reminder_level,
    summarize_aging,
)

# ─── Transitions de cycle de vie ──────────────────────────────────────────


class TestPdcTransitions:
    @pytest.mark.parametrize(
        "current,target",
        [
            ("pending", "deposited"),
            ("pending", "cancelled"),
            ("deposited", "cleared"),
            ("deposited", "bounced"),
            ("bounced", "replaced"),
        ],
    )
    def test_valid_transitions(self, current: str, target: str) -> None:
        assert is_valid_pdc_transition(current, target) is True

    @pytest.mark.parametrize(
        "current,target",
        [
            # Ne peut pas sauter l'étape deposited
            ("pending", "cleared"),
            ("pending", "bounced"),
            # cleared est terminal
            ("cleared", "deposited"),
            ("cleared", "bounced"),
            ("cleared", "cancelled"),
            # replaced est terminal
            ("replaced", "pending"),
            ("replaced", "bounced"),
            # cancelled est terminal
            ("cancelled", "pending"),
            # bounced ne peut aller QUE vers replaced
            ("bounced", "cleared"),
            ("bounced", "cancelled"),
            # Pas de retour en arrière
            ("deposited", "pending"),
        ],
    )
    def test_invalid_transitions(self, current: str, target: str) -> None:
        assert is_valid_pdc_transition(current, target) is False

    def test_cleared_is_terminal(self) -> None:
        # Aucune transition possible depuis cleared
        for target in ("pending", "deposited", "cleared", "bounced", "replaced", "cancelled"):
            assert is_valid_pdc_transition("cleared", target) is False


# ─── days_to_due ──────────────────────────────────────────────────────────


class TestDaysToDue:
    def test_future(self) -> None:
        assert days_to_due(date(2026, 5, 28), date(2026, 6, 28)) == 31

    def test_today(self) -> None:
        assert days_to_due(date(2026, 5, 28), date(2026, 5, 28)) == 0

    def test_past_returns_negative(self) -> None:
        assert days_to_due(date(2026, 5, 28), date(2026, 5, 20)) == -8


# ─── is_overdue ───────────────────────────────────────────────────────────


class TestIsOverdue:
    today = date(2026, 5, 28)

    def test_pending_past_due_is_overdue(self) -> None:
        assert is_overdue(self.today, date(2026, 5, 20), "pending") is True

    def test_pending_future_is_not_overdue(self) -> None:
        assert is_overdue(self.today, date(2026, 6, 28), "pending") is False

    def test_pending_due_today_is_not_overdue(self) -> None:
        # due_date == today : pas encore en retard
        assert is_overdue(self.today, self.today, "pending") is False

    def test_deposited_is_not_overdue_even_if_past_due(self) -> None:
        assert is_overdue(self.today, date(2026, 5, 20), "deposited") is False

    @pytest.mark.parametrize("status", ["cleared", "bounced", "replaced", "cancelled"])
    def test_terminal_statuses_never_overdue(self, status: str) -> None:
        assert is_overdue(self.today, date(2020, 1, 1), status) is False


# ─── generate_reference ───────────────────────────────────────────────────


class TestGenerateReference:
    def test_format(self) -> None:
        assert generate_reference(2026, 1) == "PDC-2026-000001"
        assert generate_reference(2026, 42) == "PDC-2026-000042"
        assert generate_reference(2026, 999999) == "PDC-2026-999999"

    def test_sortable_alphabetically(self) -> None:
        # Le format à 6 chiffres garantit le tri lexicographique correct
        refs = [generate_reference(2026, n) for n in [1, 10, 100, 1000]]
        assert sorted(refs) == refs


# ─── aggregate_outstanding ────────────────────────────────────────────────


class TestAggregateOutstanding:
    def _make(self, status: str, amount: str) -> object:
        return SimpleNamespace(status=status, amount_aed=Decimal(amount))

    def test_empty_list(self) -> None:
        assert aggregate_outstanding([]) == Decimal("0.00")

    def test_only_pending(self) -> None:
        cheques = [self._make("pending", "5000"), self._make("pending", "5000")]
        assert aggregate_outstanding(cheques) == Decimal("10000")

    def test_excludes_cleared_and_bounced(self) -> None:
        cheques = [
            self._make("pending", "5000"),
            self._make("deposited", "5000"),
            self._make("cleared", "5000"),
            self._make("bounced", "5000"),
            self._make("replaced", "5000"),
            self._make("cancelled", "5000"),
        ]
        # pending + deposited uniquement = 10 000
        assert aggregate_outstanding(cheques) == Decimal("10000")

    def test_pending_and_deposited_summed(self) -> None:
        cheques = [
            self._make("pending", "3000"),
            self._make("deposited", "7500.50"),
        ]
        assert aggregate_outstanding(cheques) == Decimal("10500.50")


class TestAgingBucket:
    today = date(2026, 6, 1)

    def test_terminal_status_is_none(self) -> None:
        for st in ("cleared", "bounced", "replaced", "cancelled"):
            assert aging_bucket(self.today, date(2026, 6, 10), st) is None

    def test_overdue(self) -> None:
        assert aging_bucket(self.today, date(2026, 5, 20), "pending") == "overdue"

    def test_due_7(self) -> None:
        assert aging_bucket(self.today, date(2026, 6, 1), "pending") == "due_7"
        assert aging_bucket(self.today, date(2026, 6, 8), "deposited") == "due_7"

    def test_due_30(self) -> None:
        assert aging_bucket(self.today, date(2026, 6, 9), "pending") == "due_30"
        assert aging_bucket(self.today, date(2026, 7, 1), "pending") == "due_30"

    def test_later(self) -> None:
        assert aging_bucket(self.today, date(2026, 7, 2), "pending") == "later"


class TestSummarizeAging:
    today = date(2026, 6, 1)

    def _c(self, status: str, amount: str, due: date) -> object:
        return SimpleNamespace(status=status, amount_aed=Decimal(amount), due_date=due)

    def test_buckets_and_totals(self) -> None:
        cheques = [
            self._c("pending", "1000", date(2026, 5, 20)),  # overdue
            self._c("deposited", "2000", date(2026, 6, 3)),  # due_7
            self._c("pending", "3000", date(2026, 6, 20)),  # due_30
            self._c("pending", "4000", date(2026, 8, 1)),  # later
            self._c("cleared", "9999", date(2026, 6, 3)),  # ignoré (terminal)
        ]
        s = summarize_aging(cheques, self.today)
        assert s["buckets"]["overdue"] == {"count": 1, "amount_aed": Decimal("1000")}
        assert s["buckets"]["due_7"] == {"count": 1, "amount_aed": Decimal("2000")}
        assert s["buckets"]["due_30"] == {"count": 1, "amount_aed": Decimal("3000")}
        assert s["buckets"]["later"] == {"count": 1, "amount_aed": Decimal("4000")}
        assert s["total_count"] == 4
        assert s["total_amount_aed"] == Decimal("10000")

    def test_empty(self) -> None:
        s = summarize_aging([], self.today)
        assert s["total_count"] == 0
        assert s["total_amount_aed"] == Decimal("0.00")


class TestPdcReminderLevel:
    today = date(2026, 5, 30)

    def test_overdue_when_pending_past_due(self) -> None:
        assert pdc_reminder_level(self.today, date(2026, 5, 1), "pending") == "overdue"

    def test_due_soon_within_7_days(self) -> None:
        assert pdc_reminder_level(self.today, date(2026, 6, 3), "pending") == "due_soon"

    def test_due_soon_today(self) -> None:
        assert pdc_reminder_level(self.today, self.today, "deposited") == "due_soon"

    def test_none_when_far(self) -> None:
        assert pdc_reminder_level(self.today, date(2026, 9, 1), "pending") is None

    def test_deposited_not_overdue(self) -> None:
        # un chèque déjà déposé mais échéance passée n'est pas "overdue" (dépôt fait)
        assert pdc_reminder_level(self.today, date(2026, 5, 1), "deposited") is None

    def test_terminal_states_no_reminder(self) -> None:
        for st in ("cleared", "bounced", "replaced", "cancelled"):
            assert pdc_reminder_level(self.today, date(2026, 5, 1), st) is None

    def test_custom_window(self) -> None:
        level = pdc_reminder_level(self.today, date(2026, 6, 15), "pending", due_soon_days=30)
        assert level == "due_soon"


# ─── Tests d'intégration endpoints (auth + multi-tenant + machine à états) ──
# Requièrent PostgreSQL — lancer via : docker compose exec api uv run pytest

from httpx import AsyncClient

from app.models.company import Company
from app.models.user import User


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _create_pending_pdc(client: AsyncClient, token: str) -> tuple[str, str]:
    """Chaîne complète client → bien → contrat → PDC. Renvoie (pdc_id, reference)."""
    c = await client.post(
        "/api/v1/clients/",
        headers=_auth(token),
        json={"type": "individual", "first_name": "Ali", "last_name": "Noor"},
    )
    assert c.status_code == 201, c.text
    party_id = c.json()["data"]["id"]

    p = await client.post(
        "/api/v1/properties/",
        headers=_auth(token),
        json={"type": "apartment", "price": "900000.00"},
    )
    assert p.status_code == 201, p.text
    property_id = p.json()["data"]["id"]

    ct = await client.post(
        "/api/v1/contracts/",
        headers=_auth(token),
        json={
            "type": "rental",
            "client_id": party_id,
            "property_id": property_id,
            "amount": 120000,
        },
    )
    assert ct.status_code == 201, ct.text
    contract_id = ct.json()["data"]["id"]

    pdc = await client.post(
        "/api/v1/pdc/",
        headers=_auth(token),
        json={
            "contract_id": contract_id,
            "drawer_party_id": party_id,
            "cheque_number": "100123",
            "bank_name": "Emirates NBD",
            "account_holder_name": "Ali Noor",
            "amount_aed": "10000.00",
            "due_date": "2026-06-30",
        },
    )
    assert pdc.status_code == 201, pdc.text
    data = pdc.json()["data"]
    assert data["status"] == "pending"
    return data["id"], data["reference"]


async def test_pdc_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/pdc/")
    assert resp.status_code == 401


async def test_create_then_list_pdc(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    _pdc_id, reference = await _create_pending_pdc(client, token)
    listed = await client.get("/api/v1/pdc/", headers=_auth(token))
    assert listed.status_code == 200
    refs = [c["reference"] for c in listed.json()["data"]]
    assert reference in refs


async def test_pdc_state_machine(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    pdc_id, _ref = await _create_pending_pdc(client, token)

    # pending → clear directement : interdit (il faut déposer d'abord).
    bad = await client.post(f"/api/v1/pdc/{pdc_id}/clear", headers=_auth(token))
    assert bad.status_code == 422
    assert bad.json()["detail"] == "invalid_status_transition"

    # pending → deposited → cleared : chemin valide.
    dep = await client.post(
        f"/api/v1/pdc/{pdc_id}/deposit", headers=_auth(token), json={"deposit_date": "2026-06-25"}
    )
    assert dep.status_code == 200, dep.text
    assert dep.json()["data"]["status"] == "deposited"

    clr = await client.post(f"/api/v1/pdc/{pdc_id}/clear", headers=_auth(token))
    assert clr.status_code == 200, clr.text
    assert clr.json()["data"]["status"] == "cleared"


async def test_pdc_tenant_isolation(
    client: AsyncClient, seed_admin: tuple[User, str], second_admin: tuple[Company, str]
) -> None:
    """Un PDC de A n'est pas visible par B (Loi 1)."""
    _admin, token_a = seed_admin
    _company_b, token_b = second_admin
    _pdc_id, reference = await _create_pending_pdc(client, token_a)

    list_b = await client.get("/api/v1/pdc/", headers=_auth(token_b))
    assert list_b.status_code == 200
    refs_b = [c["reference"] for c in list_b.json()["data"]]
    assert reference not in refs_b


async def test_aging_summary_endpoint(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    """Le PDC en cours (due 2026-06-30, 10 000 AED) tombe dans la tranche due_7
    avec today=2026-06-25."""
    _admin, token = seed_admin
    await _create_pending_pdc(client, token)
    r = await client.get(
        "/api/v1/pdc/aging-summary", headers=_auth(token), params={"today": "2026-06-25"}
    )
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["due_7"]["count"] == 1
    assert data["total_count"] == 1
    assert data["total_amount_aed"] in ("10000.00", "10000")


async def test_aging_summary_tenant_isolation(
    client: AsyncClient, seed_admin: tuple[User, str], second_admin: tuple[Company, str]
) -> None:
    """La synthèse de B ne voit pas le PDC de A (Loi 1)."""
    _admin, token_a = seed_admin
    _company_b, token_b = second_admin
    await _create_pending_pdc(client, token_a)
    r = await client.get(
        "/api/v1/pdc/aging-summary", headers=_auth(token_b), params={"today": "2026-06-25"}
    )
    assert r.status_code == 200
    assert r.json()["data"]["total_count"] == 0
