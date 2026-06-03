"""Service Sources — ingestion multi-source idempotente → leads CRM.

- **Helpers purs** (sans DB) : normalisation contact, clé de dédup, génération
  de référence, mapping vers payload lead.
- **Fonctions DB** : filtrées par company_id (Loi 1), dédup client, ingestion
  idempotente race-safe (catch IntegrityError, pattern inbox.get_or_create).

La cible métier est `CRMLead` (réutilisation) — aucune table leads parallèle.
"""

from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.crm import CRMLead
from app.routers.crm.service import calculate_score

# Helper de dédup client PARTAGÉ (canonique) — défini dans `marketing.service`
# (couture D-2). Réutilisé ici pour éviter toute divergence de comportement.
from app.routers.marketing.service import find_or_create_client
from app.routers.sources.models import SourceImport

# ─────────────────────────────────────────────────────────────────────────
# Helpers purs (testables sans DB)
# ─────────────────────────────────────────────────────────────────────────

# Types de source — alignés EXACTEMENT sur le CHECK constraint (migration 0037).
SOURCE_TYPES: frozenset[str] = frozenset({"contract", "social", "existing_customer", "other"})
# Statuts d'import — alignés EXACTEMENT sur le CHECK constraint (migration 0037).
IMPORT_STATUSES: frozenset[str] = frozenset({"imported", "duplicate", "rejected"})


def generate_reference(year: int, sequence: int) -> str:
    """Référence triable : `SRC-2026-000042`."""
    return f"SRC-{year:04d}-{sequence:06d}"


def is_valid_source_type(source_type: str) -> bool:
    return source_type in SOURCE_TYPES


def normalize_email(email: str | None) -> str | None:
    """Email normalisé (minuscules, sans espaces) ou None si vide/invalide."""
    if not email:
        return None
    cleaned = email.strip().lower()
    # Validation minimale : présence d'un @ avec parties non vides.
    if "@" not in cleaned:
        return None
    local, _, domain = cleaned.partition("@")
    if not local or not domain or "." not in domain:
        return None
    return cleaned


def normalize_phone(phone: str | None) -> str | None:
    """Téléphone normalisé : garde un éventuel '+' de tête puis les chiffres.

    Format UAE-friendly (les '00' internationaux deviennent '+'). Retourne None
    si aucun chiffre exploitable.
    """
    if not phone:
        return None
    raw = phone.strip()
    plus = raw.startswith("+") or raw.startswith("00")
    digits = re.sub(r"\D", "", raw)
    if raw.startswith("00"):
        digits = digits[2:]
    if not digits:
        return None
    return f"+{digits}" if plus else digits


def compute_dedup_key(email: str | None, phone: str | None) -> str:
    """Empreinte de dédup : email normalisé prioritaire, sinon phone normalisé.

    Chaîne vide si aucun contact exploitable (déclenche le rejet en amont).
    """
    norm_email = normalize_email(email)
    if norm_email:
        return f"email:{norm_email}"
    norm_phone = normalize_phone(phone)
    if norm_phone:
        return f"phone:{norm_phone}"
    return ""


def map_to_lead_payload(raw: dict[str, Any], source_type: str) -> dict[str, Any]:
    """Normalise un enregistrement source brut vers des champs Client/CRMLead.

    Pur : ne touche pas la DB. Tolère des clés alternatives courantes.
    """
    _raw_contact = raw.get("contact")
    contact: dict[str, Any] = _raw_contact if isinstance(_raw_contact, dict) else raw
    name = (
        contact.get("name")
        or contact.get("full_name")
        or " ".join(p for p in (contact.get("first_name"), contact.get("last_name")) if p).strip()
        or None
    )
    email = normalize_email(contact.get("email"))
    phone = normalize_phone(contact.get("phone") or contact.get("mobile"))
    budget_raw = raw.get("budget") or contact.get("budget")
    return {
        "name": name,
        "email": email,
        "phone": phone,
        "budget": budget_raw,
        "property_type": raw.get("property_type") or contact.get("property_type"),
        "preferred_location": raw.get("location") or raw.get("preferred_location"),
        "message": raw.get("message") or raw.get("notes"),
        "source_type": source_type,
    }


# ─────────────────────────────────────────────────────────────────────────
# Fonctions DB — filtrées par company_id (Loi 1)
# ─────────────────────────────────────────────────────────────────────────


async def _next_reference(db: AsyncSession, company_id: uuid.UUID) -> str:
    year = datetime.now(UTC).year
    # Verrou consultatif transactionnel (libéré au COMMIT) : sérialise les
    # créations concurrentes → COUNT+INSERT race-free (cf. leasing service.py:82).
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:k))"),
        {"k": f"SRC:source_imports:{company_id}:{year}"},
    )
    result = await db.execute(
        select(func.count())
        .select_from(SourceImport)
        .where(
            SourceImport.company_id == company_id,
            SourceImport.reference.like(f"SRC-{year:04d}-%"),
        )
    )
    return generate_reference(year, result.scalar_one() + 1)


async def _get_import_by_external(
    db: AsyncSession,
    company_id: uuid.UUID,
    source_type: str,
    external_id: str,
) -> SourceImport | None:
    result = await db.execute(
        select(SourceImport).where(
            SourceImport.company_id == company_id,
            SourceImport.source_type == source_type,
            SourceImport.external_id == external_id,
        )
    )
    return result.scalar_one_or_none()


