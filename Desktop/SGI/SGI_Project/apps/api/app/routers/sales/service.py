"""Service Vente (sales).

- **Helpers purs** (sans DB) : génération de référence, calcul de commission,
  machines à états (mandat / annonce / offre / transaction).
- **Fonctions DB** : toutes filtrées par company_id (Loi 1) — CRUD + transitions.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.routers.sales.models import (
    SaleListing,
    SaleMandate,
    SaleOffer,
    SaleTransaction,
)

# ─────────────────────────────────────────────────────────────────────────
# Helpers purs (sans DB)
# ─────────────────────────────────────────────────────────────────────────

_TWO_PLACES = Decimal("0.01")


def generate_reference(year: int, sequence: int) -> str:
    """Référence triable lexicographiquement : `SALE-2026-000042`."""
    return f"SALE-{year:04d}-{sequence:06d}"


def compute_commission(final_price: Decimal, commission_rate: Decimal) -> Decimal:
    """Commission = final_price × rate / 100, arrondie à 2 décimales (HALF_UP).

    `commission_rate` est un pourcentage (ex. 2.00 → 2 %). Gère rate=0.
    """
    raw = final_price * commission_rate / Decimal("100")
    return raw.quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)


# Machines à états — chaque dict : état courant → ensemble des cibles valides.
# Un état absent du dict est terminal (aucune transition sortante).

_MANDATE_TRANSITIONS: dict[str, frozenset[str]] = {
    "active": frozenset({"sold", "expired", "cancelled"}),
}

_LISTING_TRANSITIONS: dict[str, frozenset[str]] = {
    "draft": frozenset({"published", "withdrawn"}),
    "published": frozenset({"under_offer", "withdrawn", "sold"}),
    "under_offer": frozenset({"sold", "published", "withdrawn"}),
    "withdrawn": frozenset({"published"}),
    # "sold" est terminal.
}

_OFFER_TRANSITIONS: dict[str, frozenset[str]] = {
    "submitted": frozenset({"accepted", "rejected", "withdrawn"}),
}

_TRANSACTION_TRANSITIONS: dict[str, frozenset[str]] = {
    "pending": frozenset({"completed", "cancelled"}),
}


def _is_valid(table: dict[str, frozenset[str]], current: str, target: str) -> bool:
    if current == target:
        return False
    return target in table.get(current, frozenset())


def is_valid_mandate_transition(current: str, target: str) -> bool:
    return _is_valid(_MANDATE_TRANSITIONS, current, target)


def is_valid_listing_transition(current: str, target: str) -> bool:
    return _is_valid(_LISTING_TRANSITIONS, current, target)


def is_valid_offer_transition(current: str, target: str) -> bool:
    return _is_valid(_OFFER_TRANSITIONS, current, target)


def is_valid_transaction_transition(current: str, target: str) -> bool:
    return _is_valid(_TRANSACTION_TRANSITIONS, current, target)


# ─────────────────────────────────────────────────────────────────────────
# Fonctions DB — toutes filtrées par company_id (Loi 1)
# ─────────────────────────────────────────────────────────────────────────


async def next_reference(db: AsyncSession, company_id: uuid.UUID, model: type[Any]) -> str:
    """Prochaine référence `SALE-YYYY-NNNNNN`, séquentielle par préfixe annuel.

    La séquence est comptée par table (`model`) ET par société — la contrainte
    d'unicité étant `(company_id, reference)`, chaque table a son propre compteur.
    """
    year = datetime.now(UTC).year
    # Verrou consultatif transactionnel (libéré au COMMIT) : sérialise les
    # créations concurrentes du même tenant/année/table → COUNT+INSERT race-free
    # (clé par table car chaque entité a son propre compteur SALE-YYYY-NNNNNN).
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:k))"),
        {"k": f"SALE:{model.__tablename__}:{company_id}:{year}"},
    )
    result = await db.execute(
        select(func.count())
        .select_from(model)
        .where(
            model.company_id == company_id,
            model.reference.like(f"SALE-{year:04d}-%"),
        )
    )
    return generate_reference(year, result.scalar_one() + 1)


# ── Mandats ────────────────────────────────────────────────────────────────


async def create_mandate(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    seller_client_id: uuid.UUID,
    property_id: uuid.UUID | None = None,
    mandate_type: str = "exclusive",
    commission_rate: Decimal = Decimal("2.00"),
    asking_price: Decimal | None = None,
) -> SaleMandate:
    mandate = SaleMandate(
        company_id=company_id,
        reference=await next_reference(db, company_id, SaleMandate),
        seller_client_id=seller_client_id,
        property_id=property_id,
        mandate_type=mandate_type,
        commission_rate=commission_rate,
        asking_price=asking_price,
        status="active",
    )
    db.add(mandate)
    await db.commit()
    await db.refresh(mandate)
    return mandate


async def get_mandate(
    db: AsyncSession, company_id: uuid.UUID, mandate_id: uuid.UUID
) -> SaleMandate | None:
    result = await db.execute(
        select(SaleMandate).where(
            SaleMandate.id == mandate_id,
            SaleMandate.company_id == company_id,
            SaleMandate.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def list_mandates(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    status: str | None = None,
) -> tuple[list[SaleMandate], int]:
    base = select(SaleMandate).where(
        SaleMandate.company_id == company_id,
        SaleMandate.deleted_at.is_(None),
    )
    if status:
        base = base.where(SaleMandate.status == status)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    offset = (page - 1) * limit
    rows = (
        (await db.execute(base.order_by(SaleMandate.created_at.desc()).offset(offset).limit(limit)))
        .scalars()
        .all()
    )
    return list(rows), total


async def transition_mandate(
    db: AsyncSession, company_id: uuid.UUID, mandate_id: uuid.UUID, new_status: str
) -> SaleMandate | None:
    mandate = await get_mandate(db, company_id, mandate_id)
    if mandate is None:
        return None
    if not is_valid_mandate_transition(mandate.status, new_status):
        raise ValueError(f"invalid_transition:{mandate.status}->{new_status}")
    mandate.status = new_status
    mandate.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(mandate)
    return mandate


# ── Annonces ─────────────────────────────────────────────────────────────


async def create_listing(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    mandate_id: uuid.UUID,
    list_price: Decimal,
    title_ar: str | None = None,
    title_en: str | None = None,
    title_fr: str | None = None,
) -> SaleListing:
    listing = SaleListing(
        company_id=company_id,
        reference=await next_reference(db, company_id, SaleListing),
        mandate_id=mandate_id,
        title_ar=title_ar,
        title_en=title_en,
        title_fr=title_fr,
        list_price=list_price,
        status="draft",
    )
    db.add(listing)
    await db.commit()
    await db.refresh(listing)
    return listing


async def get_listing(
    db: AsyncSession, company_id: uuid.UUID, listing_id: uuid.UUID
) -> SaleListing | None:
    result = await db.execute(
        select(SaleListing).where(
            SaleListing.id == listing_id,
            SaleListing.company_id == company_id,
            SaleListing.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def list_listings(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    status: str | None = None,
    mandate_id: uuid.UUID | None = None,
) -> tuple[list[SaleListing], int]:
    base = select(SaleListing).where(
        SaleListing.company_id == company_id,
        SaleListing.deleted_at.is_(None),
    )
    if status:
        base = base.where(SaleListing.status == status)
    if mandate_id:
        base = base.where(SaleListing.mandate_id == mandate_id)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    offset = (page - 1) * limit
    rows = (
        (await db.execute(base.order_by(SaleListing.created_at.desc()).offset(offset).limit(limit)))
        .scalars()
        .all()
    )
    return list(rows), total


async def transition_listing(
    db: AsyncSession, company_id: uuid.UUID, listing_id: uuid.UUID, new_status: str
) -> SaleListing | None:
    listing = await get_listing(db, company_id, listing_id)
    if listing is None:
        return None
    if not is_valid_listing_transition(listing.status, new_status):
        raise ValueError(f"invalid_transition:{listing.status}->{new_status}")
    listing.status = new_status
    if new_status == "published" and listing.published_at is None:
        listing.published_at = datetime.now(UTC)
    listing.updated_at = datetime.now(UTC)
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
) -> SaleListing | None:
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


# ── Offres ───────────────────────────────────────────────────────────────


async def create_offer(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    listing_id: uuid.UUID,
    buyer_client_id: uuid.UUID,
    amount: Decimal,
) -> SaleOffer:
    offer = SaleOffer(
        company_id=company_id,
        reference=await next_reference(db, company_id, SaleOffer),
        listing_id=listing_id,
        buyer_client_id=buyer_client_id,
        amount=amount,
        status="submitted",
    )
    db.add(offer)
    await db.commit()
    await db.refresh(offer)
    return offer


async def get_offer(
    db: AsyncSession, company_id: uuid.UUID, offer_id: uuid.UUID
) -> SaleOffer | None:
    result = await db.execute(
        select(SaleOffer).where(
            SaleOffer.id == offer_id,
            SaleOffer.company_id == company_id,
            SaleOffer.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def list_offers(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    listing_id: uuid.UUID | None = None,
    status: str | None = None,
) -> tuple[list[SaleOffer], int]:
    base = select(SaleOffer).where(
        SaleOffer.company_id == company_id,
        SaleOffer.deleted_at.is_(None),
    )
    if listing_id:
        base = base.where(SaleOffer.listing_id == listing_id)
    if status:
        base = base.where(SaleOffer.status == status)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    offset = (page - 1) * limit
    rows = (
        (await db.execute(base.order_by(SaleOffer.created_at.desc()).offset(offset).limit(limit)))
        .scalars()
        .all()
    )
    return list(rows), total


async def transition_offer(
    db: AsyncSession, company_id: uuid.UUID, offer_id: uuid.UUID, new_status: str
) -> SaleOffer | None:
    offer = await get_offer(db, company_id, offer_id)
    if offer is None:
        return None
    if not is_valid_offer_transition(offer.status, new_status):
        raise ValueError(f"invalid_transition:{offer.status}->{new_status}")
    offer.status = new_status
    offer.decided_at = datetime.now(UTC)
    offer.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(offer)
    return offer


# ── Transactions ───────────────────────────────────────────────────────────


async def create_transaction_from_offer(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    offer: SaleOffer,
    listing: SaleListing,
    mandate: SaleMandate,
    final_price: Decimal | None = None,
) -> SaleTransaction:
    """Crée une transaction depuis une offre `accepted`.

    Le prix final retombe sur le montant de l'offre si non fourni. La commission
    est calculée via `compute_commission` à partir du taux du mandat lié.
    """
    price = final_price if final_price is not None else offer.amount
    commission = compute_commission(price, mandate.commission_rate)
    transaction = SaleTransaction(
        company_id=company_id,
        reference=await next_reference(db, company_id, SaleTransaction),
        listing_id=listing.id,
        offer_id=offer.id,
        final_price=price,
        commission_amount=commission,
        status="pending",
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)
    return transaction


async def get_live_transaction_for_offer(
    db: AsyncSession, company_id: uuid.UUID, offer_id: uuid.UUID
) -> SaleTransaction | None:
    """Transaction non supprimée et non annulée déjà rattachée à cette offre.

    Sert de garde anti-double-comptabilisation : une offre acceptée ne peut
    donner lieu qu'à UNE transaction vivante (une transaction `cancelled`
    n'ayant pas abouti, une nouvelle reste alors permise).
    """
    result = await db.execute(
        select(SaleTransaction).where(
            SaleTransaction.company_id == company_id,
            SaleTransaction.offer_id == offer_id,
            SaleTransaction.status != "cancelled",
            SaleTransaction.deleted_at.is_(None),
        )
    )
    return result.scalars().first()


async def get_transaction(
    db: AsyncSession, company_id: uuid.UUID, transaction_id: uuid.UUID
) -> SaleTransaction | None:
    result = await db.execute(
        select(SaleTransaction).where(
            SaleTransaction.id == transaction_id,
            SaleTransaction.company_id == company_id,
            SaleTransaction.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def list_transactions(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    status: str | None = None,
) -> tuple[list[SaleTransaction], int]:
    base = select(SaleTransaction).where(
        SaleTransaction.company_id == company_id,
        SaleTransaction.deleted_at.is_(None),
    )
    if status:
        base = base.where(SaleTransaction.status == status)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    offset = (page - 1) * limit
    rows = (
        (
            await db.execute(
                base.order_by(SaleTransaction.created_at.desc()).offset(offset).limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return list(rows), total


async def transition_transaction(
    db: AsyncSession, company_id: uuid.UUID, transaction_id: uuid.UUID, new_status: str
) -> SaleTransaction | None:
    transaction = await get_transaction(db, company_id, transaction_id)
    if transaction is None:
        return None
    if not is_valid_transaction_transition(transaction.status, new_status):
        raise ValueError(f"invalid_transition:{transaction.status}->{new_status}")
    transaction.status = new_status
    if new_status == "completed" and transaction.closed_at is None:
        transaction.closed_at = datetime.now(UTC)
    transaction.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(transaction)
    return transaction
