import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class VisitRequest(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Demande de visite d'un client pour une propriété."""

    __tablename__ = "visit_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="RESTRICT"),
        nullable=False,
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    preferred_date: Mapped[date] = mapped_column(Date, nullable=False)
    preferred_time_slot: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    client_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    agent_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
