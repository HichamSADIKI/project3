"""Service — Clients. Toujours filtrer par company_id (Loi 1)."""

import csv
import io
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from pydantic import ValidationError
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.routers.clients.schemas import ClientCreate, ClientUpdate

# Seuil de budget éligible Golden Visa (AED) — cf. règles CRM (CLAUDE.md).
GOLDEN_VISA_BUDGET_THRESHOLD = Decimal("2000000")

# Borne anti-abus pour l'import CSV (au-delà → import asynchrone à prévoir).
CSV_IMPORT_MAX_ROWS = 1000


def _first_validation_error(exc: ValidationError) -> str:
    """Message d'erreur lisible (1ʳᵉ erreur) pour le rapport d'import."""
    err = exc.errors()[0]
    loc = ".".join(str(x) for x in err.get("loc", ()) if x != "__root__")
    msg = err.get("msg", "invalid")
    return f"{loc}: {msg}" if loc else msg


def parse_client_rows(content: str) -> tuple[list[ClientCreate], list[dict[str, Any]]]:
    """Parse + valide un CSV de clients (PUR, sans DB).

    En-têtes attendus = noms de champs `ClientCreate` (colonnes inconnues
    ignorées ; cellules vides → None). Retourne (valides, erreurs) où chaque
    erreur = {"line": n, "error": msg} (ligne 1 = en-têtes, données dès la 2).
    Au-delà de `CSV_IMPORT_MAX_ROWS` lignes de données, le surplus est signalé
    (anti-abus)."""
    valid: list[ClientCreate] = []
    errors: list[dict[str, Any]] = []
    reader = csv.DictReader(io.StringIO(content))
    for idx, raw in enumerate(reader, start=2):
        if idx - 1 > CSV_IMPORT_MAX_ROWS:
            errors.append({"line": idx, "error": f"row_limit_exceeded ({CSV_IMPORT_MAX_ROWS})"})
            break
        cleaned = {
            k.strip(): (v.strip() if isinstance(v, str) else v)
            for k, v in raw.items()
            if k is not None
        }
        if not any(cleaned.values()):  # ligne entièrement vide → ignorée
            continue
        payload = {k: (v if v not in ("", None) else None) for k, v in cleaned.items()}
        try:
            valid.append(ClientCreate(**payload))
        except ValidationError as exc:
            errors.append({"line": idx, "error": _first_validation_error(exc)})
    return valid, errors


def summarize_clients(clients: list[Client]) -> dict[str, Any]:
    """Segmentation du portefeuille clients : par type, par source, et nombre de
    clients dont le budget max atteint le seuil Golden Visa. Helper pur."""
    by_type: dict[str, int] = {}
    by_source: dict[str, int] = {}
    gv_budget = 0
    for c in clients:
        by_type[c.type] = by_type.get(c.type, 0) + 1
        source = c.source or "unknown"
        by_source[source] = by_source.get(source, 0) + 1
        if c.budget_max is not None and Decimal(str(c.budget_max)) >= GOLDEN_VISA_BUDGET_THRESHOLD:
            gv_budget += 1
    return {
        "by_type": by_type,
        "by_source": by_source,
        "golden_visa_budget_count": gv_budget,
        "total": len(clients),
    }


async def clients_segmentation(db: AsyncSession, company_id: uuid.UUID) -> dict[str, Any]:
    """Segmentation du portefeuille clients du tenant (Loi 1 : scopé company_id)."""
    result = await db.execute(
        select(Client).where(Client.company_id == company_id, Client.deleted_at.is_(None))
    )
    return summarize_clients(list(result.scalars().all()))


async def list_clients(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    type_: str | None = None,
    q: str | None = None,
) -> tuple[list[Client], int]:
    """Retourne la liste paginée des clients du tenant, avec filtres optionnels."""
    base_query = select(Client).where(
        Client.company_id == company_id,
        Client.deleted_at.is_(None),
    )

    if type_:
        base_query = base_query.where(Client.type == type_)

    if q:
        pattern = f"%{q}%"
        base_query = base_query.where(
            or_(
                Client.first_name.ilike(pattern),
                Client.last_name.ilike(pattern),
                Client.company_name.ilike(pattern),
                Client.email.ilike(pattern),
                Client.phone.ilike(pattern),
            )
        )

    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total: int = total_result.scalar_one()

    offset = (page - 1) * limit
    paginated_query = base_query.order_by(Client.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(paginated_query)
    clients = list(result.scalars().all())

    return clients, total


async def get_client(
    db: AsyncSession,
    company_id: uuid.UUID,
    client_id: uuid.UUID,
) -> Client | None:
    """Récupère un client par son ID dans le tenant courant."""
    result = await db.execute(
        select(Client).where(
            Client.id == client_id,
            Client.company_id == company_id,
            Client.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def create_client(
    db: AsyncSession,
    company_id: uuid.UUID,
    data: ClientCreate,
) -> Client:
    """Crée un nouveau client pour le tenant."""
    client = Client(
        company_id=company_id,
        type=data.type,
        first_name=data.first_name,
        last_name=data.last_name,
        company_name=data.company_name,
        email=str(data.email) if data.email else None,
        phone=data.phone,
        phone2=data.phone2,
        nationality=data.nationality,
        country_of_residence=data.country_of_residence,
        source=data.source,
        budget_min=data.budget_min,
        budget_max=data.budget_max,
        preferred_property_type=data.preferred_property_type,
        preferred_location=data.preferred_location,
        notes=data.notes,
        assigned_agent_id=data.assigned_agent_id,
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


async def update_client(
    db: AsyncSession,
    company_id: uuid.UUID,
    client_id: uuid.UUID,
    data: ClientUpdate,
) -> Client | None:
    """Met à jour les champs fournis d'un client existant."""
    client = await get_client(db, company_id, client_id)
    if not client:
        return None

    update_data = data.model_dump(exclude_unset=True)
    if "email" in update_data and update_data["email"] is not None:
        update_data["email"] = str(update_data["email"])

    for field, value in update_data.items():
        setattr(client, field, value)

    client.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(client)
    return client


async def delete_client(
    db: AsyncSession,
    company_id: uuid.UUID,
    client_id: uuid.UUID,
) -> bool:
    """Soft-delete : positionne deleted_at. Ne supprime jamais physiquement."""
    client = await get_client(db, company_id, client_id)
    if not client:
        return False

    client.deleted_at = datetime.now(UTC)
    await db.commit()
    return True
