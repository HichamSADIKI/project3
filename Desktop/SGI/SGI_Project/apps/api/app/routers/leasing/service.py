"""Service Leasing / Location.

- **Helpers purs** (sans DB) : génération de référence + machines à états
  des annonces et des candidatures.
- **Fonctions DB** : filtrées par company_id (Loi 1), CRUD + transitions.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.routers.leasing.models import RentalApplication, RentalListing

# ─────────────────────────────────────────────────────────────────────────
# Helpers purs
# ─────────────────────────────────────────────────────────────────────────

# Statuts d'annonce — alignés EXACTEMENT sur le CHECK constraint (migration 0035).
LISTING_STATUSES: frozenset[str] = frozenset(
    {"draft", "published", "reserved", "leased", "withdrawn"}
)
# Statuts de candidature — alignés EXACTEMENT sur le CHECK constraint (migration 0035).
APPLICATION_STATUSES: frozenset[str] = frozenset(
    {"submitted", "screening", "approved", "rejected", "converted"}
)

# Machine à états des annonces.
_LISTING_TRANSITIONS: dict[str, frozenset[str]] = {
    "draft": frozenset({"published", "withdrawn"}),
    "published": frozenset({"reserved", "leased", "withdrawn"}),
    "reserved": frozenset({"leased", "published", "withdrawn"}),
    # leased = terminal (aucune sortie).
    "leased": frozenset(),
    # withdrawn peut être republiée.
    "withdrawn": frozenset({"published"}),
}

# Machine à états des candidatures.
_APPLICATION_TRANSITIONS: dict[str, frozenset[str]] = {
    "submitted": frozenset({"screening", "rejected"}),
    "screening": frozenset({"approved", "rejected"}),
    "approved": frozenset({"converted"}),
    # converted / rejected = terminaux.
    "converted": frozenset(),
    "rejected": frozenset(),
}


def generate_reference(year: int, sequence: int) -> str:
    """Référence triable : `LEAS-2026-000042`."""
    return f"LEAS-{year:04d}-{sequence:06d}"


def is_valid_listing_transition(current: str, target: str) -> bool:
    """Vrai si la transition d'annonce `current -> target` est autorisée."""
    if current not in LISTING_STATUSES or target not in LISTING_STATUSES or current == target:
        return False
    return target in _LISTING_TRANSITIONS.get(current, frozenset())


def is_valid_application_transition(current: str, target: str) -> bool:
    """Vrai si la transition de candidature `current -> target` est autorisée."""
    if (
        current not in APPLICATION_STATUSES
        or target not in APPLICATION_STATUSES
        or current == target
    ):
        return False
    return target in _APPLICATION_TRANSITIONS.get(current, frozenset())


# ─────────────────────────────────────────────────────────────────────────
# Fonctions DB — filtrées par company_id (Loi 1)
# ─────────────────────────────────────────────────────────────────────────


async def _next_listing_reference(db: AsyncSession, company_id: uuid.UUID) -> str:
    year = datetime.now(UTC).year
    # Verrou consultatif transactionnel (libéré au COMMIT) : sérialise les
    # créations concurrentes → COUNT+INSERT race-free (plus de collision de réf.).
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:k))"),
        {"k": f"LEAS:rental_listings:{company_id}:{year}"},
    )
    result = await db.execute(
        select(func.count())
        .select_from(RentalListing)
        .where(
            RentalListing.company_id == company_id,
            RentalListing.reference.like(f"LEAS-{year:04d}-%"),
        )
    )
    return generate_reference(year, result.scalar_one() + 1)


async def _next_application_reference(db: AsyncSession, company_id: uuid.UUID) -> str:
    year = datetime.now(UTC).year
    # Verrou consultatif transactionnel (libéré au COMMIT) : sérialise les
    # créations concurrentes → COUNT+INSERT race-free (plus de collision de réf.).
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:k))"),
        {"k": f"LEAS:rental_applications:{company_id}:{year}"},
    )
    result = await db.execute(
        select(func.count())
        .select_from(RentalApplication)
        .where(
            RentalApplication.company_id == company_id,
            RentalApplication.reference.like(f"LEAS-{year:04d}-%"),
        )
    )
    return generate_reference(year, result.scalar_one() + 1)


# ── Annonces ──────────────────────────────────────────────────────────────────


async def create_listing(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    monthly_rent: Decimal,
    unit_id: uuid.UUID | None = None,
    title_ar: str | None = None,
    title_en: str | None = None,
    title_fr: str | None = None,
    annual_rent: Decimal | None = None,
    available_from: date | None = None,
) -> RentalListing:
    listing = RentalListing(
        company_id=company_id,
        reference=await _next_listing_reference(db, company_id),
        unit_id=unit_id,
        title_ar=title_ar,
        title_en=title_en,
        title_fr=title_fr,
        monthly_rent=monthly_rent,
        annual_rent=annual_rent,
        status="draft",
        available_from=available_from,
    )
    db.add(listing)
    await db.commit()
    await db.refresh(listing)
    return listing


