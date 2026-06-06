"""Modèle SQLAlchemy — Clôture de période comptable (finance).

Une clôture verrouille les transactions dont la date est <= period_end.
"""

import uuid
from datetime import date

from sqlalchemy import Date, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class PeriodClosure(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Clôture d'une période finance jusqu'à `period_end` (inclus)."""

    __tablename__ = "finance_period_closures"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    closed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
