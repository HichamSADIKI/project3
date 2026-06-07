"""Service CRM — toutes les fonctions filtrent par company_id."""

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.references import commit_with_reference_retry
from app.models.client import Client
from app.models.crm import CRMActivity, CRMLead
from app.models.golden_visa import GoldenVisaApplication

from .schemas import ActivityCreate, LeadCreate, LeadStatusUpdate, LeadUpdate

# ---------------------------------------------------------------------------
# Transitions valides du pipeline (CLAUDE.md)
# ---------------------------------------------------------------------------
VALID_TRANSITIONS: dict[str, list[str]] = {
    "new": ["contacted", "lost"],
    "contacted": ["qualified", "lost"],
    "qualified": ["proposal_sent", "lost"],
    "proposal_sent": ["visit_planned", "negotiation", "lost"],
    "visit_planned": ["visit_done", "lost"],
    "visit_done": ["negotiation", "proposal_sent", "lost"],
    "negotiation": ["won", "lost"],
    "won": [],
    "lost": [],
}

GOLDEN_VISA_THRESHOLD = Decimal("2000000")


# ---------------------------------------------------------------------------
# Séquence de relance automatique (CLAUDE.md) : max 4 tentatives sur 7 jours.
# Index = nombre de tentatives déjà effectuées (CRMLead.contact_attempts).
# ---------------------------------------------------------------------------
FOLLOWUP_SCHEDULE: list[tuple[int, str]] = [
    (1, "call"),  # J+1 : appel (tâche créée pour l'agent)
    (2, "whatsapp"),  # J+2 : WhatsApp (template Meta)
    (4, "email"),  # J+4 : e-mail personnalisé
    (7, "push_whatsapp"),  # J+7 : push (agent) + WhatsApp (dernier recours)
]
FOLLOWUP_MAX_ATTEMPTS = len(FOLLOWUP_SCHEDULE)
# Statuts encore éligibles à la relance (le lead n'a pas encore « répondu »).
FOLLOWUP_ACTIVE_STATUSES: frozenset[str] = frozenset({"new", "contacted"})


def next_followup_action(now: datetime, created_at: datetime, contact_attempts: int) -> str | None:
    """Action de relance due pour un lead, ou ``None`` si rien n'est encore dû.

    - ``"call"`` / ``"whatsapp"`` / ``"email"`` / ``"push_whatsapp"`` : la tentative
      n° ``contact_attempts`` est due (seuil J+1/J+2/J+4/J+7 atteint).
    - ``"lost"`` : les 4 tentatives sont épuisées → clôturer en ``non_respondent``.
    - ``None`` : la prochaine tentative n'est pas encore arrivée à échéance.
    """
    if contact_attempts >= FOLLOWUP_MAX_ATTEMPTS:
        return "lost"
    threshold_day, action = FOLLOWUP_SCHEDULE[contact_attempts]
    days_elapsed = (now - created_at).days
    if days_elapsed >= threshold_day:
        return action
    return None


def followup_next_schedule(
    created_at: datetime, contact_attempts: int
) -> tuple[datetime | None, str | None]:
    """(date, type) de la PROCHAINE tentative après ``contact_attempts`` faites.

    ``(None, None)`` une fois la séquence épuisée. Sert à renseigner
    ``CRMLead.next_action_at`` / ``next_action_type`` pour l'affichage agent.
    """
    if contact_attempts >= FOLLOWUP_MAX_ATTEMPTS:
        return None, None
    threshold_day, action = FOLLOWUP_SCHEDULE[contact_attempts]
    return created_at + timedelta(days=threshold_day), action


# ---------------------------------------------------------------------------
# Score automatique (CLAUDE.md)
# ---------------------------------------------------------------------------


