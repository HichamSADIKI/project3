"""Modèle SQLAlchemy — Journal des relances d'impayés (finance / dunning).

Append-only : chaque relance envoyée pour une facture impayée crée une ligne
(niveau d'escalade + canal). RLS actif via company_id (Loi 1).
"""

import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class DunningEvent(Base, TimestampMixin, TenantMixin):
    """Relance envoyée pour une facture impayée. Loi 1 (RLS)."""

    __tablename__ = "finance_dunning_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("finance_transactions.id", ondelete="CASCADE"),
        nullable=False,
    )
    # email | whatsapp | in_app
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    # 1 (J+1) | 2 (J+7) | 3 (J+15)
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    recipient: Mapped[str | None] = mapped_column(String(255), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