async def ingest_record(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    source_type: str,
    source_channel: str | None,
    external_id: str | None,
    raw: dict[str, Any],
    agent_user_id: uuid.UUID | None = None,
) -> tuple[SourceImport, str]:
    """Ingère UN enregistrement source de façon idempotente et race-safe.

    Algorithme :
      1. external_id déjà vu (company, source_type) → status='duplicate', pas de lead.
      2. contact vide (dedup_key) → status='rejected', reject_reason='no_contact'.
      3. find_or_create_client + création CRMLead (source=f"{type}:{channel}",
         category='realestate', score via crm.calculate_score).
      4. enregistre SourceImport(status='imported', created_lead_id/client_id, raw).
      5. commit avec catch IntegrityError → relit l'import gagnant (idempotence
         sous concurrence, pattern inbox.get_or_create).
    """
    if external_id:
        existing = await _get_import_by_external(db, company_id, source_type, external_id)
        if existing is not None:
            return existing, "duplicate"

    payload = map_to_lead_payload(raw, source_type)
    dedup_key = compute_dedup_key(payload["email"], payload["phone"])

    # Rejet : aucun contact exploitable.
    if not dedup_key:
        record = SourceImport(
            company_id=company_id,
            reference=await _next_reference(db, company_id),
            source_type=source_type,
            source_channel=source_channel,
            external_id=external_id,
            dedup_key="",
            status="rejected",
            reject_reason="no_contact",
            raw_payload=raw,
        )
        db.add(record)
        rec, race = await _commit_record(db, company_id, source_type, external_id, record)
        return rec, ("duplicate" if race else "rejected")

    client, _created = await find_or_create_client(
        db,
        company_id,
        name=payload["name"],
        email=payload["email"],
        phone=payload["phone"],
        source_type=source_type,
    )

    budget = None
    raw_budget = payload.get("budget")
    if raw_budget is not None:
        try:
            from decimal import Decimal

            budget = Decimal(str(raw_budget))
        except (ValueError, ArithmeticError):
            budget = None

    score = calculate_score(
        budget=budget,
        golden_visa_eligible=False,
        property_type=payload.get("property_type"),
        response_rate=0.0,
        last_contact_at=None,
    )

    channel_label = source_channel or source_type
    lead = CRMLead(
        id=uuid.uuid4(),
        company_id=company_id,
        client_id=client.id,
        agent_id=agent_user_id,
        status="new",
        source=f"{source_type}:{channel_label}"[:50],
        category="realestate",
        budget=budget,
        property_type=payload.get("property_type"),
        preferred_location=payload.get("preferred_location"),
        score=score,
        notes=payload.get("message"),
    )
    db.add(lead)
    await db.flush()

    record = SourceImport(
        company_id=company_id,
        reference=await _next_reference(db, company_id),
        source_type=source_type,
        source_channel=source_channel,
        external_id=external_id,
        dedup_key=dedup_key,
        status="imported",
        created_lead_id=lead.id,
        created_client_id=client.id,
        raw_payload=raw,
    )
    db.add(record)
    rec, race = await _commit_record(db, company_id, source_type, external_id, record)
    return rec, ("duplicate" if race else "imported")


async def _commit_record(
    db: AsyncSession,
    company_id: uuid.UUID,
    source_type: str,
    external_id: str | None,
    record: SourceImport,
) -> tuple[SourceImport, bool]:
    """Commit + refresh. Retourne (record, was_duplicate_race).

    was_duplicate_race=True si la contrainte unique a sauté (course perdue) et
    qu'on relit l'enregistrement gagnant existant → l'appelant compte un doublon.
    """
    try:
        await db.commit()
        await db.refresh(record)
        return record, False
    except IntegrityError:
        # Course perdue sur la contrainte unique partielle (company, type, external_id).
        await db.rollback()
        if external_id:
            winner = await _get_import_by_external(db, company_id, source_type, external_id)
            if winner is not None:
                return winner, True
        raise


async def ingest_csv(
    db: AsyncSession,
    company_id: uuid.UUID,
    rows: list[dict[str, Any]],
    *,
    source_type: str,
    source_channel: str | None = "csv",
    agent_user_id: uuid.UUID | None = None,
) -> dict[str, int]:
    """Ingère une liste de lignes (CSV/payload). Retourne {imported,duplicates,rejected}."""
    summary = {"imported": 0, "duplicates": 0, "rejected": 0}
    for row in rows:
        external_id = row.get("external_id") or row.get("id")
        _record, outcome = await ingest_record(
            db,
            company_id,
            source_type=source_type,
            source_channel=source_channel,
            external_id=str(external_id) if external_id is not None else None,
            raw=row,
            agent_user_id=agent_user_id,
        )
        if outcome == "imported":
            summary["imported"] += 1
        elif outcome == "duplicate":
            summary["duplicates"] += 1
        else:
            summary["rejected"] += 1
    return summary


async def get_import(
    db: AsyncSession, company_id: uuid.UUID, import_id: uuid.UUID
) -> SourceImport | None:
    result = await db.execute(
        select(SourceImport).where(
            SourceImport.id == import_id,
            SourceImport.company_id == company_id,
            SourceImport.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def list_imports(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    source_type: str | None = None,
    status: str | None = None,
    source_channel: str | None = None,
) -> tuple[list[SourceImport], int]:
    base = select(SourceImport).where(
        SourceImport.company_id == company_id,
        SourceImport.deleted_at.is_(None),
    )
    if source_type:
        base = base.where(SourceImport.source_type == source_type)
    if status:
        base = base.where(SourceImport.status == status)
    if source_channel:
        # Préfixe : le Watcher écrit "watcher" ou "watcher:{channel}" — un filtre
        # ?source_channel=watcher englobe donc toutes ses variantes.
        base = base.where(SourceImport.source_channel.like(f"{source_channel}%"))
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    offset = (page - 1) * limit
    rows = (
        (
            await db.execute(
                base.order_by(SourceImport.imported_at.desc()).offset(offset).limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return list(rows), total
