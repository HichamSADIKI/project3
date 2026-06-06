"""
Technician — technicien interne salarié de l'agence.

NB : un technicien est un User (employé), pas un Client. Le profil étend
donc users (FK 1-1 via user_id PK), pas clients. Distinction importante :
- techniciens internes  → users
- prestataires externes → vendors
"""

import uuid
from decimal import Decimal

from sqlalchemy import DECIMAL, Boolean, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class Technician(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Profil Technicien interne — étend User."""

    __tablename__ = "technicians"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # Compétences (codes libres : plumbing, electrical, hvac, painting, ...)
    skills = mapped_column(JSONB, nullable=False, default=list)

    # Zones d'intervention (codes émirats : DXB, AUH, ...)
    assigned_zones = mapped_column(JSONB, nullable=False, default=list)

    # Notation interne (5 étoiles, basée sur ratings après intervention)
    rating_avg: Mapped[Decimal] = mapped_column(DECIMAL(3, 2), nullable=False, default=0)
    rating_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # KPI opérationnels
    jobs_completed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    avg_resolution_hours: Mapped[Decimal | None] = mapped_column(DECIMAL(6, 2), nullable=True)

    # Disponibilité mobile
    mobile_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    on_call: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    emergency_contact_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    __table_args__ = (
        Index("idx_technicians_company", "company_id"),
        Index("idx_technicians_mobile_active", "mobile_active"),
    )
