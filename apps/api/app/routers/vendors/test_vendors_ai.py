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


# ══════════════════════════════════════════════════════════════════════════
# Couche 2 — intégration HTTP + Red-Team cross-tenant (Loi 1) / anti-BOLA.
# ══════════════════════════════════════════════════════════════════════════

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import encode_jwt, hash_password
from app.models.client import Client
from app.models.company import Company
from app.models.party_vendor import Vendor
from app.models.user import User, UserRole, UserStatus


@pytest.fixture(autouse=True)
def _no_gemini(monkeypatch: pytest.MonkeyPatch) -> None:
    """Force le mode heuristique (pas de clé Gemini) → tests déterministes."""
    monkeypatch.setenv("GEMINI_API_KEY", "")


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _create_vendor(db: AsyncSession, company_id: uuid.UUID, **kw: object) -> uuid.UUID:
    party = Client(id=uuid.uuid4(), company_id=company_id, type="company", company_name="Vendor Co")
    db.add(party)
    await db.flush()
    fields: dict[str, object] = {
        "vendor_type": "maintenance",
        "categories": ["maintenance"],
        "verification_status": "verified",
        "is_active": True,
        "trade_licence_number": "TL-1",
        "trade_licence_expiry": date(2030, 1, 1),
        "rating_avg": Decimal("4.8"),
        "rating_count": 20,
        "on_time_rate": Decimal("95"),
        "jobs_completed": 50,
        "jobs_cancelled": 1,
    }
    fields.update(kw)
    db.add(Vendor(company_id=company_id, party_id=party.id, **fields))
    await db.commit()
    return party.id


async def _make_user_token(db: AsyncSession, company: Company, role: str) -> str:
    user = User(
        id=uuid.uuid4(),
        company_id=company.id,
        email=f"u-{uuid.uuid4().hex[:8]}@sgi.test",
        hashed_password=hash_password("Pass!23"),
        full_name="Role User",
        role=role,
        status=UserStatus.ACTIVE.value,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    return encode_jwt(
        {
            "sub": str(user.id),
            "company_id": str(company.id),
            "role": user.role,
            "status": user.status,
            "email": user.email,
        }
    )


@pytest.mark.asyncio
async def test_insights_http(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    admin, token = seed_admin
    await _create_vendor(db_session, admin.company_id)
    r = await client.post("/api/v1/vendors/ai/insights", headers=_auth(token))
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["total"] >= 1
    assert data["engine"] == "heuristic"


@pytest.mark.asyncio
async def test_risk_http_and_cross_tenant(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
    db_session: AsyncSession,
) -> None:
    admin, token = seed_admin
    pid = await _create_vendor(db_session, admin.company_id)
    r = await client.post(f"/api/v1/vendors/ai/{pid}/risk", headers=_auth(token))
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["risk_band"] == "low"
    assert 0 <= d["score"] <= 100

    # 💡 Red-Team Loi 1 : tenant B ne doit pas atteindre le fournisseur du tenant A.
    _, token_b = second_admin
    rx = await client.post(f"/api/v1/vendors/ai/{pid}/risk", headers=_auth(token_b))
    assert rx.status_code == 404


@pytest.mark.asyncio
async def test_validation_http_and_cross_tenant(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
    db_session: AsyncSession,
) -> None:
    admin, token = seed_admin
    pid = await _create_vendor(
        db_session,
        admin.company_id,
        verification_status="pending",
        trade_licence_number=None,
        trade_licence_expiry=None,
        categories=[],
    )
    r = await client.post(f"/api/v1/vendors/ai/{pid}/validation", headers=_auth(token))
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["recommendation"] == "request_documents"
    assert "missing_trade_licence_number" in d["blocking_issues"]

    _, token_b = second_admin
    rx = await client.post(f"/api/v1/vendors/ai/{pid}/validation", headers=_auth(token_b))
    assert rx.status_code == 404


@pytest.mark.asyncio
async def test_chat_http(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _, token = seed_admin
    r = await client.post(
        "/api/v1/vendors/ai/chat",
        json={"messages": [{"role": "user", "content": "État du parc ?"}], "locale": "fr"},
        headers=_auth(token),
    )
    assert r.status_code == 200, r.text
    assert r.json()["data"]["reply"]


@pytest.mark.asyncio
async def test_risk_unknown_returns_404(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _, token = seed_admin
    r = await client.post(f"/api/v1/vendors/ai/{uuid.uuid4()}/risk", headers=_auth(token))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_ai_requires_auth(client: AsyncClient) -> None:
    # Sans identité : require_roles refuse (403) avant la vérif tenant (401).
    r = await client.post("/api/v1/vendors/ai/insights")
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_ai_forbidden_for_client_role(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    token = await _make_user_token(db_session, seed_company, UserRole.CLIENT.value)
    r = await client.post("/api/v1/vendors/ai/insights", headers=_auth(token))
    assert r.status_code == 403


# ── Chemin d'enrichissement Gemini (monkeypatch) + health ──────────────────


@pytest.mark.asyncio
async def test_risk_and_validation_use_gemini(
    seed_admin: tuple[User, str], db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_text(*a: object, **k: object) -> dict[str, str]:
        return {"text": "Analyse IA", "engine": "gemini-2.5-flash"}

    monkeypatch.setattr(ai_service.gemini, "generate_text", fake_text)
    admin, _ = seed_admin
    pid = await _create_vendor(db_session, admin.company_id)
    risk = await ai_service.vendor_risk(db_session, admin.company_id, pid, "fr")
    assert risk is not None and risk["engine"] == "gemini-2.5-flash"
    val = await ai_service.vendor_validation(db_session, admin.company_id, pid, "en")
    assert val is not None and val["engine"] == "gemini-2.5-flash"
    ins = await ai_service.vendors_insights(db_session, admin.company_id, "ar")
    assert ins["engine"] == "gemini-2.5-flash"


@pytest.mark.asyncio
async def test_chat_uses_gemini(
    seed_admin: tuple[User, str], db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_chat(*a: object, **k: object) -> dict[str, str]:
        return {"text": "Réponse IA", "engine": "gemini-2.5-flash"}

    monkeypatch.setattr(ai_service.gemini, "generate_chat", fake_chat)
    admin, _ = seed_admin
    out = await ai_service.vendor_chat(
        db_session, admin.company_id, [{"role": "user", "content": "salut"}], "fr"
    )
    assert out["engine"] == "gemini-2.5-flash"
    assert out["reply"] == "Réponse IA"


@pytest.mark.asyncio
async def test_health_public(client: AsyncClient) -> None:
    r = await client.get("/api/v1/vendors/ai/health")
    assert r.status_code == 200
    assert r.json()["module"] == "vendors-ai"
