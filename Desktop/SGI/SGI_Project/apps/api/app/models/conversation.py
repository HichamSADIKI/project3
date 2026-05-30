"""
Modèles Communication SGI (Phase 3) — conversations, participants, messages,
mentions.

Architecture :
- Conversation  : thread partagé (direct, groupe, lié à un ticket/contrat).
- Participant   : un User membre d'une Conversation avec son curseur de lecture.
- ConvMessage   : message texte, vocal ou système dans une Conversation.
- MsgMention    : mention @user dans un ConvMessage (déclenche notification).

La table `messages` (portail client existante) est CONSERVÉE sans modification.
Ces tables sont indépendantes et coexistent — migration 0015 ne touche pas
`messages`.

Loi 1 : company_id NOT NULL + RLS sur les 4 tables (migration 0015).
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class Conversation(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Thread de communication entre participants."""

    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # direct | group | ticket | contract
    type: Mapped[str] = mapped_column(String(20), nullable=False, default="direct")
    subject: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Liens contextuels optionnels (un seul renseigné à la fois).
    maintenance_ticket_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("maintenance_tickets.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    contract_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    __table_args__ = (
        CheckConstraint(
            "type IN ('direct','group','ticket','contract')",
            name="ck_conversations_type",
        ),
        Index("idx_convs_company_type", "company_id", "type"),
        Index("idx_convs_last_msg", "company_id", "last_message_at"),
    )


class ConversationParticipant(Base, TenantMixin):
    """Membre d'une conversation avec curseur de lecture."""

    __tablename__ = "conversation_participants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # admin | member
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="member")
    last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    muted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    __table_args__ = (
        # Un user ne peut être participant qu'une fois par conversation.
        UniqueConstraint("conversation_id", "user_id", name="uq_conv_participant"),
        CheckConstraint(
            "role IN ('admin','member')",
            name="ck_conv_participant_role",
        ),
        Index("idx_conv_participants_user", "user_id"),
    )


class ConversationMessage(Base, TenantMixin, SoftDeleteMixin):
    """Message dans une conversation."""

    __tablename__ = "conversation_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    # text | voice | system
    kind: Mapped[str] = mapped_column(String(10), nullable=False, default="text")
    body: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Voice note : clé MinIO (Phase 4)
    attachment_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Transcription Whisper (Phase 4)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcript_lang: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Réponse à un message
    reply_to_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversation_messages.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "kind IN ('text','voice','system')",
            name="ck_conv_msg_kind",
        ),
        CheckConstraint(
            "body IS NOT NULL OR attachment_key IS NOT NULL",
            name="ck_conv_msg_content",
        ),
        Index("idx_conv_msgs_conv_created", "conversation_id", "created_at"),
    )


class MessageMention(Base, TenantMixin):
    """Mention @user dans un message — déclenche une notification (Phase 4)."""

    __tablename__ = "message_mentions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversation_messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    mentioned_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    __table_args__ = (
        UniqueConstraint("message_id", "mentioned_user_id", name="uq_mention"),
        Index("idx_mentions_user", "mentioned_user_id"),
    )
