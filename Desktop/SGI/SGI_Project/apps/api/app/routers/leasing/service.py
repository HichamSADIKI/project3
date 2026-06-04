"""Service Leasing / Location.

- **Helpers purs** (sans DB) : génération de référence + machines à états
  des annonces et des candidatures.
- **Fonctions DB** : filtrées par company_id (Loi 1), CRUD + transitions.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contract import Contract
from app.models.rental import Rental
from app.models.unit import Unit
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


def build_slug(*titles: str | None, fallback: str, uniq: uuid.UUID) -> str:
    """Slug vitrine kebab-case ASCII + suffixe court unique (anti-collision).

    `uniq` (l'id de l'annonce) garantit l'unicité par société sans round-trip DB.
    Pur, testable.
    """
    base = next((t for t in titles if t), None) or fallback
    out: list[str] = []
    for ch in base.lower():
        if ch.isascii() and ch.isalnum():
            out.append(ch)
        elif ch in " -_/—":
            out.append("-")
    slug = "".join(out)
    while "--" in slug:
        slug = slug.replace("--", "-")
    slug = slug.strip("-") or "annonce"
    return f"{slug}-{uniq.hex[:6]}"


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
    if new_status == "published":
        if listing.published_at is None:
            listing.published_at = now
        # Slug requis par la vitrine publique : généré à la 1re publication.
        if not listing.slug:
            listing.slug = build_slug(
                listing.title_en,
                listing.title_ar,
                listing.title_fr,
                fallback=listing.reference,
                uniq=listing.id,
            )
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


# ─────────────────────────────────────────────────────────────────────────
# Conversion en bail effectif (contrat + bail + échéancier)
# ─────────────────────────────────────────────────────────────────────────

# Bail annuel par défaut (usage UAE) ; commission contrat par défaut (cf. contracts).
DEFAULT_LEASE_MONTHS = 12
DEFAULT_COMMISSION_RATE = Decimal("2.0")


def default_lease_end(start: date, months: int = DEFAULT_LEASE_MONTHS) -> date:
    """Fin de bail par défaut : `months` mois après le début, **moins un jour**
    (bail annuel UAE → 12 échéances mensuelles pleines, pas 13). Helper pur."""
    from app.routers.rentals.service import _add_months

    return _add_months(start, months) - timedelta(days=1)


async def convert_application_to_lease(
    db: AsyncSession,
    company_id: uuid.UUID,
    application: RentalApplication,
    *,
    start_date: date | None = None,
    end_date: date | None = None,
    deposit: Decimal | None = None,
    payment_frequency: str = "monthly",
) -> Rental:
    """Crée le **bail effectif** à partir d'une candidature approuvée.

    Auto-crée (Loi 1, tout porte `company_id`) :
      1. un **contrat** de location (`type='rental'`, statut `active`, réf
         `CNT-{année}-{seq}`, montant = loyer annuel, commission 2 %),
      2. le **bail** (`rentals`) rattaché + **échéancier** (`payment_schedule`)
         généré selon la fréquence.

    Le bien (`property_id`) est résolu via `units.legacy_property_id` (pont
    unité→propriété). Aucun PDC généré ici (échéancier seul). N'effectue **pas**
    de commit : l'appelant (`transition_application`) commite l'ensemble en une
    seule transaction (atomicité contrat+bail+candidature).

    Lève `ValueError(<code>)` — mappé en 422 par le router — si la conversion
    est impossible : `listing_not_found`, `listing_without_unit`,
    `unit_not_found`, `unit_without_property`, `invalid_rent`, `invalid_period`.
    """
    listing = await get_listing(db, company_id, application.listing_id)
    if listing is None:
        raise ValueError("listing_not_found")
    if listing.unit_id is None:
        raise ValueError("listing_without_unit")
    unit = (
        await db.execute(
            select(Unit).where(
                Unit.id == listing.unit_id,
                Unit.company_id == company_id,
                Unit.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if unit is None:
        raise ValueError("unit_not_found")
    if unit.legacy_property_id is None:
        # Pas de bien `properties` lié → impossible de créer contrat/bail (FK NOT NULL).
        raise ValueError("unit_without_property")

    monthly_rent = application.offered_rent or listing.monthly_rent
    if monthly_rent is None or monthly_rent <= 0:
        raise ValueError("invalid_rent")

    start = start_date or date.today()
    end = end_date or default_lease_end(start)
    if end <= start:
        raise ValueError("invalid_period")
    dep = deposit if deposit is not None else monthly_rent  # 1 mois par défaut
    freq = payment_frequency or "monthly"
    annual_rent = monthly_rent * DEFAULT_LEASE_MONTHS

    # Contrat de location auto-généré (même format de référence que le module contracts).
    from app.routers.contracts.service import _next_contract_sequence

    seq = await _next_contract_sequence(db, start.year)
    contract = Contract(
        company_id=company_id,
        reference=f"CNT-{start.year}-{seq:04d}",
        type="rental",
        client_id=application.applicant_client_id,
        property_id=unit.legacy_property_id,
        amount=annual_rent,
        commission_rate=DEFAULT_COMMISSION_RATE,
        commission_amount=annual_rent * DEFAULT_COMMISSION_RATE / Decimal("100"),
        status="active",
        start_date=start,
        end_date=end,
    )
    db.add(contract)
    await db.flush()  # contract.id

    # Bail + échéancier (helper pur réutilisé du module rentals).
    from app.routers.rentals.service import _build_payment_schedule

    rental = Rental(
        company_id=company_id,
        contract_id=contract.id,
        client_id=application.applicant_client_id,
        property_id=unit.legacy_property_id,
        monthly_rent=monthly_rent,
        annual_rent=annual_rent,
        deposit=dep,
        payment_frequency=freq,
        status="active",
        start_date=start,
        end_date=end,
        renewal_alert_sent=False,
        payment_schedule=_build_payment_schedule(start, end, monthly_rent, freq),
    )
    db.add(rental)
    await db.flush()  # rental.id
    return rental


async def transition_application(
    db: AsyncSession,
    company_id: uuid.UUID,
    application_id: uuid.UUID,
    new_status: str,
    *,
    converted_rental_id: uuid.UUID | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    deposit: Decimal | None = None,
    payment_frequency: str = "monthly",
) -> RentalApplication | None:
    application = await get_application(db, company_id, application_id)
    if application is None:
        return None
    if not is_valid_application_transition(application.status, new_status):
        raise ValueError(f"invalid_transition:{application.status}->{new_status}")
    now = datetime.now(UTC)
    # Conversion en bail : soit on rattache un bail existant (fourni & validé
    # ∈ tenant par le router), soit on auto-crée contrat + bail + échéancier.
    # On résout AVANT de muter le statut → si la création échoue, rien n'est
    # commité (la candidature reste dans son état d'origine).
    if new_status == "converted":
        if converted_rental_id is not None:
            application.converted_rental_id = converted_rental_id
        else:
            rental = await convert_application_to_lease(
                db,
                company_id,
                application,
                start_date=start_date,
                end_date=end_date,
                deposit=deposit,
                payment_frequency=payment_frequency,
            )
            application.converted_rental_id = rental.id
    application.status = new_status
    # Horodatage de décision sur les états décisifs.
    if new_status in ("approved", "rejected", "converted") and application.decided_at is None:
        application.decided_at = now
    application.updated_at = now
    await db.commit()
    await db.refresh(application)
    return application