async def get_listing(
    db: AsyncSession, company_id: uuid.UUID, listing_id: uuid.UUID
) -> RentalListing | None:
    result = await db.execute(
        select(RentalListing).where(
            RentalListing.id == listing_id,
            RentalListing.company_id == company_id,
            RentalListing.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def list_listings(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    status: str | None = None,
) -> tuple[list[RentalListing], int]:
    base = select(RentalListing).where(
        RentalListing.company_id == company_id,
        RentalListing.deleted_at.is_(None),
    )
    if status:
        base = base.where(RentalListing.status == status)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    offset = (page - 1) * limit
    rows = (
        (
            await db.execute(
                base.order_by(RentalListing.created_at.desc()).offset(offset).limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return list(rows), total


async def transition_listing(
    db: AsyncSession,
    company_id: uuid.UUID,
    listing_id: uuid.UUID,
    new_status: str,
) -> RentalListing | None:
    listing = await get_listing(db, company_id, listing_id)
    if listing is None:
        return None
    if not is_valid_listing_transition(listing.status, new_status):
        raise ValueError(f"invalid_transition:{listing.status}->{new_status}")
    now = datetime.now(UTC)
    listing.status = new_status
    if new_status == "published" and listing.published_at is None:
        listing.published_at = now
    listing.updated_at = now
    await db.commit()
    await db.refresh(listing)
    return listing


async def set_listing_flags(
    db: AsyncSession,
    company_id: uuid.UUID,
    listing_id: uuid.UUID,
    *,
    is_featured: bool | None = None,
    is_urgent: bool | None = None,
) -> RentalListing | None:
    """Met à jour les flags vitrine (Featured / Urgent). Patch partiel."""
    listing = await get_listing(db, company_id, listing_id)
    if listing is None:
        return None
    if is_featured is not None:
        listing.is_featured = is_featured
    if is_urgent is not None:
        listing.is_urgent = is_urgent
    listing.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(listing)
    return listing


# ── Candidatures ───────────────────────────────────────────────────────────────


async def create_application(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    listing_id: uuid.UUID,
    applicant_client_id: uuid.UUID,
    offered_rent: Decimal | None = None,
    screening_notes: str | None = None,
) -> RentalApplication:
    application = RentalApplication(
        company_id=company_id,
        reference=await _next_application_reference(db, company_id),
        listing_id=listing_id,
        applicant_client_id=applicant_client_id,
        offered_rent=offered_rent,
        status="submitted",
        screening_notes=screening_notes,
    )
    db.add(application)
    await db.commit()
    await db.refresh(application)
    return application


async def get_application(
    db: AsyncSession, company_id: uuid.UUID, application_id: uuid.UUID
) -> RentalApplication | None:
    result = await db.execute(
        select(RentalApplication).where(
            RentalApplication.id == application_id,
            RentalApplication.company_id == company_id,
            RentalApplication.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def list_applications(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    listing_id: uuid.UUID | None = None,
    status: str | None = None,
) -> tuple[list[RentalApplication], int]:
    base = select(RentalApplication).where(
        RentalApplication.company_id == company_id,
        RentalApplication.deleted_at.is_(None),
    )
    if listing_id:
        base = base.where(RentalApplication.listing_id == listing_id)
    if status:
        base = base.where(RentalApplication.status == status)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    offset = (page - 1) * limit
    rows = (
        (
            await db.execute(
                base.order_by(RentalApplication.created_at.desc()).offset(offset).limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return list(rows), total


async def transition_application(
    db: AsyncSession,
    company_id: uuid.UUID,
    application_id: uuid.UUID,
    new_status: str,
    *,
    converted_rental_id: uuid.UUID | None = None,
) -> RentalApplication | None:
    application = await get_application(db, company_id, application_id)
    if application is None:
        return None
    if not is_valid_application_transition(application.status, new_status):
        raise ValueError(f"invalid_transition:{application.status}->{new_status}")
    now = datetime.now(UTC)
    application.status = new_status
    # Horodatage de décision sur les états décisifs.
    if new_status in ("approved", "rejected", "converted") and application.decided_at is None:
        application.decided_at = now
    # NB : la création EFFECTIVE du bail `rentals` (contrat + calendrier de
    # paiement + PDC) reste un point d'intégration à câbler (TODO) — ici on se
    # contente de rattacher un bail déjà existant validé ∈ tenant par le router.
    if new_status == "converted" and converted_rental_id is not None:
        application.converted_rental_id = converted_rental_id
    application.updated_at = now
    await db.commit()
    await db.refresh(application)
    return application
