"""
CompanySettings — paramètres UAE centralisés, une ligne par société.

Avant ce module les réglages étaient dispersés (TVA implicite, Ejari/DEWA au
niveau unité, etc.). Cette table regroupe la configuration globale du tenant :
TVA (5 % UAE par défaut), devise, fuseau, préfixes de références, activation
Ejari / DLD. Contrainte d'unicité sur `company_id` → singleton par tenant.
"""
import uuid
from decimal import Decimal

from sqlalchemy import DECIMAL, Boolean, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class CompanySettings(Base, TimestampMixin, TenantMixin):
    """Configuration UAE d'une société (singleton par tenant). Loi 1 (RLS)."""

    __tablename__ = "company_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="AED")
    vat_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    vat_rate: Mapped[Decimal] = mapped_column(
        DECIMAL(5, 2), nullable=False, default=Decimal("5.00")
    )

    default_emirate: Mapped[str] = mapped_column(
        String(3), nullable=False, default="DXB"
    )
    timezone: Mapped[str] = mapped_column(
        String(50), nullable=False, default="Asia/Dubai"
    )

    ejari_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    dld_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    fiscal_year_start_month: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1
    )
    invoice_prefix: Mapped[str] = mapped_column(String(10), nullable=False, default="INV")
    contract_prefix: Mapped[str] = mapped_column(
        String(10), nullable=False, default="CTR"
    )
    default_payment_terms_days: Mapped[int] = mapped_column(
        Integer, nullable=False, default=30
    )

    extra = mapped_column(JSONB, nullable=False, default=dict)

    __table_args__ = (
        Index("uq_company_settings_company", "company_id", unique=True),
    )
