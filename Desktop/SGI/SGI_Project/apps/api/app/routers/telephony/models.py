"""Modèles SQLAlchemy — Téléphonie (migration 0028)."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class Call(Base, TimestampMixin, TenantMixin):
    """CDR applicatif : un appel entrant / sortant / interne.

    RLS active via company_id (TenantMixin). Pas de soft-delete : un appel est
    un événement historique immuable (le journal ne se supprime pas).
    """

    __tablename__ = "calls"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    reference: Mapped[str] = mapped_column(String(20), nullable=False)
    direction: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ringing")

    from_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    to_number: Mapped[str | None] = mapped_column(String(50), nullable=True)

    agent_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    agent_extension: Mapped[str | None] = mapped_column(String(20), nullable=True)
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True
    )
    queue: Mapped[str | None] = mapped_column(String(50), nullable=True)

    channel_id: Mapped[str | None] = mapped_column(String(150), nullable=True)
    sip_call_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    recording_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    recording_consent: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    answered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    wait_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hangup_cause: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class AgentState(Base, TimestampMixin, TenantMixin):
    """Présence / disponibilité téléphonie d'un agent (1 ligne par user/tenant)."""

    __tablename__ = "agent_states"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    extension: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="offline")
    current_call_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("calls.id", ondelete="SET NULL"), nullable=True
    )
    last_changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
