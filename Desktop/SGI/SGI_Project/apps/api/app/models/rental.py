import uuid
from datetime import date

from sqlalchemy import DECIMAL, Boolean, Date, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class Rental(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """
    Bail locatif lié à un contrat.
    Alerte de renouvellement envoyée à J-120 (automatisme post-close).
    Le calendrier de paiement est stocké en JSONB :
      [{due_date, amount, status, paid_at}, ...]
    RLS actif via company_id (TenantMixin).
    """

    __tablename__ = "rentals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Liaison contrat (1-to-1)
    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="RESTRICT"),
        unique=True,
        nullable=False,
        index=True,
    )

    # Parties
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Loyers AED
    monthly_rent: Mapped[float] = mapped_column(DECIMAL(15, 2), nullable=False)
    annual_rent: Mapped[float] = mapped_column(DECIMAL(15, 2), nullable=False)
    deposit: Mapped[float] = mapped_column(DECIMAL(15, 2), nullable=False, default=0)

    # Fréquence de paiement
    payment_frequency: Mapped[str] = mapped_column(
        String(20), nullable=False, default="monthly"
    )

    # Statut du bail
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")

    # Période
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)

    # Alerte renouvellement J-120
    renewal_alert_sent: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    # Calendrier de paiement JSONB
    payment_schedule = mapped_column(JSONB, nullable=False, default=list)

    # Renouvellement (M5) — bail parent dont celui-ci est le renouvellement
    renewed_from_rental_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rentals.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
