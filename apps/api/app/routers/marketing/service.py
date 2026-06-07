"""Service Marketing.

- **Helpers purs** (sans DB) : génération de référence + machine à états des
  campagnes + validation de canal.
- **Fonctions DB** : filtrées par company_id (Loi 1), CRUD campagnes, transitions,
  unités liées, métriques, KPIs, et la boucle de retour `inbound-lead` (→ CRM).
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.references import commit_with_reference_retry
from app.models.client import Client
from app.models.crm import CRMActivity, CRMLead
from app.routers.crm import service as crm_service
from app.routers.marketing.models import MarketingCampaign, MarketingCampaignUnit

# ─────────────────────────────────────────────────────────────────────────
# Helpers purs
# ─────────────────────────────────────────────────────────────────────────

# Canaux — alignés EXACTEMENT sur le CHECK constraint (migration 0036).
CAMPAIGN_CHANNELS: frozenset[str] = frozenset(
    {
        "social_facebook",
        "social_instagram",
        "social_linkedin",
        "portal_bayut",
        "portal_propertyfinder",
        "portal_dubizzle",
        "email",
        "other",
    }
)

# Statuts — alignés EXACTEMENT sur le CHECK constraint (migration 0036).
CAMPAIGN_STATUSES: frozenset[str] = frozenset(
    {"draft", "scheduled", "active", "paused", "completed", "cancelled"}
)

# Machine à états des campagnes.
_CAMPAIGN_TRANSITIONS: dict[str, frozenset[str]] = {
    "draft": frozenset({"scheduled", "active", "cancelled"}),
    "scheduled": frozenset({"active", "cancelled"}),
    "active": frozenset({"paused", "completed", "cancelled"}),
    "paused": frozenset({"active", "completed", "cancelled"}),
    # completed / cancelled = terminaux.
    "completed": frozenset(),
    "cancelled": frozenset(),
}


def generate_reference(year: int, sequence: int) -> str:
    """Référence triable : `MKT-2026-000042`."""
    return f"MKT-{year:04d}-{sequence:06d}"


def is_valid_channel(channel: str) -> bool:
    """Vrai si le canal fait partie des canaux supportés."""
    return channel in CAMPAIGN_CHANNELS


def is_valid_campaign_transition(current: str, target: str) -> bool:
    """Vrai si la transition de campagne `current -> target` est autorisée."""
    if current not in CAMPAIGN_STATUSES or target not in CAMPAIGN_STATUSES or current == target:
        return False
    return target in _CAMPAIGN_TRANSITIONS.get(current, frozenset())


# ─────────────────────────────────────────────────────────────────────────
# Fonctions DB — filtrées par company_id (Loi 1)
# ─────────────────────────────────────────────────────────────────────────


async def _next_reference(db: AsyncSession, company_id: uuid.UUID) -> str:
    year = datetime.now(UTC).year
    # Verrou consultatif transactionnel (libéré au COMMIT) : sérialise les
    # créations concurrentes → COUNT+INSERT race-free (plus de collision de réf.).
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:k))"),
        {"k": f"MKT:marketing_campaigns:{company_id}:{year}"},
    )
    result = await db.execute(
        select(func.count())
        .select_from(MarketingCampaign)
        .where(
            MarketingCampaign.company_id == company_id,
            MarketingCampaign.reference.like(f"MKT-{year:04d}-%"),
        )
    )
    return generate_reference(year, result.scalar_one() + 1)


# ── Campagnes ──────────────────────────────────────────────────────────────


async def create_campaign(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    name: str,
    channel: str,
    starts_on: date | None = None,
    ends_on: date | None = None,
    budget_aed: Decimal | None = None,
    notes: str | None = None,
) -> MarketingCampaign:
    campaign = MarketingCampaign(
        company_id=company_id,
        reference=await _next_reference(db, company_id),
        name=name,
        channel=channel,
        status="draft",
        starts_on=starts_on,
        ends_on=ends_on,
        budget_aed=budget_aed,
        notes=notes,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return campaign


async def get_campaign(
    db: AsyncSession, company_id: uuid.UUID, campaign_id: uuid.UUID
) -> MarketingCampaign | None:
    result = await db.execute(
        select(MarketingCampaign).where(
            MarketingCampaign.id == campaign_id,
            MarketingCampaign.company_id == company_id,
            MarketingCampaign.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def list_campaigns(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    status: str | None = None,
    channel: str | None = None,
) -> tuple[list[MarketingCampaign], int]:
    base = select(MarketingCampaign).where(
        MarketingCampaign.company_id == company_id,
        MarketingCampaign.deleted_at.is_(None),
    )
    if status:
        base = base.where(MarketingCampaign.status == status)
    if channel:
        base = base.where(MarketingCampaign.channel == channel)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    offset = (page - 1) * limit
    rows = (
        (
            await db.execute(
                base.order_by(MarketingCampaign.created_at.desc()).offset(offset).limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return list(rows), total


async def update_campaign(
    db: AsyncSession,
    company_id: uuid.UUID,
    campaign_id: uuid.UUID,
    *,
    name: str | None = None,
    starts_on: date | None = None,
    ends_on: date | None = None,
    budget_aed: Decimal | None = None,
    spend_aed: Decimal | None = None,
    notes: str | None = None,
) -> MarketingCampaign | None:
    campaign = await get_campaign(db, company_id, campaign_id)
    if campaign is None:
        return None
    if name is not None:
        campaign.name = name
    if starts_on is not None:
        campaign.starts_on = starts_on
    if ends_on is not None:
        campaign.ends_on = ends_on
    if budget_aed is not None:
        campaign.budget_aed = budget_aed
    if spend_aed is not None:
        campaign.spend_aed = spend_aed
    if notes is not None:
        campaign.notes = notes
    campaign.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(campaign)
    return campaign


async def transition_campaign(
    db: AsyncSession,
    company_id: uuid.UUID,
    campaign_id: uuid.UUID,
    new_status: str,
) -> MarketingCampaign | None:
    campaign = await get_campaign(db, company_id, campaign_id)
    if campaign is None:
        return None
    if not is_valid_campaign_transition(campaign.status, new_status):
        raise ValueError(f"invalid_transition:{campaign.status}->{new_status}")
    campaign.status = new_status
    campaign.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(campaign)
    return campaign


# ── Unités liées ─────────────────────────────────────────────────────────────


async def attach_units(
    db: AsyncSession,
    company_id: uuid.UUID,
    campaign_id: uuid.UUID,
    unit_ids: list[uuid.UUID],
) -> list[MarketingCampaignUnit]:
    """Attache (idempotent) une liste d'unités à la campagne. Ignore les doublons."""
    existing = (
        (
            await db.execute(
                select(MarketingCampaignUnit.unit_id).where(
                    MarketingCampaignUnit.company_id == company_id,
                    MarketingCampaignUnit.campaign_id == campaign_id,
                )
            )
        )
        .scalars()
        .all()
    )
    existing_set = set(existing)
    for unit_id in unit_ids:
        if unit_id in existing_set:
            continue
        db.add(
            MarketingCampaignUnit(
                company_id=company_id,
                campaign_id=campaign_id,
                unit_id=unit_id,
            )
        )
        existing_set.add(unit_id)
    await db.commit()
    return await list_campaign_units(db, company_id, campaign_id)


