"""
Branch — succursale / agence physique au sein d'une société (multi-branch).

Une `Company` (tenant, Loi 1) peut exploiter plusieurs agences (Dubai Marina,
Business Bay, Abu Dhabi…). Le `Branch` est un découpage *interne* au tenant :
il ne remplace pas `company_id`, il le complète. Aucune autre table ne porte
encore de `branch_id` — l'affectation ciblée viendra plus tard si besoin.

Géolocalisation PostGIS : `location` (POINT 4326) + index GIST (Loi 2).
"""

import uuid

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class Branch(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Succursale d'une société. Loi 1 (RLS), Loi 2 (PostGIS GIST)."""

    __tablename__ = "branches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Code interne auto-généré, unique par tenant (ex : "BR-001")
    code: Mapped[str] = mapped_column(String(20), nullable=False)

    # Nom principal + déclinaisons multilingues
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    name_ar: Mapped[str | None] = mapped_column(String(200), nullable=True)
    name_en: Mapped[str | None] = mapped_column(String(200), nullable=True)
    name_fr: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Localisation
    emirate: Mapped[str] = mapped_column(String(3), nullable=False, default="DXB")
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    location = mapped_column(Geometry("POINT", srid=4326), nullable=True)

    # Contacts
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Responsable d'agence (utilisateur interne)
    manager_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        Index("idx_branches_company", "company_id"),
        Index("uq_branches_company_code", "company_id", "code", unique=True),
        Index("idx_branches_location_gist", "location", postgresql_using="gist"),
    )
