"""Service — Immobilier Core (branches + company settings).

Les helpers métier en tête de fichier sont *purs* (sans DB) et testés
isolément. Les fonctions CRUD async filtrent toujours par `company_id` (Loi 1).
"""
import re
import uuid
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.branch import Branch
from app.models.company_settings import CompanySettings
from app.routers.realestate_core.schemas import (
    BranchCreate,
    BranchUpdate,
    CompanySettingsUpdate,
)

# ─── Helpers métier purs ──────────────────────────────────────────────────

UAE_EMIRATES: frozenset[str] = frozenset(
    {"DXB", "AUH", "SHJ", "AJM", "RAK", "FUJ", "UAQ"}
)

_CODE_RE = re.compile(r"^BR-(\d{3,})$")


def is_valid_emirate(value: str) -> bool:
    """True si l'émirat fait partie des 7 émirats des UAE (codes internes)."""
    return value in UAE_EMIRATES


def generate_branch_code(existing_codes: list[str]) -> str:
    """Génère le prochain code séquentiel `BR-NNN` (≥ 3 chiffres).

    Ignore les codes hors format. `[]` → "BR-001". "BR-009" → "BR-010".
    Le numéro garde au minimum 3 chiffres mais s'étend au-delà de 999.
    """
    max_num = 0
    for code in existing_codes:
        match = _CODE_RE.match(code)
        if match:
            max_num = max(max_num, int(match.group(1)))
    return f"BR-{max_num + 1:03d}"


def compute_vat(amount: Decimal, rate: Decimal) -> Decimal:
    """Montant de TVA = amount × rate% arrondi à 2 décimales (UAE = 5 %)."""
    vat = amount * rate / Decimal("100")
    return vat.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def is_valid_fiscal_month(month: int) -> bool:
    """Mois de début d'exercice valide : 1..12."""
    return 1 <= month <= 12


def default_settings() -> dict[str, Any]:
    """Valeurs par défaut UAE utilisées à la création des settings d'un tenant."""
    return {
        "currency": "AED",
        "vat_enabled": True,
        "vat_rate": Decimal("5.00"),
        "default_emirate": "DXB",
        "timezone": "Asia/Dubai",
        "ejari_enabled": True,
        "dld_enabled": True,
        "fiscal_year_start_month": 1,
        "invoice_prefix": "INV",
        "contract_prefix": "CTR",
        "default_payment_terms_days": 30,
        "extra": {},
    }


def _location_wkt(location: dict[str, float] | None) -> str | None:
    """Sérialise un GeoPoint {lat,lng} en WKT pour PostGIS."""
    if location is None:
        return None
    return f"SRID=4326;POINT({location['lng']} {location['lat']})"


# ─── Branches CRUD ─────────────────────────────────────────────────────────


async def list_branches(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    emirate: str | None = None,
    is_active: bool | None = None,
) -> tuple[list[Branch], int]:
    base = select(Branch).where(
        Branch.company_id == company_id,
        Branch.deleted_at.is_(None),
    )
    if emirate:
        base = base.where(Branch.emirate == emirate)
    if is_active is not None:
        base = base.where(Branch.is_active.is_(is_active))

    total: int = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar_one()

    offset = (page - 1) * limit
    paginated = base.order_by(Branch.code).offset(offset).limit(limit)
    result = await db.execute(paginated)
    return list(result.scalars().all()), total


async def get_branch(
    db: AsyncSession, company_id: uuid.UUID, branch_id: uuid.UUID
) -> Branch | None:
    result = await db.execute(
        select(Branch).where(
            Branch.id == branch_id,
            Branch.company_id == company_id,
            Branch.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def _existing_codes(db: AsyncSession, company_id: uuid.UUID) -> list[str]:
    rows = await db.execute(
        select(Branch.code).where(Branch.company_id == company_id)
    )
    return [r for r in rows.scalars().all()]


async def create_branch(
    db: AsyncSession, company_id: uuid.UUID, data: BranchCreate
) -> Branch:
    code = data.code or generate_branch_code(await _existing_codes(db, company_id))
    branch = Branch(
        company_id=company_id,
        code=code,
        name=data.name,
        name_ar=data.name_ar,
        name_en=data.name_en,
        name_fr=data.name_fr,
        emirate=data.emirate,
        address=data.address,
        location=_location_wkt(data.location.model_dump() if data.location else None),
        phone=data.phone,
        email=data.email,
        manager_user_id=data.manager_user_id,
        is_active=data.is_active,
    )
    db.add(branch)
    await db.commit()
    await db.refresh(branch)
    return branch


async def update_branch(
    db: AsyncSession,
    company_id: uuid.UUID,
    branch_id: uuid.UUID,
    data: BranchUpdate,
) -> Branch | None:
    branch = await get_branch(db, company_id, branch_id)
    if branch is None:
        return None

    update_data = data.model_dump(exclude_unset=True)
    if "location" in update_data and update_data["location"] is not None:
        update_data["location"] = _location_wkt(update_data["location"])

    for field, value in update_data.items():
        setattr(branch, field, value)
    branch.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(branch)
    return branch


async def delete_branch(
    db: AsyncSession, company_id: uuid.UUID, branch_id: uuid.UUID
) -> bool:
    branch = await get_branch(db, company_id, branch_id)
    if branch is None:
        return False
    branch.deleted_at = datetime.now(UTC)
    await db.commit()
    return True


# ─── Company settings (singleton par tenant) ───────────────────────────────


async def get_or_create_settings(
    db: AsyncSession, company_id: uuid.UUID
) -> CompanySettings:
    result = await db.execute(
        select(CompanySettings).where(CompanySettings.company_id == company_id)
    )
    settings = result.scalar_one_or_none()
    if settings is not None:
        return settings

    settings = CompanySettings(company_id=company_id, **default_settings())
    db.add(settings)
    await db.commit()
    await db.refresh(settings)
    return settings


async def update_settings(
    db: AsyncSession, company_id: uuid.UUID, data: CompanySettingsUpdate
) -> CompanySettings:
    settings = await get_or_create_settings(db, company_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    settings.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(settings)
    return settings
