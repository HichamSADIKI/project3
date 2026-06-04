"""Modèles SQLAlchemy — Omnichannel Inbox (migration 0031)."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class InboxConversation(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Fil de conversation issu d'un canal externe (idempotent par thread)."""

    __tablename__ = "inbox_conversations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reference: Mapped[str] = mapped_column(String(20), nullable=False)
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    external_thread_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True
    )
    assigned_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="new")
    subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_display: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    response_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    channel_metadata: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)


class InboxMessage(Base, TimestampMixin, TenantMixin):
    """Message entrant/sortant d'une conversation inbox (dédup external_message_id)."""

    __tablename__ = "inbox_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inbox_conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    direction: Mapped[str] = mapped_column(String(10), nullable=False)
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    external_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sender_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)


class InboxTag(Base, TimestampMixin, TenantMixin):
    """Tag réutilisable par tenant pour classer les conversations."""

    __tablename__ = "inbox_tags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)


class InboxConversationTag(Base, TenantMixin):
    """Lien M2M conversation ↔ tag."""

    __tablename__ = "inbox_conversation_tags"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inbox_conversations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inbox_tags.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class InboxNote(Base, TimestampMixin, TenantMixin):
    """Note interne d'agent sur une conversation (jamais visible du client)."""

    __tablename__ = "inbox_notes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inbox_conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    agent_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)


class InboxChannelConfig(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Routage d'un canal externe entrant (`phone_number_id`) vers un tenant.

    Résout le multi-tenant du webhook WhatsApp (Meta n'envoie pas de JWT). RLS
    (Loi 1) pour le CRUD métier (enrôlement tenant-scopé) ; le webhook, sans
    contexte tenant, résout via la fonction SQL SECURITY DEFINER
    `inbox_resolve_company(channel, phone_number_id)` (migration 0045) qui
    contourne la RLS pour ce seul lookup. `phone_number_id` est unique
    GLOBALEMENT par canal (un numéro → un seul tenant)."""

    __tablename__ = "inbox_channel_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    phone_number_id: Mapped[str] = mapped_column(String(64), nullable=False)
    display_phone_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
