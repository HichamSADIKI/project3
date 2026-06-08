"""Tests — Agent AI Fournisseurs.

Couche 1 : helpers purs (risk score, validation, insights) — sans DB.
Couche 2 : intégration HTTP `/vendors/ai/*` + Red-Team cross-tenant (Loi 1).
"""

import uuid
from datetime import date
from decimal import Decimal

import pytest

from app.models.party_vendor import Vendor
from app.routers.vendors import ai_service

TODAY = date(2026, 6, 8)


def _vendor(**kw: object) -> Vendor:
    """Fabrique un Vendor en mémoire (pas de session) pour les helpers purs."""
    base: dict[str, object] = {
        "party_id": uuid.uuid4(),
        "vendor_type": "maintenance",
        "categories": ["maintenance"],
        "specialities": [],
        "service_areas": [],
        "trade_licence_number": "TL-123",
        "trade_licence_expiry": date(2030, 1, 1),
        "insurance_expiry": date(2030, 1, 1),
        "rating_avg": Decimal("0"),
        "rating_count": 0,
        "on_time_rate": None,
        "jobs_completed": 0,
        "jobs_cancelled": 0,
        "verification_status": "verified",
        "is_active": True,
    }
    base.update(kw)
    return Vendor(**base)


# ── assess_vendor_risk (pur) ───────────────────────────────────────────────


def test_excellent_vendor_is_low_risk() -> None:
    v = _vendor(
        rating_avg=Decimal("4.8"),
        rating_count=30,
        on_time_rate=Decimal("96"),
        jobs_completed=50,
        jobs_cancelled=1,
    )
    res = ai_service.assess_vendor_risk(v, TODAY)
    assert res["risk_band"] == "low"
    assert res["score"] >= 70
    assert "no_ratings" not in res["flags"]


def test_unverified_expired_licence_is_high_risk() -> None:
    v = _vendor(
        verification_status="pending",
        trade_licence_expiry=date(2025, 1, 1),  # expirée vs TODAY
        rating_count=0,
    )
    res = ai_service.assess_vendor_risk(v, TODAY)
    assert "not_verified" in res["flags"]
    assert "licence_expired" in res["flags"]
    assert res["risk_band"] in ("medium", "high")


def test_high_cancellation_flagged() -> None:
    v = _vendor(jobs_completed=60, jobs_cancelled=30)  # 33 %
    res = ai_service.assess_vendor_risk(v, TODAY)
    assert "high_cancellation" in res["flags"]


def test_score_bounded_0_100() -> None:
    v = _vendor(
        verification_status="pending",
        is_active=False,
        trade_licence_expiry=date(2020, 1, 1),
        insurance_expiry=date(2020, 1, 1),
        jobs_completed=10,
        jobs_cancelled=40,
        rating_avg=Decimal("0.5"),
        rating_count=5,
    )
    res = ai_service.assess_vendor_risk(v, TODAY)
    assert 0 <= res["score"] <= 100


def test_licence_expiring_soon_flag() -> None:
    v = _vendor(trade_licence_expiry=date(2026, 6, 20))  # < 30j de TODAY
    res = ai_service.assess_vendor_risk(v, TODAY)
    assert "licence_expiring" in res["flags"]


# ── risk_actions (pur) ─────────────────────────────────────────────────────


def test_risk_actions_for_unverified() -> None:
    v = _vendor(verification_status="pending", trade_licence_expiry=None)
    res = ai_service.assess_vendor_risk(v, TODAY)
    actions = ai_service.risk_actions(res)
    assert "complete_verification" in actions
    assert "request_trade_licence" in actions
    assert len(actions) == len(set(actions))


# ── validation_assessment (pur) ────────────────────────────────────────────


def test_validation_clean_pending_is_approve() -> None:
    v = _vendor(verification_status="pending")
    res = ai_service.validation_assessment(v, TODAY)
    assert res["recommendation"] == "approve"
    assert res["blocking_issues"] == []


def test_validation_missing_docs_requests_documents() -> None:
    v = _vendor(
        verification_status="pending",
        trade_licence_number=None,
        trade_licence_expiry=None,
        categories=[],
    )
    res = ai_service.validation_assessment(v, TODAY)
    assert res["recommendation"] == "request_documents"
    assert "missing_trade_licence_number" in res["blocking_issues"]
    assert "no_categories" in res["blocking_issues"]


def test_validation_already_verified() -> None:
    v = _vendor(verification_status="verified")
    res = ai_service.validation_assessment(v, TODAY)
    assert res["recommendation"] == "approve"
    assert "already_verified" in res["warnings"]


def test_validation_rejected_stays_rejected() -> None:
    v = _vendor(verification_status="rejected")
    res = ai_service.validation_assessment(v, TODAY)
    assert res["recommendation"] == "reject"


def test_validation_warns_on_bad_performance() -> None:
    v = _vendor(
        verification_status="pending",
        jobs_completed=50,
        jobs_cancelled=20,  # 28 %
        rating_avg=Decimal("2.0"),
        rating_count=10,
    )
    res = ai_service.validation_assessment(v, TODAY)
    assert res["recommendation"] == "review"
    assert "high_cancellation" in res["warnings"]
    assert "low_rating" in res["warnings"]


# ── parc_insights (pur) ────────────────────────────────────────────────────


def test_parc_insights_counts() -> None:
    summary = {
        "by_type": {"maintenance": 5, "cleaning": 3},
        "by_verification": {"verified": 6, "pending": 2},
        "active_count": 7,
        "verified_count": 6,
        "total": 8,
    }
    out = ai_service.parc_insights(summary, "fr")
    assert out["total"] == 8
    assert out["verified_count"] == 6
    assert any("attente" in b for b in out["bullets"])


@pytest.mark.parametrize("locale", ["ar", "en", "fr"])
def test_parc_insights_localised(locale: str) -> None:
    out = ai_service.parc_insights({"total": 0}, locale)  # type: ignore[arg-type]
    assert isinstance(out["headline"], str) and out["headline"]
