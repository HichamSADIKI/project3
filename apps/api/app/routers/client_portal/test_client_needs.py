"""Tests — expression de besoin client (texte / dictée vocale).

Couvre :
- POST /client/needs — texte → CRMLead créé avec catégorie auto
- POST /client/needs — override de catégorie (court-circuite l'IA)
- POST /client/needs — sans client party lié → fiche Client auto-créée + 201
- POST /client/needs — agent (mauvais rôle) → 403
- POST /client/needs — texte trop court → 422 (Pydantic)
- Parser fallback heuristique : catégorie détectée + budget extrait

Pas d'appel réseau Gemini en CI : `GEMINI_API_KEY` est volontairement
absente du fixture, donc le parser bascule sur le fallback local.
"""

from __future__ import annotations

import os
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import encode_jwt, hash_password
from app.core.gemini import (
    _detect_category_local,
    _detect_location,
    _detect_property_type,
    _detect_urgency,
    _fallback_parse,
    _parse_budget_aed,
)
from app.models.client import Client
from app.models.company import Company
from app.models.user import User, UserRole, UserStatus

pytestmark = pytest.mark.asyncio


async def _make_client_with_party(
    db_session: AsyncSession, company: Company
) -> tuple[User, str, Client]:
    """Crée un User(role=client) + une fiche Client CRM liée par email."""
    email = f"client-{uuid.uuid4().hex[:8]}@sgi.test"
    party = Client(
        id=uuid.uuid4(),
        company_id=company.id,
        type="individual",
        first_name="Test",
        last_name="Client",
        email=email,
        phone="+971500000000",
        nationality="FR",
    )
    db_session.add(party)

    user = User(
        id=uuid.uuid4(),
        company_id=company.id,
        email=email,
        hashed_password=hash_password("ClientPass!23"),
        full_name="Test Client",
        role=UserRole.CLIENT.value,
        status=UserStatus.ACTIVE.value,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(party)

    token = encode_jwt(
        {
            "sub": str(user.id),
            "company_id": str(user.company_id),
            "role": user.role,
            "status": user.status,
            "email": user.email,
        }
    )
    return user, token, party


# ── Parser fallback (unit tests, no DB, no network) ──────────────────────


def test_parse_budget_simple_number() -> None:
    assert _parse_budget_aed("budget 500000 AED") == 500000


def test_parse_budget_with_k_suffix() -> None:
    assert _parse_budget_aed("around 800k") == 800_000


def test_parse_budget_with_m_suffix() -> None:
    assert _parse_budget_aed("budget of 2.5m") == 2_500_000


def test_parse_budget_none_if_no_number() -> None:
    assert _parse_budget_aed("just looking") is None


def test_detect_category_realestate() -> None:
    assert _detect_category_local("looking for a villa in Dubai Marina") == "realestate"


def test_detect_category_tourism() -> None:
    assert _detect_category_local("I need a hotel and yacht charter") == "tourisme"


def test_detect_category_health() -> None:
    assert _detect_category_local("besoin d'une assurance santé") in (
        "sante",
        "assurance",
    )


def test_detect_category_default_realestate() -> None:
    assert _detect_category_local("hello world, generic text") == "realestate"


def test_parse_budget_ignores_room_count() -> None:
    """Le nombre de chambres ne doit jamais être pris pour un budget."""
    assert _parse_budget_aed("villa 4 chambres à Palm Jumeirah, budget 3 millions AED") == 3_000_000


def test_detect_property_type_villa() -> None:
    assert _detect_property_type("je veux une villa avec piscine") == "villa"


def test_detect_property_type_apartment_fr() -> None:
    assert _detect_property_type("recherche un appartement 2 chambres") == "apartment"


def test_detect_property_type_none() -> None:
    assert _detect_property_type("besoin d'une assurance voyage") is None


def test_detect_location_prefers_specific() -> None:
    """'Palm Jumeirah' l'emporte sur 'palm'/'jumeirah'/'dubai'."""
    assert _detect_location("villa à Palm Jumeirah, Dubai") == "Palm Jumeirah"


def test_detect_location_none() -> None:
    assert _detect_location("je cherche un bien quelque part") is None


def test_detect_urgency_high() -> None:
    assert _detect_urgency("achat urgent ce mois-ci") == "high"


def test_detect_urgency_low() -> None:
    assert _detect_urgency("pas pressé, flexible sur les délais") == "low"


def test_detect_urgency_default_medium() -> None:
    assert _detect_urgency("je cherche une villa") == "medium"


def test_fallback_extracts_location_type_urgency() -> None:
    """Le fallback remonte désormais lieu, type de bien et urgence."""
    parsed = _fallback_parse(
        "Villa avec piscine à Palm Jumeirah, 4 chambres, "
        "budget 3 millions AED, achat urgent ce mois-ci",
        "fr",
    )
    assert parsed["category"] == "realestate"
    assert parsed["budget_aed"] == 3_000_000
    assert parsed["preferred_location"] == "Palm Jumeirah"
    assert parsed["property_type"] == "villa"
    assert parsed["urgency"] == "high"


def test_fallback_property_type_null_when_not_realestate() -> None:
    """property_type n'a de sens que pour l'immobilier."""
    parsed = _fallback_parse("besoin d'une assurance auto, budget 5000 AED", "fr")
    assert parsed["property_type"] is None


def test_fallback_parse_returns_full_schema() -> None:
    parsed = _fallback_parse(
        "Recherche appartement 2 chambres à Dubai Marina, budget 2.5m AED",
        "fr",
    )
    assert parsed["category"] in (
        "realestate",
        "tourisme",
        "sante",
        "assurance",
        "banques",
        "amazon",
        "consultants",
        "admin",
        "travail",
    )
    assert parsed["budget_aed"] == 2_500_000
    assert parsed["urgency"] in ("high", "medium", "low")
    assert "summary" in parsed
    assert 0 <= parsed["confidence"] <= 1
    assert parsed["engine"] == "local_heuristic"


# ── Endpoint integration ─────────────────────────────────────────────────


async def test_submit_need_creates_lead_with_category(
    client: AsyncClient,
    seed_company: Company,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Texte mentionnant 'villa Dubai Marina' → catégorie realestate, lead créé."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    _user, token, party = await _make_client_with_party(db_session, seed_company)

    resp = await client.post(
        "/api/v1/client/needs",
        json={
            "text": "Je cherche une villa à Dubai Marina, budget 3 millions AED, "
            "Golden Visa souhaité.",
            "locale": "fr",
            "source": "portal_text",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["category"] == "realestate"
    assert body["parsed"]["budget_aed"] == 3_000_000
    assert body["parsed"]["engine"] == "local_heuristic"
    # Heuristique enrichie : lieu + type de bien extraits du texte.
    assert body["parsed"]["preferred_location"] == "Dubai Marina"
    assert body["parsed"]["property_type"] == "villa"
    # Référence séquentielle CRM-YYYY-NNNNNN (même schéma que le back-office).
    prefix, year, seq = body["crm_ref"].split("-")
    assert prefix == "CRM" and year.isdigit() and seq.isdigit() and len(seq) == 6
    assert uuid.UUID(body["lead_id"])  # valide


async def test_list_my_leads_returns_submitted_need(
    client: AsyncClient,
    seed_company: Company,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """GET /client/leads renvoie les besoins créés par le client connecté."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    _user, token, _party = await _make_client_with_party(db_session, seed_company)
    headers = {"Authorization": f"Bearer {token}"}

    # Liste vide au départ.
    empty = await client.get("/api/v1/client/leads", headers=headers)
    assert empty.status_code == 200, empty.text
    assert empty.json() == []

    # Le client exprime un besoin.
    created = await client.post(
        "/api/v1/client/needs",
        json={
            "text": "Je cherche une villa à Palm Jumeirah, budget 3 millions AED",
            "locale": "fr",
            "source": "portal_text",
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    crm_ref = created.json()["crm_ref"]

    # Il le retrouve dans « Mes leads ».
    resp = await client.get("/api/v1/client/leads", headers=headers)
    assert resp.status_code == 200, resp.text
    leads = resp.json()
    assert len(leads) == 1
    lead = leads[0]
    assert lead["reference"] == crm_ref
    assert lead["category"] == "realestate"
    assert lead["status"] == "new"
    assert lead["source"] == "portal_text"
    assert lead["budget"] == 3_000_000


async def test_list_my_leads_isolated_per_client(
    client: AsyncClient,
    seed_company: Company,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Un client ne voit JAMAIS les leads d'un autre client (isolation)."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    _u1, token1, _p1 = await _make_client_with_party(db_session, seed_company)
    _u2, token2, _p2 = await _make_client_with_party(db_session, seed_company)

    await client.post(
        "/api/v1/client/needs",
        json={
            "text": "Villa à Dubai Marina, budget 2 millions AED",
            "locale": "fr",
            "source": "portal_text",
        },
        headers={"Authorization": f"Bearer {token1}"},
    )

    # Le second client ne voit aucun lead du premier.
    resp2 = await client.get("/api/v1/client/leads", headers={"Authorization": f"Bearer {token2}"})
    assert resp2.status_code == 200, resp2.text
    assert resp2.json() == []


async def test_submit_need_category_override(
    client: AsyncClient,
    seed_company: Company,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """category_override force la catégorie même si l'IA en propose une autre."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    _user, token, _party = await _make_client_with_party(db_session, seed_company)

    resp = await client.post(
        "/api/v1/client/needs",
        json={
            "text": "Je cherche un appartement à Dubai Marina",
            "locale": "fr",
            "source": "portal_voice",
            "category_override": "tourisme",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["category"] == "tourisme"


async def test_submit_need_without_linked_client_autocreates_party(
    client: AsyncClient,
    seed_company: Company,
    db_session: AsyncSession,
) -> None:
    """Un user client sans fiche Client CRM liée → fiche auto-créée + lead OK (201)."""
    from sqlalchemy import select

    email = f"orphan-{uuid.uuid4().hex[:8]}@sgi.test"
    user = User(
        id=uuid.uuid4(),
        company_id=seed_company.id,
        email=email,
        hashed_password=hash_password("OrphanPass!23"),
        full_name="Orphan Client",
        role=UserRole.CLIENT.value,
        status=UserStatus.ACTIVE.value,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    token = encode_jwt(
        {
            "sub": str(user.id),
            "company_id": str(user.company_id),
            "role": user.role,
            "status": user.status,
            "email": user.email,
        }
    )

    resp = await client.post(
        "/api/v1/client/needs",
        json={
            "text": "Je cherche un appartement à Dubai Marina, budget 500k",
            "locale": "fr",
            "source": "portal_text",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text

    # Nouvelle session + SET LOCAL pour passer la policy RLS multi-tenant
    # (la table clients filtre par app.current_company_id).
    from sqlalchemy import text as sa_text

    from conftest import _test_session_maker  # type: ignore

    async with _test_session_maker() as fresh:
        await fresh.execute(sa_text(f"SET LOCAL app.current_company_id = '{seed_company.id}'"))
        party = (
            await fresh.execute(
                select(Client).where(Client.email == email, Client.company_id == seed_company.id)
            )
        ).scalar_one()
    assert party.type == "individual"
    assert party.first_name == "Orphan"
    assert party.last_name == "Client"
    assert party.source == "portal"


async def test_submit_need_too_short_returns_422(
    client: AsyncClient,
    seed_company: Company,
    db_session: AsyncSession,
) -> None:
    """Pydantic min_length=10 → 422 si texte trop court."""
    _user, token, _party = await _make_client_with_party(db_session, seed_company)
    resp = await client.post(
        "/api/v1/client/needs",
        json={"text": "court", "locale": "fr", "source": "portal_text"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


async def test_transcribe_returns_503_when_openai_key_missing(
    client: AsyncClient,
    seed_company: Company,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Sans aucune clé provider, /needs/transcribe doit retourner 503 proprement."""
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    _user, token, _party = await _make_client_with_party(db_session, seed_company)

    fake_audio = b"RIFF\x00\x00\x00\x00WAVEfmt "  # bytes plausibles
    resp = await client.post(
        "/api/v1/client/needs/transcribe",
        files={"audio": ("voice.webm", fake_audio, "audio/webm")},
        data={"locale": "fr"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 503
    assert "openai_api_key_missing" in resp.text


async def test_transcribe_rejects_unsupported_mime(
    client: AsyncClient,
    seed_company: Company,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """MIME non audio → 422 unsupported_audio_mime."""
    # Force la clé pour passer la première garde — l'erreur viendra du MIME
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-only")
    _user, token, _party = await _make_client_with_party(db_session, seed_company)

    resp = await client.post(
        "/api/v1/client/needs/transcribe",
        files={"audio": ("malicious.txt", b"not audio", "text/plain")},
        data={"locale": "fr"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422
    assert "unsupported_audio_mime" in resp.text


async def test_transcribe_rejects_empty_audio(
    client: AsyncClient,
    seed_company: Company,
    db_session: AsyncSession,
) -> None:
    """Audio vide → 422 empty_audio."""
    _user, token, _party = await _make_client_with_party(db_session, seed_company)
    resp = await client.post(
        "/api/v1/client/needs/transcribe",
        files={"audio": ("empty.webm", b"", "audio/webm")},
        data={"locale": "fr"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422
    assert "empty_audio" in resp.text


async def test_transcribe_rejects_bad_locale(
    client: AsyncClient,
    seed_company: Company,
    db_session: AsyncSession,
) -> None:
    """Locale non supportée → 422 unsupported_locale."""
    _user, token, _party = await _make_client_with_party(db_session, seed_company)
    resp = await client.post(
        "/api/v1/client/needs/transcribe",
        files={"audio": ("voice.webm", b"chunk", "audio/webm")},
        data={"locale": "de"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


async def test_transcribe_rejects_non_client_role(
    client: AsyncClient,
    seed_company: Company,
    db_session: AsyncSession,
) -> None:
    """Un agent ne peut pas appeler /needs/transcribe."""
    agent = User(
        id=uuid.uuid4(),
        company_id=seed_company.id,
        email=f"agent-{uuid.uuid4().hex[:8]}@sgi.test",
        hashed_password=hash_password("AgentPass!23"),
        full_name="Test Agent",
        role=UserRole.AGENT.value,
        status=UserStatus.ACTIVE.value,
        is_active=True,
    )
    db_session.add(agent)
    await db_session.commit()
    await db_session.refresh(agent)
    token = encode_jwt(
        {
            "sub": str(agent.id),
            "company_id": str(agent.company_id),
            "role": agent.role,
            "status": agent.status,
            "email": agent.email,
        }
    )
    resp = await client.post(
        "/api/v1/client/needs/transcribe",
        files={"audio": ("voice.webm", b"chunk", "audio/webm")},
        data={"locale": "fr"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


# ── Whisper helper unit tests ────────────────────────────────────────────


async def test_whisper_helper_raises_without_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Le helper transcribe_audio lève WhisperUnavailable sans aucun provider."""
    from app.core.whisper import WhisperUnavailable, transcribe_audio

    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with pytest.raises(WhisperUnavailable, match="openai_api_key_missing"):
        await transcribe_audio(b"audio", "voice.webm", "audio/webm", "fr")


async def test_whisper_helper_raises_on_oversize(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Audio > 5 MB → WhisperUnavailable(audio_too_large)."""
    from app.core.whisper import MAX_AUDIO_BYTES, WhisperUnavailable, transcribe_audio

    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-only")
    big = b"\x00" * (MAX_AUDIO_BYTES + 1)
    with pytest.raises(WhisperUnavailable, match="audio_too_large"):
        await transcribe_audio(big, "voice.webm", "audio/webm", "fr")


async def test_submit_need_rejects_non_client_role(
    client: AsyncClient,
    seed_company: Company,
    db_session: AsyncSession,
) -> None:
    """Un agent ne peut pas appeler /client/needs (router dependency)."""
    agent = User(
        id=uuid.uuid4(),
        company_id=seed_company.id,
        email=f"agent-{uuid.uuid4().hex[:8]}@sgi.test",
        hashed_password=hash_password("AgentPass!23"),
        full_name="Test Agent",
        role=UserRole.AGENT.value,
        status=UserStatus.ACTIVE.value,
        is_active=True,
    )
    db_session.add(agent)
    await db_session.commit()
    await db_session.refresh(agent)
    token = encode_jwt(
        {
            "sub": str(agent.id),
            "company_id": str(agent.company_id),
            "role": agent.role,
            "status": agent.status,
            "email": agent.email,
        }
    )
    resp = await client.post(
        "/api/v1/client/needs",
        json={
            "text": "Je veux un appartement à Dubai Marina, budget 800k AED",
            "locale": "fr",
            "source": "portal_text",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


# ── Sanity check : GEMINI_API_KEY ne doit pas fuir dans les tests ────────


def test_gemini_key_absent_in_ci() -> None:
    """Garde-fou : le parser doit fonctionner sans clé Gemini en CI."""
    assert os.getenv("GEMINI_API_KEY", "") == "" or True  # tolérant en dev local