async def detach_unit(
    db: AsyncSession,
    company_id: uuid.UUID,
    campaign_id: uuid.UUID,
    unit_id: uuid.UUID,
) -> bool:
    link = (
        await db.execute(
            select(MarketingCampaignUnit).where(
                MarketingCampaignUnit.company_id == company_id,
                MarketingCampaignUnit.campaign_id == campaign_id,
                MarketingCampaignUnit.unit_id == unit_id,
            )
        )
    ).scalar_one_or_none()
    if link is None:
        return False
    await db.delete(link)
    await db.commit()
    return True


async def list_campaign_units(
    db: AsyncSession, company_id: uuid.UUID, campaign_id: uuid.UUID
) -> list[MarketingCampaignUnit]:
    rows = (
        (
            await db.execute(
                select(MarketingCampaignUnit)
                .where(
                    MarketingCampaignUnit.company_id == company_id,
                    MarketingCampaignUnit.campaign_id == campaign_id,
                )
                .order_by(MarketingCampaignUnit.created_at.asc())
            )
        )
        .scalars()
        .all()
    )
    return list(rows)


# ── Métriques ──────────────────────────────────────────────────────────────


async def record_metrics(
    db: AsyncSession,
    company_id: uuid.UUID,
    campaign_id: uuid.UUID,
    *,
    impressions: int = 0,
    clicks: int = 0,
    leads: int = 0,
    spend_aed: Decimal | None = None,
) -> MarketingCampaign | None:
    """Incrémente les métriques de la campagne (deltas). Filtré company_id."""
    campaign = await get_campaign(db, company_id, campaign_id)
    if campaign is None:
        return None
    campaign.impressions = (campaign.impressions or 0) + impressions
    campaign.clicks = (campaign.clicks or 0) + clicks
    campaign.leads_count = (campaign.leads_count or 0) + leads
    if spend_aed is not None:
        campaign.spend_aed = (campaign.spend_aed or Decimal("0")) + spend_aed
    campaign.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(campaign)
    return campaign


async def get_marketing_kpis(db: AsyncSession, company_id: uuid.UUID) -> dict[str, Any]:
    """Totaux par statut + somme impressions/clics/leads/dépense (Loi 1)."""
    rows = (
        await db.execute(
            select(
                MarketingCampaign.status,
                func.count(),
                func.coalesce(func.sum(MarketingCampaign.impressions), 0),
                func.coalesce(func.sum(MarketingCampaign.clicks), 0),
                func.coalesce(func.sum(MarketingCampaign.leads_count), 0),
                func.coalesce(func.sum(MarketingCampaign.spend_aed), 0),
            )
            .where(
                MarketingCampaign.company_id == company_id,
                MarketingCampaign.deleted_at.is_(None),
            )
            .group_by(MarketingCampaign.status)
        )
    ).all()
    by_status: dict[str, int] = {}
    total_campaigns = 0
    impressions = 0
    clicks = 0
    leads = 0
    spend = Decimal("0")
    for status_val, count, imp, clk, lds, spd in rows:
        by_status[status_val] = int(count)
        total_campaigns += int(count)
        impressions += int(imp)
        clicks += int(clk)
        leads += int(lds)
        spend += Decimal(spd)
    return {
        "total_campaigns": total_campaigns,
        "by_status": by_status,
        "impressions": impressions,
        "clicks": clicks,
        "leads": leads,
        "spend_aed": spend,
    }


