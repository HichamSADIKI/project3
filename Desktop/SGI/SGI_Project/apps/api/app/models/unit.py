"""
Unit — atome locatif / vendable au sein d'un Building.

Une Unit est l'entité concrète qu'on loue, qu'on vend, qu'on inspecte,
qu'on maintient, qu'on raccorde DEWA/ADDC. La table `properties` legacy est
conservée telle quelle ; les nouveaux modules (maintenance, inspections,
compteurs, parking) référencent Unit.

Lien optionnel vers `properties` via `legacy_property_id` pour ponts de
migration progressifs.
"""

import uuid

from sqlalchemy import (
    DECIMAL,
    Boolean,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class Unit(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Unité d'un bâtiment. Loi 1 (RLS), soft delete."""

    __tablename__ = "units"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    building_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("buildings.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    floor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("floors.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Numéro d'unité dans le bâtiment (ex : "4502", "B12", "G-05")
    unit_number: Mapped[str] = mapped_column(String(50), nullable=False)

    # Typologie
    # studio | apartment_1br | apartment_2br | apartment_3br | apartment_4br_plus
    # | penthouse | duplex | villa | townhouse | office | shop | warehouse | other
    unit_type: Mapped[str] = mapped_column(String(30), nullable=False)

    # Statut commercial (synchronisé avec leases/contracts)
    # vacant | occupied | reserved | maintenance | renovation | off_market
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="vacant")

    # Caractéristiques physiques
    area_sqm: Mapped[float | None] = mapped_column(DECIMAL(10, 2), nullable=True)
    bedrooms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bathrooms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    parking_spaces: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    furnished: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Prix / loyer de référence
    list_rent_aed: Mapped[float | None] = mapped_column(DECIMAL(15, 2), nullable=True)
    list_sale_aed: Mapped[float | None] = mapped_column(DECIMAL(15, 2), nullable=True)

    # Lien optionnel vers la fiche `properties` historique
    legacy_property_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Numéros UAE
    ejari_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    dewa_account_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    addc_account_number: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Inventaire équipements (clim, électroménager, mobilier…)
    inventory = mapped_column(JSONB, nullable=False, default=list)
    images = mapped_column(JSONB, nullable=False, default=list)
    floor_plan_paths = mapped_column(JSONB, nullable=False, default=list)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("building_id", "unit_number", name="uq_units_building_number"),
        Index("idx_units_company", "company_id"),
        Index("idx_units_status", "status"),
        Index("idx_units_type", "unit_type"),
    )
