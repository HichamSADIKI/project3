import uuid

from sqlalchemy import DECIMAL, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class Client(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """
    Client (individu ou société) — source: CRM, portail, référral, walk-in, site web.
    RLS actif via company_id (TenantMixin).
    """

    __tablename__ = "clients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Type: individual / company
    type: Mapped[str] = mapped_column(String(20), nullable=False)

    # Individu
    first_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(150), nullable=True)

    # Société
    company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Contact
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    phone2: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Géographie
    nationality: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country_of_residence: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Provenance
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Budget AED
    budget_min: Mapped[float | None] = mapped_column(DECIMAL(15, 2), nullable=True)
    budget_max: Mapped[float | None] = mapped_column(DECIMAL(15, 2), nullable=True)

    # Préférences
    preferred_property_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    preferred_location: Mapped[str | None] = mapped_column(String(150), nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relation agent responsable
    assigned_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