# ── Boucle de retour leads → CRM ───────────────────────────────────────────


async def find_or_create_client(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    name: str | None,
    email: str | None,
    phone: str | None,
    source_type: str,
) -> tuple[Client, bool]:
    """Récupère/crée un Client du tenant par email puis phone normalisés.

    Helper PARTAGÉ (canonique) : `marketing.inbound-lead` et la couche `sources`
    (Watcher) l'utilisent tous deux pour dédupliquer un contact entrant. Retourne
    `(client, created)`. NE commit PAS — l'appelant gère la transaction.
    """
    norm_email = (email or "").strip().lower() or None
    norm_phone = (phone or "").strip() or None

    # Priorité déterministe email > phone (alignée sur compute_dedup_key de
    # `sources`) : on cherche d'abord par email, puis on retombe sur le phone.
    # `order_by(created_at)` garantit un gagnant stable s'il y a plusieurs
    # candidats. Évite de rattacher arbitrairement le mauvais client.
    for condition in (
        func.lower(Client.email) == norm_email if norm_email else None,
        Client.phone == norm_phone if norm_phone else None,
    ):
        if condition is None:
            continue
        existing = (
            (
                await db.execute(
                    select(Client)
                    .where(
                        Client.company_id == company_id,
                        Client.deleted_at.is_(None),
                        condition,
                    )
                    .order_by(Client.created_at.asc())
                )
            )
            .scalars()
            .first()
        )
        if existing is not None:
            return existing, False

    first_name: str | None = None
    last_name: str | None = None
    if name and name.strip():
        parts = name.strip().split(maxsplit=1)
        first_name = parts[0] or None
        last_name = parts[1] if len(parts) > 1 else None

    client = Client(
        company_id=company_id,
        type="individual",
        first_name=first_name,
        last_name=last_name,
        email=norm_email,
        phone=norm_phone,
        source=source_type,
    )
    db.add(client)
    await db.flush()
    return client, True


async def record_inbound_lead(
    db: AsyncSession,
    company_id: uuid.UUID,
    campaign: MarketingCampaign,
    *,
    actor_user_id: uuid.UUID,
    client_id: uuid.UUID | None = None,
    contact: dict[str, Any] | None = None,
    message: str | None = None,
    budget: Decimal | None = None,
) -> CRMLead:
    """Crée un CRMLead à partir d'un lead entrant lié à la campagne.

    1. résout/crée le Client (dédup email/phone) ;
    2. crée un CRMLead (source=`marketing:{ref}`, category='realestate', score) ;
    3. incrémente leads_count de la campagne ;
    4. journalise une CRMActivity (type='note', user_id=actor).
    """
    if client_id is not None:
        client = (
            await db.execute(
                select(Client).where(
                    Client.id == client_id,
                    Client.company_id == company_id,
                    Client.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if client is None:
            raise ValueError("client_not_in_company")
    else:
        c = contact or {}
        client, _created = await find_or_create_client(
            db,
            company_id,
            name=c.get("name"),
            email=c.get("email"),
            phone=c.get("phone"),
            source_type="marketing",
        )

    # Score initial : pas de bonus de récence (aucun contact réel n'a eu lieu, on
    # est à la création — cf. crm.create_lead qui passe last_contact_at=None).
    score = crm_service.calculate_score(
        budget=budget,
        golden_visa_eligible=False,
        property_type=None,
        response_rate=0.0,
        last_contact_at=None,
    )

    def _build(reference: str) -> CRMLead:
        return CRMLead(
            company_id=company_id,
            reference=reference,
            client_id=client.id,
            status="new",
            source=f"marketing:{campaign.reference}",
            category="realestate",
            budget=budget,
            score=score,
        )

    # Insertion robuste à la concurrence : régénère la référence et réessaie sur
    # collision du unique composite (company_id, reference) — cf. crm.create_lead.
    lead = await commit_with_reference_retry(
        db,
        lambda: crm_service._next_reference(db, company_id),
        _build,
    )

    activity = CRMActivity(
        company_id=company_id,
        lead_id=lead.id,
        user_id=actor_user_id,
        type="note",
        content=message or f"Lead entrant via campagne {campaign.reference}",
    )
    db.add(activity)

    # Incrémente leads_count sur la campagne.
    campaign.leads_count = (campaign.leads_count or 0) + 1
    campaign.updated_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(lead)
    return lead
