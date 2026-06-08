"""Tests — Agent AI Clients.

Couche 1 (ce fichier, partie haute) : **helpers purs** (scoring, insights,
brouillon) — sans DB, exécutables partout.
Couche 2 (partie basse) : **intégration HTTP** des endpoints `/clients/ai/*`
via la harness partagée — Postgres réel (conteneur), avec Red-Team cross-tenant
(Loi 1) et anti-BOLA (404).
"""

import uuid
from decimal import Decimal

import pytest

from app.models.client import Client
from app.routers.clients import ai_service


def _client(**kw: object) -> Client:
    """Fabrique un Client en mémoire (pas de session) pour les helpers purs."""
    base: dict[str, object] = {
        "id": uuid.uuid4(),
        "type": "individual",
        "first_name": "Sara",
        "last_name": "Khan",
        "company_name": None,
        "email": None,
        "phone": None,
        "phone2": None,
        "source": None,
        "budget_max": None,
        "preferred_property_type": None,
        "preferred_location": None,
        "notes": None,
    }
    base.update(kw)
    return Client(**base)


# ── score_client (pur) ─────────────────────────────────────────────────────


def test_score_golden_visa_budget_is_hot_and_eligible() -> None:
    c = _client(
        budget_max=Decimal("2500000"),
        preferred_property_type="villa",
        preferred_location="Palm Jumeirah",
        phone="+971500000000",
        email="sara@example.com",
        source="referral",
    )
    res = ai_service.score_client(c)
    assert res["golden_visa_eligible"] is True
    assert res["band"] == "hot"
    assert res["score"] >= 70
    assert "budget_golden_visa" in res["reasons"]
    assert "multi_channel" in res["reasons"]


def test_score_empty_client_is_cold() -> None:
    res = ai_service.score_client(_client())
    assert res["score"] == 0
    assert res["band"] == "cold"
    assert res["golden_visa_eligible"] is False


def test_score_is_capped_at_100() -> None:
    c = _client(
        budget_max=Decimal("9999999"),
        preferred_property_type="penthouse",
        preferred_location="Downtown",
        phone="1",
        phone2="2",
        email="a@b.co",
        source="website",
        notes="hot lead",
    )
    res = ai_service.score_client(c)
    assert res["score"] == 100


def test_score_mid_budget_warm_band() -> None:
    c = _client(budget_max=Decimal("600000"), preferred_property_type="apartment", phone="1")
    res = ai_service.score_client(c)
    assert res["band"] == "warm"
    assert res["golden_visa_eligible"] is False
    assert "budget_high" in res["reasons"]


def test_channel_count_counts_distinct_fields() -> None:
    assert ai_service._channel_count(_client()) == 0
    assert ai_service._channel_count(_client(phone="1")) == 1
    assert ai_service._channel_count(_client(phone="1", phone2="2", email="a@b.co")) == 3


# ── recommended_actions (pur) ──────────────────────────────────────────────


def test_recommended_actions_hot_with_golden_visa() -> None:
    c = _client(
        budget_max=Decimal("3000000"),
        preferred_property_type="villa",
        preferred_location="Palm Jumeirah",
        phone="1",
        email="a@b.co",
    )
    res = ai_service.score_client(c)
    assert res["band"] == "hot"
    actions = ai_service.recommended_actions(res, c)
    assert "propose_golden_visa" in actions
    assert "schedule_visit" in actions
    # Pas de doublon.
    assert len(actions) == len(set(actions))


def test_recommended_actions_cold_collects_contact() -> None:
    c = _client()
    res = ai_service.score_client(c)
    actions = ai_service.recommended_actions(res, c)
    assert "collect_contact" in actions
    assert "qualify_needs" in actions


# ── score_narrative (pur, localisé) ────────────────────────────────────────


@pytest.mark.parametrize("locale", ["ar", "en", "fr"])
def test_score_narrative_localised(locale: str) -> None:
    c = _client(budget_max=Decimal("2200000"))
    res = ai_service.score_client(c)
    text = ai_service.score_narrative(res, c, locale)  # type: ignore[arg-type]
    assert isinstance(text, str) and text


# ── portfolio_insights (pur) ───────────────────────────────────────────────


def test_portfolio_insights_builds_bullets() -> None:
    summary = {
        "by_type": {"individual": 8, "company": 2},
        "by_source": {"referral": 5, "website": 3, "portal": 2},
        "golden_visa_budget_count": 3,
        "total": 10,
    }
    out = ai_service.portfolio_insights(summary, "fr")
    assert out["total"] == 10
    assert out["golden_visa_budget_count"] == 3
    assert any("Golden Visa" in b for b in out["bullets"])


def test_portfolio_insights_empty() -> None:
    out = ai_service.portfolio_insights({}, "en")
    assert out["total"] == 0
    assert out["bullets"] == []


# ── draft_message (pur, localisé) ──────────────────────────────────────────


@pytest.mark.parametrize("locale", ["ar", "en", "fr"])
@pytest.mark.parametrize("purpose", ["follow_up", "proposal", "welcome", "visit"])
def test_draft_message_all_locales_and_purposes(locale: str, purpose: str) -> None:
    c = _client(first_name="Ali", last_name="N")
    msg = ai_service.draft_message(c, "whatsapp", locale, purpose)  # type: ignore[arg-type]
    assert "Ali" in msg


def test_draft_message_company_uses_company_name() -> None:
    c = _client(type="company", company_name="Acme FZE", first_name=None, last_name=None)
    msg = ai_service.draft_message(c, "email", "en", "welcome")
    assert "Acme FZE" in msg
