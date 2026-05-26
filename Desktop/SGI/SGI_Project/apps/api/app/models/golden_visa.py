import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class GoldenVisaApplication(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """
    Dossier Golden Visa UAE.
    Éligibilité : bien immobilier ≥ 2 000 000 AED.
    Documents obligatoires : passeport, DLD, GDRFA, assurance, photo biométrique.
    Alertes automatiques : J-90 et J-30 avant expiration du visa.
    RLS actif via company_id (TenantMixin).
    """

    __tablename__ = "golden_visa_applications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Parties
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    property_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    contract_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    # Référence officielle du dossier
    application_number: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Statut du dossier
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")

    # Documents (chemins MinIO)
    passport_doc: Mapped[str | None] = mapped_column(String(500), nullable=True)
    dld_doc: Mapped[str | None] = mapped_column(String(500), nullable=True)
    gdrfa_doc: Mapped[str | None] = mapped_column(String(500), nullable=True)
    insurance_doc: Mapped[str | None] = mapped_column(String(500), nullable=True)
    biometric_photo: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Dates clés
    submission_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    approval_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    visa_expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Alertes envoyées
    alert_90_sent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    alert_30_sent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Agent responsable du dossier
    assigned_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
