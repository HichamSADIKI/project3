"""Service — Clients. Toujours filtrer par company_id (Loi 1)."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.routers.clients.schemas import ClientCreate, ClientUpdate


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

    client.updated_at = datetime.now(timezone.utc)
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

    client.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return True
