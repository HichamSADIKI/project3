"""Service — Rentals. Toujours filtrer par company_id (Loi 1)."""

import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.rental import Rental
from app.routers.rentals.schemas import RentalCreate, RentalUpdate


def summarize_rent_roll(rentals: list[Rental]) -> dict[str, Any]:
    """Rent roll : revenu locatif récurrent des baux ACTIFS + répartition par statut.

    - ``monthly_rent_aed`` / ``annual_rent_aed`` : somme des loyers des baux ``active`` ;
    - ``active_count`` / ``total_count`` ; ``by_status`` : nb de baux par statut.
    Montants en ``Decimal`` AED.
    """
    by_status: dict[str, int] = {}
    monthly = Decimal("0.00")
    annual = Decimal("0.00")
    active_count = 0
    for r in rentals:
        by_status[r.status] = by_status.get(r.status, 0) + 1
        if r.status == "active":
            active_count += 1
            monthly += Decimal(str(r.monthly_rent))
            annual += Decimal(str(r.annual_rent))
    return {
        "by_status": by_status,
        "active_count": active_count,
        "total_count": len(rentals),
        "monthly_rent_aed": monthly,
        "annual_rent_aed": annual,
    }


async def rent_roll_summary(db: AsyncSession, company_id: uuid.UUID) -> dict[str, Any]:
    """Synthèse rent roll du tenant (Loi 1 : scopé company_id)."""
    result = await db.execute(
        select(Rental).where(Rental.company_id == company_id, Rental.deleted_at.is_(None))
    )
    return summarize_rent_roll(list(result.scalars().all()))


def _add_months(d: date, months: int) -> date:
    """Ajoute `months` mois à une date sans dépendance externe."""
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    # Clamp le jour si nécessaire (ex: 31 janvier + 1 mois → 28/29 février)
    import calendar

    last_day = calendar.monthrange(year, month)[1]
    day = min(d.day, last_day)
    return date(year, month, day)


def _build_payment_schedule(
    start_date: date,
    end_date: date,
    monthly_rent: Decimal,
    payment_frequency: str,
) -> list[dict]:
    """
    Génère le calendrier de paiement selon la fréquence choisie.
    Retourne une liste de {due_date, amount, status, paid_at}.
    """
    frequency_months = {
        "monthly": 1,
        "quarterly": 3,
        "semi_annual": 6,
        "annual": 12,
    }
    months_interval = frequency_months.get(payment_frequency, 1)
    period_amount = monthly_rent * months_interval

    schedule: list[dict] = []
    current = start_date
    while current <= end_date:
        schedule.append(
            {
                "due_date": current.isoformat(),
                "amount": str(period_amount),
                "status": "pending",
                "paid_at": None,
            }
        )
        current = _add_months(current, months_interval)

    return schedule


async def list_rentals(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    status: str | None = None,
    expiring_in_days: int | None = None,
) -> tuple[list[Rental], int]:
    """Retourne la liste paginée des baux du tenant, avec filtres optionnels."""
    base_query = select(Rental).where(
        Rental.company_id == company_id,
        Rental.deleted_at.is_(None),
    )

    if status:
        base_query = base_query.where(Rental.status == status)

    if expiring_in_days is not None:
        today = date.today()
        cutoff = today + timedelta(days=expiring_in_days)
        base_query = base_query.where(
            Rental.end_date >= today,
            Rental.end_date <= cutoff,
        )

    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total: int = total_result.scalar_one()

    offset = (page - 1) * limit
    paginated_query = base_query.order_by(Rental.end_date.asc()).offset(offset).limit(limit)
    result = await db.execute(paginated_query)
    rentals = list(result.scalars().all())

    return rentals, total


async def get_rental(
    db: AsyncSession,
    company_id: uuid.UUID,
    rental_id: uuid.UUID,
) -> Rental | None:
    """Récupère un bail par son ID dans le tenant courant."""
    result = await db.execute(
        select(Rental).where(
            Rental.id == rental_id,
            Rental.company_id == company_id,
            Rental.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def create_rental(
    db: AsyncSession,
    company_id: uuid.UUID,
    data: RentalCreate,
) -> Rental:
    """
    Crée un bail locatif.
    - Calcule annual_rent = monthly_rent * 12
    - Génère le payment_schedule selon la fréquence
    """
    annual_rent = data.monthly_rent * 12
    payment_schedule = _build_payment_schedule(
        data.start_date,
        data.end_date,
        data.monthly_rent,
        data.payment_frequency,
    )

    rental = Rental(
        company_id=company_id,
        contract_id=data.contract_id,
        client_id=data.client_id,
        property_id=data.property_id,
        monthly_rent=data.monthly_rent,
        annual_rent=annual_rent,
        deposit=data.deposit,
        payment_frequency=data.payment_frequency,
        status="active",
        start_date=data.start_date,
        end_date=data.end_date,
        renewal_alert_sent=False,
        payment_schedule=payment_schedule,
    )
    db.add(rental)
    await db.commit()
    await db.refresh(rental)
    return rental


async def update_rental(
    db: AsyncSession,
    company_id: uuid.UUID,
    rental_id: uuid.UUID,
    data: RentalUpdate,
) -> Rental | None:
    """Met à jour les champs fournis d'un bail existant."""
    rental = await get_rental(db, company_id, rental_id)
    if not rental:
        return None

    update_data = data.model_dump(exclude_unset=True)

    # Si le loyer mensuel change, recalcule le loyer annuel
    if "monthly_rent" in update_data:
        update_data["annual_rent"] = update_data["monthly_rent"] * 12

    for field, value in update_data.items():
        setattr(rental, field, value)

    rental.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(rental)
    return rental


async def get_expiring_rentals(
    db: AsyncSession,
    company_id: uuid.UUID,
    days: int = 120,
) -> list[Rental]:
    """Retourne les baux expirant dans `days` jours (pour les alertes J-120)."""
    today = date.today()
    cutoff = today + timedelta(days=days)
    result = await db.execute(
        select(Rental)
        .where(
            Rental.company_id == company_id,
            Rental.deleted_at.is_(None),
            Rental.status == "active",
            Rental.end_date >= today,
            Rental.end_date <= cutoff,
        )
        .order_by(Rental.end_date.asc())
    )
    return list(result.scalars().all())
