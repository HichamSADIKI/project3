import uuid
from datetime import UTC, date, timedelta

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.golden_visa import GoldenVisaApplication
from app.routers.golden_visa.schemas import GoldenVisaCreate, GoldenVisaUpdate

VALID_STATUSES = {
    "pending",
    "documents_collection",
    "submitted",
    "under_review",
    "approved",
    "rejected",
    "expired",
}

# Documents obligatoires Golden Visa UAE (CLAUDE.md) → (attribut modèle, libellé).
REQUIRED_DOCUMENTS: list[tuple[str, str]] = [
    ("passport_doc", "passport"),
    ("dld_doc", "dld"),
    ("gdrfa_doc", "gdrfa"),
    ("insurance_doc", "insurance"),
    ("biometric_photo", "biometric_photo"),
]


# Types de documents uploadables (URL-friendly) → attribut modèle (colonne MinIO).
DOC_TYPE_TO_ATTR: dict[str, str] = {
    "passport": "passport_doc",
    "dld": "dld_doc",
    "gdrfa": "gdrfa_doc",
    "insurance": "insurance_doc",
    "biometric": "biometric_photo",
}

# Photo biométrique → image uniquement ; les autres acceptent aussi le PDF scanné.
_IMAGE_MIMES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}


def attr_for_doc_type(doc_type: str) -> str | None:
    """Attribut modèle (colonne chemin MinIO) pour un type de document, ou None."""
    return DOC_TYPE_TO_ATTR.get(doc_type)


def doc_mime_allowed(doc_type: str, content_type: str) -> bool:
    """Vrai si le MIME est accepté pour ce type de document Golden Visa.

    Photo biométrique → image uniquement ; passeport / DLD / GDRFA / assurance →
    PDF ou image scannée.
    """
    mime = (content_type or "").split(";")[0].strip().lower()
    if doc_type == "biometric":
        return mime in _IMAGE_MIMES
    return mime == "application/pdf" or mime in _IMAGE_MIMES


def build_gv_doc_key(company_id: uuid.UUID, app_id: uuid.UUID, doc_type: str, ext: str) -> str:
    """Clé objet MinIO d'un document Golden Visa (un objet par type → écrasement)."""
    return f"golden_visa/{company_id}/{app_id}/{doc_type}.{ext}"


def missing_documents(application: GoldenVisaApplication) -> list[str]:
    """Libellés des documents obligatoires encore absents du dossier."""
    return [label for attr, label in REQUIRED_DOCUMENTS if not getattr(application, attr, None)]


def present_documents(application: GoldenVisaApplication) -> list[str]:
    """Libellés des documents obligatoires déjà fournis."""
    return [label for attr, label in REQUIRED_DOCUMENTS if getattr(application, attr, None)]


def documents_readiness_pct(application: GoldenVisaApplication) -> int:
    """Taux de complétude documentaire (0–100), arrondi à l'entier."""
    total = len(REQUIRED_DOCUMENTS)
    present = total - len(missing_documents(application))
    return round(present / total * 100)


def visa_alert_level(
    today: date,
    visa_expiry_date: date | None,
    alert_90_sent: bool,
    alert_30_sent: bool,
) -> str | None:
    """Niveau d'alerte d'expiration Golden Visa à émettre, ou ``None``.

    Règle métier (CLAUDE.md) : alertes J-90 puis J-30 avant expiration. Le seuil
    le plus proche prime. Idempotence via les drapeaux déjà posés :

    - ``"30"`` si l'expiration est dans ≤ 30 jours (et pas encore dépassée) et que
      l'alerte J-30 n'a pas été envoyée ;
    - ``"90"`` si elle est dans ≤ 90 jours et que l'alerte J-90 n'a pas été envoyée ;
    - ``None`` sinon (pas de date, déjà expiré, hors fenêtre, ou déjà alerté).
    """
    if visa_expiry_date is None:
        return None
    days_left = (visa_expiry_date - today).days
    if days_left < 0:
        return None
    if days_left <= 30 and not alert_30_sent:
        return "30"
    if days_left <= 90 and not alert_90_sent:
        return "90"
    return None


async def _company_id(db: AsyncSession) -> uuid.UUID:
    result = await db.execute(text("SELECT current_setting('app.current_company_id', true)"))
    return uuid.UUID(result.scalar())


async def list_applications(
    db: AsyncSession,
    *,
    page: int = 1,
    limit: int = 20,
    status: str | None = None,
    client_id: uuid.UUID | None = None,
) -> dict:
    cid = await _company_id(db)
    q = select(GoldenVisaApplication).where(
        GoldenVisaApplication.company_id == cid,
        GoldenVisaApplication.deleted_at.is_(None),
    )
    if status:
        q = q.where(GoldenVisaApplication.status == status)
    if client_id:
        q = q.where(GoldenVisaApplication.client_id == client_id)

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar() or 0

    q = q.order_by(GoldenVisaApplication.created_at.desc())
    q = q.offset((page - 1) * limit).limit(limit)
    rows = (await db.execute(q)).scalars().all()

    return {
        "data": rows,
        "meta": {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": max(1, -(-total // limit)),
        },
    }


async def get_application(db: AsyncSession, app_id: uuid.UUID) -> GoldenVisaApplication | None:
    cid = await _company_id(db)
    result = await db.execute(
        select(GoldenVisaApplication).where(
            GoldenVisaApplication.id == app_id,
            GoldenVisaApplication.company_id == cid,
            GoldenVisaApplication.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def create_application(db: AsyncSession, payload: GoldenVisaCreate) -> GoldenVisaApplication:
    cid = await _company_id(db)
    app = GoldenVisaApplication(
        company_id=cid,
        **payload.model_dump(),
    )
    db.add(app)
    await db.commit()
    await db.refresh(app)
    return app


async def update_application(
    db: AsyncSession,
    app_id: uuid.UUID,
    payload: GoldenVisaUpdate,
) -> GoldenVisaApplication | None:
    app = await get_application(db, app_id)
    if not app:
        return None

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(app, k, v)

    await db.commit()
    await db.refresh(app)
    return app


async def set_document(
    db: AsyncSession, app_id: uuid.UUID, attr: str, file_path: str
) -> GoldenVisaApplication | None:
    """Renseigne le chemin MinIO d'un document sur le dossier (scopé tenant)."""
    app = await get_application(db, app_id)
    if not app:
        return None
    setattr(app, attr, file_path)
    await db.commit()
    await db.refresh(app)
    return app


async def delete_application(db: AsyncSession, app_id: uuid.UUID) -> bool:
    from datetime import datetime

    app = await get_application(db, app_id)
    if not app:
        return False
    app.deleted_at = datetime.now(UTC)
    await db.commit()
    return True


async def get_expiring_visas(db: AsyncSession, days: int = 90) -> list[GoldenVisaApplication]:
    """Returns applications with visa_expiry_date within the next `days` days."""
    cid = await _company_id(db)
    today = date.today()
    threshold = today + timedelta(days=days)

    result = await db.execute(
        select(GoldenVisaApplication).where(
            GoldenVisaApplication.company_id == cid,
            GoldenVisaApplication.deleted_at.is_(None),
            GoldenVisaApplication.status == "approved",
            GoldenVisaApplication.visa_expiry_date.isnot(None),
            GoldenVisaApplication.visa_expiry_date <= threshold,
            GoldenVisaApplication.visa_expiry_date >= today,
        )
    )
    return list(result.scalars().all())
