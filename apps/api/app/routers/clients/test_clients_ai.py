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


# ══════════════════════════════════════════════════════════════════════════
# Couche 2 — intégration HTTP + Red-Team cross-tenant (Loi 1) / anti-BOLA.
# (Postgres réel : exécuter en conteneur.)
# ══════════════════════════════════════════════════════════════════════════

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import encode_jwt, hash_password
from app.models.company import Company
from app.models.user import User, UserRole, UserStatus
from app.routers.clients.schemas import ClientCreate
from app.routers.clients.service import create_client


@pytest.fixture(autouse=True)
def _no_gemini(monkeypatch: pytest.MonkeyPatch) -> None:
    """Force le mode heuristique (pas de clé Gemini) → tests déterministes, pas
    de réseau. L'engine attendu est donc toujours 'heuristic'."""
    monkeypatch.setenv("GEMINI_API_KEY", "")


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


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
    await create_client(
        db_session,
        admin.company_id,
        ClientCreate(type="individual", first_name="A", budget_max=Decimal("2500000")),
    )
    r = await client.post("/api/v1/clients/ai/insights", headers=_auth(token))
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["total"] >= 1
    assert data["engine"] == "heuristic"


@pytest.mark.asyncio
async def test_score_http_and_cross_tenant(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
    db_session: AsyncSession,
) -> None:
    admin, token = seed_admin
    c = await create_client(
        db_session,
        admin.company_id,
        ClientCreate(
            type="individual",
            first_name="Hot",
            budget_max=Decimal("3000000"),
            preferred_property_type="villa",
            preferred_location="Palm Jumeirah",
            phone="1",
            email="h@x.io",
        ),
    )
    r = await client.post(f"/api/v1/clients/ai/{c.id}/score", headers=_auth(token))
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["band"] == "hot"
    assert d["golden_visa_eligible"] is True

    # 💡 Red-Team Loi 1 : le tenant B ne doit JAMAIS atteindre le client du tenant A.
    _, token_b = second_admin
    rx = await client.post(f"/api/v1/clients/ai/{c.id}/score", headers=_auth(token_b))
    assert rx.status_code == 404


@pytest.mark.asyncio
async def test_message_http_and_cross_tenant(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
    db_session: AsyncSession,
) -> None:
    admin, token = seed_admin
    c = await create_client(
        db_session, admin.company_id, ClientCreate(type="individual", first_name="Lina")
    )
    r = await client.post(
        f"/api/v1/clients/ai/{c.id}/message",
        json={"channel": "whatsapp", "locale": "fr", "purpose": "follow_up"},
        headers=_auth(token),
    )
    assert r.status_code == 200, r.text
    assert "Lina" in r.json()["data"]["message"]

    _, token_b = second_admin
    rx = await client.post(
        f"/api/v1/clients/ai/{c.id}/message",
        json={"channel": "whatsapp", "locale": "fr", "purpose": "follow_up"},
        headers=_auth(token_b),
    )
    assert rx.status_code == 404


@pytest.mark.asyncio
async def test_chat_http(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _, token = seed_admin
    r = await client.post(
        "/api/v1/clients/ai/chat",
        json={"messages": [{"role": "user", "content": "Résume mon portefeuille"}], "locale": "fr"},
        headers=_auth(token),
    )
    assert r.status_code == 200, r.text
    assert r.json()["data"]["reply"]


@pytest.mark.asyncio
async def test_score_unknown_returns_404(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _, token = seed_admin
    r = await client.post(f"/api/v1/clients/ai/{uuid.uuid4()}/score", headers=_auth(token))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_ai_requires_auth(client: AsyncClient) -> None:
    # Sans identité : require_roles refuse (403) avant la vérif tenant (401).
    r = await client.post("/api/v1/clients/ai/insights")
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_ai_forbidden_for_client_role(
    client: AsyncClient, seed_company: Company, db_session: AsyncSession
) -> None:
    token = await _make_user_token(db_session, seed_company, UserRole.CLIENT.value)
    r = await client.post("/api/v1/clients/ai/insights", headers=_auth(token))
    assert r.status_code == 403


# ── Chemin d'enrichissement Gemini (monkeypatch) + health ──────────────────


@pytest.mark.asyncio
async def test_score_uses_gemini_when_available(
    seed_admin: tuple[User, str], db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_text(*a: object, **k: object) -> dict[str, str]:
        return {"text": "Résumé IA", "engine": "gemini-2.5-flash"}

    monkeypatch.setattr(ai_service.gemini, "generate_text", fake_text)
    admin, _ = seed_admin
    c = await create_client(
        db_session,
        admin.company_id,
        ClientCreate(type="individual", first_name="Z", budget_max=Decimal("2500000")),
    )
    out = await ai_service.client_score(db_session, admin.company_id, c.id, "fr")
    assert out is not None
    assert out["engine"] == "gemini-2.5-flash"
    assert out["narrative"] == "Résumé IA"


@pytest.mark.asyncio
async def test_insights_and_message_use_gemini(
    seed_admin: tuple[User, str], db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_text(*a: object, **k: object) -> dict[str, str]:
        return {"text": "Synthèse IA", "engine": "gemini-2.5-flash"}

    monkeypatch.setattr(ai_service.gemini, "generate_text", fake_text)
    admin, _ = seed_admin
    c = await create_client(
        db_session, admin.company_id, ClientCreate(type="individual", first_name="Y")
    )
    ins = await ai_service.client_insights(db_session, admin.company_id, "ar")
    assert ins["engine"] == "gemini-2.5-flash"
    msg = await ai_service.client_message(
        db_session, admin.company_id, c.id, "email", "en", "welcome"
    )
    assert msg is not None and msg["engine"] == "gemini-2.5-flash"


@pytest.mark.asyncio
async def test_chat_uses_gemini(
    seed_admin: tuple[User, str], db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_chat(*a: object, **k: object) -> dict[str, str]:
        return {"text": "Réponse IA", "engine": "gemini-2.5-flash"}

    monkeypatch.setattr(ai_service.gemini, "generate_chat", fake_chat)
    admin, _ = seed_admin
    out = await ai_service.client_chat(
        db_session, admin.company_id, [{"role": "user", "content": "salut"}], "fr"
    )
    assert out["engine"] == "gemini-2.5-flash"
    assert out["reply"] == "Réponse IA"


@pytest.mark.asyncio
async def test_health_public(client: AsyncClient) -> None:
    r = await client.get("/api/v1/clients/ai/health")
    assert r.status_code == 200
    assert r.json()["module"] == "clients-ai"
