"""
Building — actif physique (immeuble, tour, compound de villas).

Hiérarchie : Building → Floor (optionnel) → Unit. Une villa-compound peut
n'avoir aucun Floor (Unit directement enfants du Building) ; une tour
résidentielle déclare un Floor par étage.

Géolocalisation PostGIS : un Building porte sa propre `location` (POINT
4326) + un polygone optionnel pour l'emprise au sol — futur usage carte.
"""

import uuid
from decimal import Decimal

from geoalchemy2 import Geometry
from sqlalchemy import DECIMAL, Boolean, Date, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class Building(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Immeuble physique. Loi 1 (RLS), Loi 2 (PostGIS GIST)."""

    __tablename__ = "buildings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Référence interne unique par tenant (ex : "BLD-DXB-MARINA-A")
    reference: Mapped[str] = mapped_column(String(50), nullable=False)

    # Propriétaire (Owner profile). Peut être NULL : bien sous gestion sans owner
    # déclaré (cas d'imports legacy).
    owner_party_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("owners.party_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Nom multilingue
    name_ar: Mapped[str | None] = mapped_column(String(300), nullable=True)
    name_en: Mapped[str | None] = mapped_column(String(300), nullable=True)
    name_fr: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # Typologie
    # residential_tower | villa_compound | mixed_use | commercial | warehouse
    building_type: Mapped[str] = mapped_column(String(30), nullable=False)

    # Géographie
    location = mapped_column(Geometry("POINT", srid=4326), nullable=True)
    footprint = mapped_column(Geometry("POLYGON", srid=4326), nullable=True)
    address_en: Mapped[str | None] = mapped_column(String(300), nullable=True)
    address_ar: Mapped[str | None] = mapped_column(String(300), nullable=True)
    district: Mapped[str | None] = mapped_column(String(150), nullable=True)
    emirate: Mapped[str] = mapped_column(String(3), nullable=False, default="DXB")

    # Caractéristiques physiques
    total_floors: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_units: Mapped[int | None] = mapped_column(Integer, nullable=True)
    year_built: Mapped[int | None] = mapped_column(Integer, nullable=True)
    developer: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Statut commercial du bâtiment entier
    # operational | under_renovation | off_market | demolished
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="operational")

    # Données DLD
    dld_property_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    dld_tenure: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # freehold | leasehold

    # Assurance bâtiment
    insurance_policy_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    insurance_expiry: Mapped[Date | None] = mapped_column(Date, nullable=True)

    # Aménités communes (piscine, gym, parking visiteurs…)
    amenities = mapped_column(JSONB, nullable=False, default=list)
    images = mapped_column(JSONB, nullable=False, default=list)
    documents = mapped_column(JSONB, nullable=False, default=list)

    # Valorisation estimée
    estimated_value_aed: Mapped[Decimal | None] = mapped_column(DECIMAL(15, 2), nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    has_active_security_contract: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    has_active_cleaning_contract: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    __table_args__ = (
        Index("idx_buildings_company", "company_id"),
        Index("idx_buildings_owner", "owner_party_id"),
        Index("idx_buildings_location_gist", "location", postgresql_using="gist"),
        Index("idx_buildings_emirate", "emirate"),
    )