def calculate_score(
    budget: Decimal | None,
    golden_visa_eligible: bool,
    property_type: str | None,
    response_rate: float,
    last_contact_at: datetime | None,
) -> int:
    """Calcule le score d'un lead (0–100) selon les règles CLAUDE.md."""
    score = 0

    if budget is not None:
        if budget >= Decimal("2000000"):
            score += 25
        elif budget >= Decimal("500000"):
            score += 15

    if golden_visa_eligible:
        score += 20

    if property_type:
        score += 15

    score += int((response_rate or 0.0) * 20)

    if last_contact_at is not None:
        # Normalise en UTC pour la comparaison
        lca = last_contact_at
        if lca.tzinfo is None:
            lca = lca.replace(tzinfo=UTC)
        delta = datetime.now(UTC) - lca
        if delta.days < 7:
            score += 10

    return min(score, 100)


# ---------------------------------------------------------------------------
# Référence métier — CRM-YYYY-NNNNNN (6 chiffres, triable, unique par tenant)
# ---------------------------------------------------------------------------


def generate_reference(year: int, sequence: int) -> str:
    """Format interne : CRM-YYYY-NNNNNN (6 chiffres pour faciliter le tri)."""
    return f"CRM-{year}-{sequence:06d}"


async def _next_reference(db: AsyncSession, company_id: uuid.UUID) -> str:
    """Génère une référence unique par tenant + année courante."""
    year = datetime.now(UTC).year
    count_result = await db.execute(
        select(func.count(CRMLead.id)).where(
            CRMLead.company_id == company_id,
            func.extract("year", CRMLead.created_at) == year,
        )
    )
    seq = int(count_result.scalar_one() or 0) + 1
    return generate_reference(year, seq)


# ---------------------------------------------------------------------------
# CRUD Leads
# ---------------------------------------------------------------------------


