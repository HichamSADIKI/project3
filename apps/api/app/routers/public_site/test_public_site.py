"""Tests — vitrine immobilière publique (`public_site`).

Deux couches :
- **Helpers purs** (`slugify`) — sans DB, rapides, partout.
- **Intégration HTTP** via le harness `conftest` (Postgres réel, en conteneur).
  Couvre : résolution tenant fail-safe (slug vide), listings published-only,
  isolation multi-tenant (Loi 1 — les annonces d'un 2ᵉ tenant ne sortent JAMAIS),
  non-fuite (aucun champ interne/financier), capture de lead → CRMLead
  `source=public:*` + dédup client, et anti-injection (input malformé → 422,
  jamais 500).

⚠️ Les tests d'intégration exigent PostgreSQL : `docker compose exec api uv run
pytest app/routers/public_site/test_public_site.py`.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import encode_jwt
from app.core.config import settings
from app.models.company import Company
from app.models.crm import CRMLead
from app.models.user import User
from app.routers.leasing.models import RentalListing
from app.routers.public_site import service

# ─────────────────────────────────────────────────────────────────────────
# Helpers purs — slugify (aucune DB)
# ─────────────────────────────────────────────────────────────────────────


def test_slugify_basic() -> None:
    assert service.slugify("Villa de Luxe à Dubaï") == "villa-de-luxe-a-dubai"


def test_slugify_collapses_separators_and_trims() -> None:
    assert service.slugify("  Marina   View!! — 2BR  ") == "marina-view-2br"


def test_slugify_strips_non_ascii_and_symbols() -> None:
    assert service.slugify("Tour #12 / Étage @ 5") == "tour-12-etage-5"


def test_slugify_empty_and_none_safe() -> None:
    assert service.slugify("") == ""
    assert service.slugify("***") == ""


# ─────────────────────────────────────────────────────────────────────────
# Fixtures intégration
# ─────────────────────────────────────────────────────────────────────────


async def _make_published_rental(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    slug: str,
    status: str = "published",
    is_featured: bool = False,
    is_urgent: bool = False,
) -> RentalListing:
    listing = RentalListing(
        id=uuid.uuid4(),
        company_id=company_id,
        reference=f"RNT-{uuid.uuid4().hex[:8]}",
        unit_id=None,
        title_en="Marina View Apartment",
        title_fr="Appartement vue Marina",
        title_ar="شقة بإطلالة على المارينا",
        monthly_rent=Decimal("10000.00"),
        annual_rent=Decimal("120000.00"),
        status=status,
        slug=slug,
        is_featured=is_featured,
        is_urgent=is_urgent,
    )
    db.add(listing)
    await db.commit()
    return listing


@pytest_asyncio.fixture
async def public_company(db_session: AsyncSession):
    """Crée la société 'vitrine' + pointe PUBLIC_SITE_COMPANY_SLUG dessus.

    Restaure le réglage après le test (les autres tests voient slug vide).
    """
    company = Company(
        id=uuid.uuid4(),
        name="Vitrine Co",
        slug=f"vitrine-{uuid.uuid4().hex[:8]}",
        plan="pro",
        is_active=True,
    )
    db_session.add(company)
    await db_session.commit()
    await db_session.refresh(company)
    previous = settings.PUBLIC_SITE_COMPANY_SLUG
    settings.PUBLIC_SITE_COMPANY_SLUG = company.slug
    try:
        yield company
    finally:
        settings.PUBLIC_SITE_COMPANY_SLUG = previous


# ─────────────────────────────────────────────────────────────────────────
# Fail-safe — slug non configuré
# ─────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_listings_empty_when_slug_unset(client: AsyncClient) -> None:
    settings.PUBLIC_SITE_COMPANY_SLUG = ""
    res = await client.get("/api/v1/public/listings")
    assert res.status_code == 200
    body = res.json()
    assert body["data"] == []
    assert body["meta"]["total"] == 0


@pytest.mark.asyncio
async def test_detail_404_when_slug_unset(client: AsyncClient) -> None:
    settings.PUBLIC_SITE_COMPANY_SLUG = ""
    res = await client.get("/api/v1/public/listings/anything")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_lead_silent_ack_when_slug_unset(client: AsyncClient) -> None:
    settings.PUBLIC_SITE_COMPANY_SLUG = ""
    res = await client.post(
        "/api/v1/public/leads",
        json={"contact": {"name": "Jane", "email": "jane@example.com"}},
    )
    assert res.status_code == 201
    assert res.json()["data"]["received"] is True


# ─────────────────────────────────────────────────────────────────────────
# Listings published-only
# ─────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_listings_returns_only_published(
    client: AsyncClient, db_session: AsyncSession, public_company: Company
) -> None:
    await _make_published_rental(db_session, public_company.id, slug="pub-1")
    await _make_published_rental(db_session, public_company.id, slug="draft-1", status="draft")

    res = await client.get("/api/v1/public/listings")
    assert res.status_code == 200
    slugs = {item["slug"] for item in res.json()["data"]}
    assert "pub-1" in slugs
    assert "draft-1" not in slugs


# ─────────────────────────────────────────────────────────────────────────
# Isolation multi-tenant (Loi 1) — la RLS reste active sans JWT
# ─────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_other_tenant_listings_never_visible(
    client: AsyncClient,
    db_session: AsyncSession,
    public_company: Company,
    second_admin: tuple[Company, str],
) -> None:
    other_company, _token = second_admin
    # Annonce publiée du tenant public + annonce publiée d'un AUTRE tenant.
    await _make_published_rental(db_session, public_company.id, slug="mine-published")
    await _make_published_rental(db_session, other_company.id, slug="other-published")

    res = await client.get("/api/v1/public/listings")
    assert res.status_code == 200
    slugs = {item["slug"] for item in res.json()["data"]}
    assert "mine-published" in slugs
    assert "other-published" not in slugs

    # Le détail d'une annonce d'un autre tenant est introuvable (404, pas de fuite).
    detail = await client.get("/api/v1/public/listings/other-published")
    assert detail.status_code == 404


# ─────────────────────────────────────────────────────────────────────────
# Non-fuite — aucun champ interne/financier dans la sortie
# ─────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_listing_output_has_no_internal_fields(
    client: AsyncClient, db_session: AsyncSession, public_company: Company
) -> None:
    await _make_published_rental(db_session, public_company.id, slug="leak-check")
    res = await client.get("/api/v1/public/listings")
    item = res.json()["data"][0]
    forbidden = {
        "company_id",
        "owner_client_id",
        "mandate_id",
        "unit_id",
        "monthly_rent",
        "commission_rate",
        "commission_amount",
        "agent_id",
        "internal_notes",
        "created_at",
    }
    assert forbidden.isdisjoint(item.keys())


# ─────────────────────────────────────────────────────────────────────────
# Capture de lead — CRMLead source=public:* + dédup
# ─────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_lead_creates_crm_lead_with_public_source(
    client: AsyncClient, db_session: AsyncSession, public_company: Company
) -> None:
    await _make_published_rental(db_session, public_company.id, slug="for-lead")
    email = f"buyer-{uuid.uuid4().hex[:8]}@example.com"

    res = await client.post(
        "/api/v1/public/leads",
        json={
            "contact": {"name": "Buyer", "email": email, "phone": "+971501234567"},
            "listing_slug": "for-lead",
            "message": "I want a visit",
        },
    )
    assert res.status_code == 201

    leads = (
        (
            await db_session.execute(
                select(CRMLead).where(
                    CRMLead.company_id == public_company.id,
                    CRMLead.source == "public:for-lead",
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(leads) == 1
    assert leads[0].category == "realestate"
    assert leads[0].notes == "I want a visit"


@pytest.mark.asyncio
async def test_lead_dedups_client_on_same_email(
    client: AsyncClient, db_session: AsyncSession, public_company: Company
) -> None:
    email = f"dedup-{uuid.uuid4().hex[:8]}@example.com"
    payload = {"contact": {"name": "Dup", "email": email}}

    r1 = await client.post("/api/v1/public/leads", json=payload)
    r2 = await client.post("/api/v1/public/leads", json=payload)
    assert r1.status_code == 201
    assert r2.status_code == 201

    leads = (
        (await db_session.execute(select(CRMLead).where(CRMLead.company_id == public_company.id)))
        .scalars()
        .all()
    )
    # Deux leads possibles, mais un SEUL client (dédup find_or_create_client).
    client_ids = {lead.client_id for lead in leads}
    assert len(client_ids) == 1


# ─────────────────────────────────────────────────────────────────────────
# Anti-injection / input malformé → 422, jamais 500
# ─────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_lead_rejects_invalid_phone(client: AsyncClient, public_company: Company) -> None:
    res = await client.post(
        "/api/v1/public/leads",
        json={"contact": {"name": "X", "phone": "DROP TABLE users; --"}},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_lead_rejects_bad_email(client: AsyncClient, public_company: Company) -> None:
    res = await client.post(
        "/api/v1/public/leads",
        json={"contact": {"name": "X", "email": "not-an-email"}},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_lead_requires_contact_means(client: AsyncClient, public_company: Company) -> None:
    # Ni email ni téléphone → 422 (contact inexploitable).
    res = await client.post(
        "/api/v1/public/leads",
        json={"contact": {"name": "Anonymous"}},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_lead_missing_contact_block_is_422_not_500(
    client: AsyncClient, public_company: Company
) -> None:
    # Payload plat (sans 'contact') → Pydantic rejette proprement, jamais 500.
    res = await client.post(
        "/api/v1/public/leads",
        json={"name": "Flat", "email": "flat@example.com"},
    )
    assert res.status_code == 422


# ─────────────────────────────────────────────────────────────────────────
# Profils agents publics
# ─────────────────────────────────────────────────────────────────────────


async def _make_agent(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    full_name: str,
    role: str = "agent",
) -> User:
    agent = User(
        id=uuid.uuid4(),
        company_id=company_id,
        email=f"agent-{uuid.uuid4().hex[:10]}@example.com",
        hashed_password="!disabled",
        full_name=full_name,
        role=role,
        status="active",
        is_active=True,
        preferred_language="en",
        phone="+97142030000",
        whatsapp="+971563690000",
        photo_url="https://example.com/a.jpg",
        title="Senior Consultant",
        bio="Expert immobilier Dubaï.",
    )
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent


@pytest.mark.asyncio
async def test_agents_list_exposes_no_sensitive_field(
    client: AsyncClient, db_session: AsyncSession, public_company: Company
) -> None:
    await _make_agent(db_session, public_company.id, full_name="Ahmed Public")
    res = await client.get("/api/v1/public/agents")
    assert res.status_code == 200
    data = res.json()["data"]
    assert len(data) == 1
    item = data[0]
    assert item["name"] == "Ahmed Public"
    # Aucune fuite : ni hash, ni MFA, ni company_id, ni email_verifié interne.
    forbidden = {
        "hashed_password",
        "mfa_secret",
        "mfa_enabled",
        "company_id",
        "is_active",
        "status",
    }
    assert forbidden.isdisjoint(item.keys()), f"fuite champ sensible : {item.keys()}"


@pytest.mark.asyncio
async def test_agent_detail_returns_profile_and_agency_listings(
    client: AsyncClient, db_session: AsyncSession, public_company: Company
) -> None:
    await _make_agent(db_session, public_company.id, full_name="Sara Detail")
    await _make_published_rental(db_session, public_company.id, slug="agent-listing-1")
    slug = (await client.get("/api/v1/public/agents")).json()["data"][0]["slug"]

    res = await client.get(f"/api/v1/public/agents/{slug}")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["data"]["name"] == "Sara Detail"
    assert body["data"]["bio"] is not None
    assert any(item["slug"] == "agent-listing-1" for item in body["listings"])


@pytest.mark.asyncio
async def test_agent_detail_unknown_slug_404(
    client: AsyncClient, db_session: AsyncSession, public_company: Company
) -> None:
    res = await client.get("/api/v1/public/agents/does-not-exist")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_agents_other_tenant_never_visible(
    client: AsyncClient,
    db_session: AsyncSession,
    public_company: Company,
    second_admin: tuple[Company, str],
) -> None:
    other_company, _token = second_admin
    await _make_agent(db_session, public_company.id, full_name="Mine Visible")
    await _make_agent(db_session, other_company.id, full_name="Other Hidden")
    names = {a["name"] for a in (await client.get("/api/v1/public/agents")).json()["data"]}
    assert "Mine Visible" in names
    assert "Other Hidden" not in names  # isolation mono-agence


@pytest.mark.asyncio
async def test_agents_empty_when_slug_unset(client: AsyncClient) -> None:
    settings.PUBLIC_SITE_COMPANY_SLUG = ""
    res = await client.get("/api/v1/public/agents")
    assert res.status_code == 200
    assert res.json()["data"] == []


# ─────────────────────────────────────────────────────────────────────────
# Recherche par mot-clé (Meili + repli DB)
# ─────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_search_q_matches_keyword(
    client: AsyncClient, db_session: AsyncSession, public_company: Company
) -> None:
    # Les données de test ne sont pas dans l'index Meili (société dédiée) → le
    # repli DB substring s'applique : la recherche reste déterministe et isolée.
    await _make_published_rental(db_session, public_company.id, slug="marina-search-1")
    res = await client.get("/api/v1/public/listings?q=marina")
    assert res.status_code == 200, res.text
    slugs = {x["slug"] for x in res.json()["data"]}
    assert "marina-search-1" in slugs


@pytest.mark.asyncio
async def test_search_q_no_match_is_empty(
    client: AsyncClient, db_session: AsyncSession, public_company: Company
) -> None:
    await _make_published_rental(db_session, public_company.id, slug="marina-search-2")
    res = await client.get("/api/v1/public/listings?q=zzznomatchxyz")
    assert res.status_code == 200
    assert res.json()["data"] == []


# ─────────────────────────────────────────────────────────────────────────
# Design du site public — helper pur `resolve_active_design`
# ─────────────────────────────────────────────────────────────────────────


def test_resolve_design_manual_is_fixed() -> None:
    active, nxt, nin = service.resolve_active_design(
        "manual", "facebook", 6, None, datetime.now(UTC)
    )
    assert active == "facebook"
    assert nxt is None and nin is None


def test_resolve_design_auto_without_anchor_is_fixed() -> None:
    # Mode auto mais sans ancre → comportement figé (fail-safe).
    active, nxt, nin = service.resolve_active_design("auto", "snapchat", 6, None, datetime.now(UTC))
    assert active == "snapchat" and nxt is None and nin is None


def test_resolve_design_auto_rotation_cycle() -> None:
    since = datetime(2026, 1, 1, 0, 0, 0, tzinfo=UTC)
    # Ordre : instagram → snapchat → facebook, délai 6h.
    a0, n0, s0 = service.resolve_active_design("auto", "instagram", 6, since, since)
    assert a0 == "instagram" and n0 == "snapchat" and s0 == 6 * 3600
    a1, _, _ = service.resolve_active_design(
        "auto", "instagram", 6, since, since + timedelta(hours=7)
    )
    assert a1 == "snapchat"
    a2, _, _ = service.resolve_active_design(
        "auto", "instagram", 6, since, since + timedelta(hours=13)
    )
    assert a2 == "facebook"
    # Boucle : +19h → retour à instagram.
    a3, _, s3 = service.resolve_active_design(
        "auto", "instagram", 6, since, since + timedelta(hours=19)
    )
    assert a3 == "instagram" and 0 < s3 <= 6 * 3600


# ─────────────────────────────────────────────────────────────────────────
# Design — endpoint PUBLIC (sans JWT)
# ─────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_public_design_default_when_slug_unset(client: AsyncClient) -> None:
    settings.PUBLIC_SITE_COMPANY_SLUG = ""
    res = await client.get("/api/v1/public/site-design")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["active"] == "instagram"
    assert data["mode"] == "manual"


@pytest.mark.asyncio
async def test_public_design_reflects_company_setting(
    client: AsyncClient,
    db_session: AsyncSession,
    public_company: Company,
) -> None:
    await service.upsert_site_design(
        db_session, public_company.id, mode="manual", style="facebook", delay_hours=6
    )
    res = await client.get("/api/v1/public/site-design")
    assert res.status_code == 200
    assert res.json()["data"]["active"] == "facebook"


# ─────────────────────────────────────────────────────────────────────────
# Design — endpoints ADMIN (authentifiés, company-scopés)
# ─────────────────────────────────────────────────────────────────────────


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_admin_design_get_default_then_put_roundtrip(
    client: AsyncClient,
    seed_admin: tuple[User, str],
) -> None:
    _admin, token = seed_admin
    r = await client.get("/api/v1/site-design", headers=_auth(token))
    assert r.status_code == 200
    assert r.json()["data"]["active"] == "instagram"  # défaut

    r2 = await client.put(
        "/api/v1/site-design",
        headers=_auth(token),
        json={"mode": "manual", "style": "snapchat", "delay_hours": 6},
    )
    assert r2.status_code == 200
    assert r2.json()["data"]["style"] == "snapchat"

    r3 = await client.get("/api/v1/site-design", headers=_auth(token))
    assert r3.json()["data"]["style"] == "snapchat"


@pytest.mark.asyncio
async def test_admin_design_auto_mode_sets_rotation(
    client: AsyncClient,
    seed_admin: tuple[User, str],
) -> None:
    _admin, token = seed_admin
    r = await client.put(
        "/api/v1/site-design",
        headers=_auth(token),
        json={"mode": "auto", "style": "instagram", "delay_hours": 6},
    )
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["mode"] == "auto"
    # En auto, le style actif est résolu + une bascule est planifiée.
    assert data["active"] in service.SITE_DESIGN_STYLES
    assert data["next"] in service.SITE_DESIGN_STYLES
    assert data["next_in_seconds"] is not None and data["next_in_seconds"] > 0


@pytest.mark.asyncio
async def test_admin_design_rejects_invalid_input(
    client: AsyncClient,
    seed_admin: tuple[User, str],
) -> None:
    _admin, token = seed_admin
    bad_mode = await client.put(
        "/api/v1/site-design",
        headers=_auth(token),
        json={"mode": "weird", "style": "snapchat", "delay_hours": 6},
    )
    assert bad_mode.status_code == 422
    bad_delay = await client.put(
        "/api/v1/site-design",
        headers=_auth(token),
        json={"mode": "auto", "style": "snapchat", "delay_hours": 999},
    )
    assert bad_delay.status_code == 422
    bad_style = await client.put(
        "/api/v1/site-design",
        headers=_auth(token),
        json={"mode": "manual", "style": "tiktok", "delay_hours": 6},
    )
    assert bad_style.status_code == 422


@pytest.mark.asyncio
async def test_admin_design_requires_auth(client: AsyncClient) -> None:
    r = await client.get("/api/v1/site-design")
    assert r.status_code in (401, 403)


# ── Loi 1 — isolation multi-tenant déterministe ──────────────────────────


@pytest.mark.asyncio
async def test_design_tenant_isolation(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
) -> None:
    """Chaque société ne voit/écrit QUE son propre réglage (RLS + company_id)."""
    _admin, token = seed_admin
    _other_company, other_token = second_admin

    await client.put(
        "/api/v1/site-design",
        headers=_auth(token),
        json={"mode": "manual", "style": "facebook", "delay_hours": 6},
    )
    await client.put(
        "/api/v1/site-design",
        headers=_auth(other_token),
        json={"mode": "manual", "style": "instagram", "delay_hours": 6},
    )

    mine = await client.get("/api/v1/site-design", headers=_auth(token))
    theirs = await client.get("/api/v1/site-design", headers=_auth(other_token))
    assert mine.json()["data"]["style"] == "facebook"
    assert theirs.json()["data"]["style"] == "instagram"


@pytest.mark.asyncio
async def test_admin_design_malformed_company_id_is_401(client: AsyncClient) -> None:
    # JWT bien signé mais company_id non-UUID → 401 (jamais 500).
    tok = encode_jwt(
        {"sub": str(uuid.uuid4()), "company_id": "not-a-uuid", "role": "admin", "status": "active"}
    )
    r = await client.get("/api/v1/site-design", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 401
