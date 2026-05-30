"""Service IA — génération de résumé contrat + prédiction maintenance.

Lecture seule sur contracts + maintenance_tickets. Aucune table propre.
Les helpers de scoring sont purs et testables.
"""
import uuid
from collections import Counter
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contract import Contract
from app.models.maintenance import MaintenanceTicket

# ── Helpers purs (scoring risque maintenance) ─────────────────────────────

def compute_risk_score(
    ticket_count: int,
    recurring_category_count: int,
    sla_breaches: int,
    age_days: int,
) -> int:
    """Score de risque maintenance 0-100 (heuristique transparente).

    - Volume de tickets       : jusqu'à +40 (8 pts/ticket, plafonné)
    - Récurrence catégorie    : jusqu'à +30 (10 pts/récurrence au-delà de 1)
    - SLA dépassés            : jusqu'à +30 (15 pts/breach, plafonné)
    Normalisé par l'ancienneté pour éviter de pénaliser un historique long.
    """
    volume = min(ticket_count * 8, 40)
    recurrence = min(max(recurring_category_count - 1, 0) * 10, 30)
    breaches = min(sla_breaches * 15, 30)
    raw = volume + recurrence + breaches
    # Amortit légèrement si l'historique est très ancien (> 1 an).
    if age_days > 365 and ticket_count <= 2:
        raw = int(raw * 0.7)
    return min(raw, 100)


def risk_level(score: int) -> str:
    if score >= 75:
        return "critical"
    if score >= 50:
        return "high"
    if score >= 25:
        return "medium"
    return "low"


def suggest_preventive_frequency(category: str, ticket_count: int) -> str | None:
    """Suggère une expression cron de préventif selon la catégorie + fréquence.

    HVAC/plomberie récurrents → trimestriel ; électrique → semestriel ;
    autres → annuel. None si trop peu de tickets pour conclure.
    """
    if ticket_count < 2:
        return None
    quarterly = "0 9 1 */3 *"   # 1er jour, tous les 3 mois
    semester = "0 9 1 */6 *"
    annual = "0 9 1 1 *"
    mapping = {
        "hvac": quarterly,
        "plumbing": quarterly,
        "electrical": semester,
        "appliance": semester,
        "structural": annual,
        "cleaning": quarterly,
    }
    return mapping.get(category, annual)


# ── Prédiction maintenance ─────────────────────────────────────────────────

async def _analyze_unit(
    db: AsyncSession, company_id: uuid.UUID, unit_id: uuid.UUID
) -> dict:
    rows = (await db.execute(
        select(MaintenanceTicket).where(
            MaintenanceTicket.company_id == company_id,
            MaintenanceTicket.unit_id == unit_id,
            MaintenanceTicket.deleted_at.is_(None),
        )
    )).scalars().all()

    ticket_count = len(rows)
    cats = Counter(t.category for t in rows)
    top_category, top_count = (cats.most_common(1)[0] if cats else (None, 0))

    now = datetime.now(UTC)
    sla_breaches = sum(
        1 for t in rows
        if t.sla_due_at and t.status not in ("closed", "cancelled", "resolved")
        and (t.sla_due_at.replace(tzinfo=UTC) if t.sla_due_at.tzinfo is None
             else t.sla_due_at) < now
    )
    oldest = min((t.created_at for t in rows), default=now)
    if oldest.tzinfo is None:
        oldest = oldest.replace(tzinfo=UTC)
    age_days = (now - oldest).days

    score = compute_risk_score(ticket_count, top_count, sla_breaches, age_days)
    return {
        "unit_id": unit_id,
        "ticket_count": ticket_count,
        "recurring_category": top_category,
        "sla_breaches": sla_breaches,
        "risk_score": score,
        "risk_level": risk_level(score),
        "top_category": top_category,
        "top_count": top_count,
    }


async def unit_risk(
    db: AsyncSession, company_id: uuid.UUID, unit_id: uuid.UUID
) -> dict:
    return await _analyze_unit(db, company_id, unit_id)


async def predictions(
    db: AsyncSession, company_id: uuid.UUID, min_score: int = 25
) -> list[dict]:
    """Liste les unités à risque (score ≥ min_score) + plans préventifs suggérés."""
    unit_ids = (await db.execute(
        select(MaintenanceTicket.unit_id).where(
            MaintenanceTicket.company_id == company_id,
            MaintenanceTicket.unit_id.isnot(None),
            MaintenanceTicket.deleted_at.is_(None),
        ).group_by(MaintenanceTicket.unit_id)
    )).all()

    out: list[dict] = []
    for (uid,) in unit_ids:
        analysis = await _analyze_unit(db, company_id, uid)
        if analysis["risk_score"] < min_score:
            continue
        cron = suggest_preventive_frequency(
            analysis["top_category"] or "other", analysis["ticket_count"]
        )
        rationale = (
            f"{analysis['ticket_count']} ticket(s), "
            f"catégorie dominante '{analysis['top_category']}' "
            f"({analysis['top_count']}×), {analysis['sla_breaches']} SLA dépassé(s)."
        )
        out.append({
            "unit_id": uid,
            "risk_score": analysis["risk_score"],
            "risk_level": analysis["risk_level"],
            "top_category": analysis["top_category"],
            "suggested_cron": cron,
            "rationale": rationale,
        })
    out.sort(key=lambda x: x["risk_score"], reverse=True)
    return out


# ── Résumé de contrat (Gemini + fallback) ─────────────────────────────────

async def contract_summary(
    db: AsyncSession, company_id: uuid.UUID, contract_id: uuid.UUID
) -> dict | None:
    result = await db.execute(
        select(Contract).where(
            Contract.id == contract_id,
            Contract.company_id == company_id,
            Contract.deleted_at.is_(None),
        )
    )
    contract = result.scalar_one_or_none()
    if not contract:
        return None

    facts = (
        f"Contrat {contract.reference} — type {contract.type}, "
        f"montant {contract.amount} AED, commission {contract.commission_rate}%, "
        f"statut {contract.status}, "
        f"période {contract.start_date} → {contract.end_date}."
    )

    summary = facts
    engine = "local_facts"
    try:
        from app.core.gemini import parse_client_need
        result_g = await parse_client_need(
            f"Résume ce contrat immobilier en 2-3 phrases claires :\n{facts}",
            locale="fr",
        )
        if result_g.get("engine", "").startswith("gemini"):
            summary = result_g.get("summary", facts)
            engine = result_g["engine"]
    except Exception:  # noqa: BLE001, S110 — fail-safe : on garde le résumé factuel
        pass

    return {
        "contract_id": contract.id,
        "reference": contract.reference,
        "summary": summary,
        "engine": engine,
    }
