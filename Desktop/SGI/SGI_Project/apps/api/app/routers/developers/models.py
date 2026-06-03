"""Modèle SQLAlchemy — Developers / Promoteurs (migration 0037).

`developers` : annuaire des promoteurs immobiliers d'un tenant (Emaar, DAMAC…).
Entité autonome (pas un profil de `clients`). RLS via company_id (Loi 1).
"""

import uuid

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class Developer(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Promoteur immobilier. RLS via company_id (Loi 1)."""

    __tablename__ = "developers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Référence interne triable par tenant (ex : "DEV-2026-000042").
    reference: Mapped[str] = mapped_column(String(20), nullable=False)

    # Raison sociale multilingue (name_en obligatoire — affiché par défaut).
    name_en: Mapped[str] = mapped_column(String(300), nullable=False)
    name_ar: Mapped[str | None] = mapped_column(String(300), nullable=True)
    name_fr: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # Localisation & licence
    city: Mapped[str | None] = mapped_column(String(150), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    trade_license: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Contact
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Indicateurs portefeuille
    projects_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    units_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # company_id / created_at / updated_at / deleted_at fournis par les mixins.