async def list_leads(
    db: AsyncSession,
    company_id: str,
    page: int = 1,
    limit: int = 20,
    status: str | None = None,
    agent_id: uuid.UUID | None = None,
    q: str | None = None,
    category: str | None = None,
    client_id: uuid.UUID | None = None,
) -> tuple[list[CRMLead], int]:
    """Retourne (items, total) filtrés par company_id."""
    filters = [
        CRMLead.company_id == uuid.UUID(company_id),
        CRMLead.deleted_at.is_(None),
    ]
    if status:
        filters.append(CRMLead.status == status)
    if category:
        filters.append(CRMLead.category == category)
    if agent_id:
        filters.append(CRMLead.agent_id == agent_id)
    if client_id:
        filters.append(CRMLead.client_id == client_id)
    if q:
        filters.append(
            or_(
                CRMLead.source.ilike(f"%{q}%"),
                CRMLead.preferred_location.ilike(f"%{q}%"),
                CRMLead.notes.ilike(f"%{q}%"),
            )
        )

    total_q = await db.execute(select(func.count()).select_from(CRMLead).where(and_(*filters)))
    total = total_q.scalar_one()

    offset = (page - 1) * limit
    result = await db.execute(
        select(
            CRMLead,
            Client.first_name,
            Client.last_name,
            Client.company_name,
        )
        .join(Client, Client.id == CRMLead.client_id, isouter=True)
        .where(and_(*filters))
        .order_by(CRMLead.score.desc(), CRMLead.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    leads: list[CRMLead] = []
    for lead, first_name, last_name, company_name in result.all():
        # Nom d'affichage : société sinon prénom+nom. Attribut dynamique lu par
        # LeadOut (from_attributes) — non persisté.
        full = " ".join(p for p in (first_name, last_name) if p).strip()
        lead.client_name = company_name or full or None  # type: ignore[attr-defined]
        leads.append(lead)
    return leads, total


async def get_lead(
    db: AsyncSession,
    company_id: str,
    lead_id: uuid.UUID,
) -> CRMLead | None:
    """Récupère un lead par ID, filtré par company_id et non supprimé."""
    result = await db.execute(
        select(CRMLead).where(
            CRMLead.id == lead_id,
            CRMLead.company_id == uuid.UUID(company_id),
            CRMLead.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def create_lead(
    db: AsyncSession,
    company_id: str,
    data: LeadCreate,
    user_id: uuid.UUID,
) -> CRMLead:
    """
    Crée un lead CRM.
    Calcule le score initial selon les règles métier.
    """
    score = calculate_score(
        budget=data.budget,
        golden_visa_eligible=data.golden_visa_eligible,
        property_type=data.property_type,
        response_rate=0.0,
        last_contact_at=None,
    )

    return await commit_with_reference_retry(
        db,
        lambda: _next_reference(db, uuid.UUID(company_id)),
        lambda reference: CRMLead(
            company_id=uuid.UUID(company_id),
            reference=reference,
            client_id=data.client_id,
            agent_id=data.agent_id,
            source=data.source,
            budget=data.budget,
            property_type=data.property_type,
            preferred_location=data.preferred_location,
            preferred_property_id=data.preferred_property_id,
            golden_visa_eligible=data.golden_visa_eligible,
            notes=data.notes,
            score=score,
            status="new",
            response_rate=Decimal("0.0"),
            contact_attempts=0,
        ),
    )


async def update_lead(
    db: AsyncSession,
    company_id: str,
    lead_id: uuid.UUID,
    data: LeadUpdate,
) -> CRMLead | None:
    """Met à jour partiellement un lead existant. Recalcule le score si pertinent."""
    lead = await get_lead(db, company_id, lead_id)
    if not lead:
        return None

    update_data = data.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(lead, key, value)

    # Recalcul du score après mise à jour
    lead.score = calculate_score(
        budget=lead.budget,
        golden_visa_eligible=lead.golden_visa_eligible,
        property_type=lead.property_type,
        response_rate=float(lead.response_rate or 0),
        last_contact_at=lead.last_contact_at,
    )

    await db.commit()
    await db.refresh(lead)
    return lead


async def update_lead_status(
    db: AsyncSession,
    company_id: str,
    lead_id: uuid.UUID,
    data: LeadStatusUpdate,
    user_id: uuid.UUID,
) -> CRMLead | None:
    """
    Change le statut d'un lead après validation de la transition pipeline.
    Crée automatiquement une CRMActivity de type 'status_change'.
    Gère les automatismes post-close (Golden Visa, won).
    """
    lead = await get_lead(db, company_id, lead_id)
    if not lead:
        return None

    current_status = lead.status
    new_status = data.status

    # Validation de la transition
    allowed = VALID_TRANSITIONS.get(current_status, [])
    if new_status not in allowed:
        raise HTTPException(
            status_code=422,
            detail=(
                f"invalid_transition: '{current_status}' → '{new_status}' (autorisées: {allowed})"
            ),
        )

    # Validation du motif de perte
    if new_status == "lost" and not data.reason:
        raise HTTPException(
            status_code=422,
            detail="lost_reason_required: le motif est obligatoire pour 'lost'",
        )

    status_from = current_status
    lead.status = new_status

    if new_status == "lost":
        lead.lost_reason = data.reason

    if new_status == "won":
        if data.won_amount is not None:
            lead.won_amount = data.won_amount
        # Automatisme Golden Visa : vente ≥ 2 000 000 AED
        effective_amount = data.won_amount or lead.budget
        if effective_amount and effective_amount >= GOLDEN_VISA_THRESHOLD:
            lead.golden_visa_eligible = True
            # Automatisme Golden Visa (CLAUDE.md) : créer le dossier s'il n'existe
            # pas déjà (non terminal) pour ce client dans le tenant, puis tracer.
            existing_gv = await db.execute(
                select(GoldenVisaApplication.id).where(
                    GoldenVisaApplication.company_id == uuid.UUID(company_id),
                    GoldenVisaApplication.client_id == lead.client_id,
                    GoldenVisaApplication.deleted_at.is_(None),
                    GoldenVisaApplication.status.notin_(["rejected", "expired"]),
                )
            )
            gv_created = existing_gv.first() is None
            if gv_created:
                db.add(
                    GoldenVisaApplication(
                        company_id=uuid.UUID(company_id),
                        client_id=lead.client_id,
                        property_id=lead.preferred_property_id,
                        status="pending",
                        notes=(
                            f"Créé automatiquement depuis un lead gagné "
                            f"(vente {effective_amount} AED ≥ 2 000 000 AED)."
                        ),
                    )
                )
            activity_gv = CRMActivity(
                company_id=uuid.UUID(company_id),
                lead_id=lead.id,
                user_id=user_id,
                type="note",
                content=(
                    f"Golden Visa éligible — montant {effective_amount} AED. "
                    + (
                        "Dossier Golden Visa créé automatiquement."
                        if gv_created
                        else "Dossier Golden Visa déjà existant pour ce client."
                    )
                ),
            )
            db.add(activity_gv)

    # Journal de la transition de statut
    activity = CRMActivity(
        company_id=uuid.UUID(company_id),
        lead_id=lead.id,
        user_id=user_id,
        type="status_change",
        status_from=status_from,
        status_to=new_status,
        content=data.reason if new_status == "lost" else None,
        completed_at=datetime.now(UTC),
    )
    db.add(activity)

    await db.commit()
    await db.refresh(lead)
    return lead


# ---------------------------------------------------------------------------
# Activités
# ---------------------------------------------------------------------------


async def add_activity(
    db: AsyncSession,
    company_id: str,
    data: ActivityCreate,
    user_id: uuid.UUID,
) -> CRMActivity:
    """
    Ajoute une activité (appel, email, WhatsApp, visite, note) sur un lead.
    Vérifie que le lead appartient au tenant.
    """
    # Vérification d'appartenance du lead au tenant
    lead = await get_lead(db, company_id, data.lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="lead_not_found")

    activity = CRMActivity(
        company_id=uuid.UUID(company_id),
        lead_id=data.lead_id,
        user_id=user_id,
        type=data.type,
        content=data.content,
        scheduled_at=data.scheduled_at,
    )
    db.add(activity)

    # Mise à jour du compteur de contacts et de la date de dernier contact
    if data.type in ("call", "email", "whatsapp", "visit"):
        lead.contact_attempts = (lead.contact_attempts or 0) + 1
        lead.last_contact_at = datetime.now(UTC)
        # Recalcul du score avec la date de contact mise à jour
        lead.score = calculate_score(
            budget=lead.budget,
            golden_visa_eligible=lead.golden_visa_eligible,
            property_type=lead.property_type,
            response_rate=float(lead.response_rate or 0),
            last_contact_at=lead.last_contact_at,
        )

    await db.commit()
    await db.refresh(activity)
    return activity


async def list_activities(
    db: AsyncSession,
    company_id: str,
    lead_id: uuid.UUID,
) -> list[CRMActivity]:
    """
    Retourne toutes les activités d'un lead, triées chronologiquement.
    Vérifie l'appartenance du lead au tenant.
    """
    # Vérification d'appartenance du lead au tenant
    lead = await get_lead(db, company_id, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="lead_not_found")

    result = await db.execute(
        select(CRMActivity)
        .where(
            CRMActivity.lead_id == lead_id,
            CRMActivity.company_id == uuid.UUID(company_id),
        )
        .order_by(CRMActivity.created_at.desc())
    )
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# KPIs Pipeline
# ---------------------------------------------------------------------------


async def get_pipeline_kpis(
    db: AsyncSession,
    company_id: str,
) -> dict[str, int]:
    """
    Retourne le nombre de leads par statut pour le tenant.
    Tous les statuts sont retournés, même ceux avec 0 leads.
    """
    all_statuses = list(VALID_TRANSITIONS.keys())

    result = await db.execute(
        select(CRMLead.status, func.count().label("cnt"))
        .where(
            CRMLead.company_id == uuid.UUID(company_id),
            CRMLead.deleted_at.is_(None),
        )
        .group_by(CRMLead.status)
    )
    rows = result.all()
    counts: dict[str, int] = {s: 0 for s in all_statuses}
    for row in rows:
        counts[row.status] = row.cnt
    return counts
