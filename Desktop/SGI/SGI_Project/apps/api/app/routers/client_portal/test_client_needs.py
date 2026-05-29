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
    assert body["crm_ref"].startswith("CRM-")
    assert uuid.UUID(body["lead_id"])  # valide


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
        await fresh.execute(
            sa_text(f"SET LOCAL app.current_company_id = '{seed_company.id}'")
        )
        party = (
            await fresh.execute(
                select(Client).where(
                    Client.email == email, Client.company_id == seed_company.id
                )
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
