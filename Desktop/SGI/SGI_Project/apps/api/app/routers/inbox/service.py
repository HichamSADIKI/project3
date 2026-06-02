"""Service Omnichannel Inbox.

- **Helpers purs** (sans DB) : canaux, machine à états conversation, référence,
  SLA de réponse. Testables partout.
- **Fonctions DB** : toujours filtrées par company_id (Loi 1). get-or-create et
  add_message sont idempotents (dédoublonnage des webhooks).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.routers.inbox.models import InboxConversation, InboxMessage

# ─────────────────────────────────────────────────────────────────────────
# Helpers purs
# ─────────────────────────────────────────────────────────────────────────

CHANNELS: frozenset[str] = frozenset({"whatsapp", "facebook", "instagram", "email", "webchat"})

INBOX_STATUSES: frozenset[str] = frozenset({"new", "assigned", "pending", "resolved", "closed"})

_STATUS_TRANSITIONS: dict[str, frozenset[str]] = {
    "new": frozenset({"assigned", "closed"}),
    "assigned": frozenset({"pending", "resolved", "closed"}),
    "pending": frozenset({"assigned", "resolved", "closed"}),
    # Réouverture possible depuis un état terminal.
    "resolved": frozenset({"assigned", "closed"}),
    "closed": frozenset({"assigned"}),
}


def is_valid_inbox_status_transition(current: str, target: str) -> bool:
    """True si `current → target` est une transition de conversation autorisée."""
    if current not in INBOX_STATUSES or target not in INBOX_STATUSES:
        return False
    if current == target:
        return False
    return target in _STATUS_TRANSITIONS.get(current, frozenset())


def generate_inbox_reference(year: int, sequence: int) -> str:
    """Référence lexicographiquement triable : `INBOX-2026-000042`."""
    return f"INBOX-{year:04d}-{sequence:06d}"


def compute_response_due(received_at: datetime, sla_minutes: int) -> datetime | None:
    """Échéance de réponse (SLA). None si SLA désactivé (<=0)."""
    if sla_minutes <= 0:
        return None
    return received_at + timedelta(minutes=sla_minutes)


def is_valid_channel(channel: str) -> bool:
    return channel in CHANNELS


# ─────────────────────────────────────────────────────────────────────────
# Fonctions DB — filtrées par company_id (Loi 1)
# ─────────────────────────────────────────────────────────────────────────


async def next_inbox_reference(db: AsyncSession, company_id: uuid.UUID) -> str:
    year = datetime.now(UTC).year
    result = await db.execute(
        select(func.count())
        .select_from(InboxConversation)
        .where(
            InboxConversation.company_id == company_id,
            InboxConversation.reference.like(f"INBOX-{year:04d}-%"),
        )
    )
    return generate_inbox_reference(year, result.scalar_one() + 1)


async def get_conversation_by_thread(
    db: AsyncSession, company_id: uuid.UUID, channel: str, external_thread_id: str
) -> InboxConversation | None:
    result = await db.execute(
        select(InboxConversation).where(
            InboxConversation.company_id == company_id,
            InboxConversation.channel == channel,
            InboxConversation.external_thread_id == external_thread_id,
        )
    )
    return result.scalar_one_or_none()


async def get_or_create_conversation(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    channel: str,
    external_thread_id: str,
    contact_display: str | None = None,
    subject: str | None = None,
) -> tuple[InboxConversation, bool]:
    """Récupère/crée le fil (company, channel, external_thread_id). Idempotent.

    Sûr sous concurrence (webhooks en rafale) : la contrainte unique
    `uq_inbox_conv_thread` arbitre les races, on re-fetch la ligne gagnante.
    """
    existing = await get_conversation_by_thread(db, company_id, channel, external_thread_id)
    if existing is not None:
        return existing, False

    conv = InboxConversation(
        company_id=company_id,
        reference=await next_inbox_reference(db, company_id),
        channel=channel,
        external_thread_id=external_thread_id,
        status="new",
        contact_display=contact_display,
        subject=subject,
    )
    db.add(conv)
    try:
        await db.commit()
        await db.refresh(conv)
        return conv, True
    except IntegrityError:
        await db.rollback()
        winner = await get_conversation_by_thread(db, company_id, channel, external_thread_id)
        if winner is None:  # pragma: no cover
            raise
        return winner, False


async def add_message(
    db: AsyncSession,
    company_id: uuid.UUID,
    conversation: InboxConversation,
    *,
    direction: str,
    body: str | None,
    external_message_id: str | None = None,
    sender_user_id: uuid.UUID | None = None,
    raw_payload: dict[str, Any] | None = None,
) -> tuple[InboxMessage, bool]:
    """Ajoute un message (idempotent si external_message_id déjà vu) et met à
    jour last_message_at de la conversation. Retourne (message, created)."""
    if external_message_id:
        dup = await db.execute(
            select(InboxMessage).where(
                InboxMessage.company_id == company_id,
                InboxMessage.external_message_id == external_message_id,
            )
        )
        existing = dup.scalar_one_or_none()
        if existing is not None:
            return existing, False

    now = datetime.now(UTC)
    msg = InboxMessage(
        company_id=company_id,
        conversation_id=conversation.id,
        direction=direction,
        channel=conversation.channel,
        external_message_id=external_message_id,
        sender_user_id=sender_user_id,
        body=body,
        raw_payload=raw_payload or {},
    )
    db.add(msg)
    conversation.last_message_at = now
    try:
        await db.commit()
    except IntegrityError:
        # Course perdue sur external_message_id → message déjà inséré ailleurs.
        await db.rollback()
        if external_message_id:
            dup = await db.execute(
                select(InboxMessage).where(
                    InboxMessage.company_id == company_id,
                    InboxMessage.external_message_id == external_message_id,
                )
            )
            existing = dup.scalar_one_or_none()
            if existing is not None:
                return existing, False
        raise
    await db.refresh(msg)
    return msg, True


async def get_conversation(
    db: AsyncSession, company_id: uuid.UUID, conv_id: uuid.UUID
) -> InboxConversation | None:
    result = await db.execute(
        select(InboxConversation).where(
            InboxConversation.id == conv_id,
            InboxConversation.company_id == company_id,
            InboxConversation.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def list_conversations(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    channel: str | None = None,
    status: str | None = None,
    assigned_agent_id: uuid.UUID | None = None,
) -> tuple[list[InboxConversation], int]:
    base = select(InboxConversation).where(
        InboxConversation.company_id == company_id,
        InboxConversation.deleted_at.is_(None),
    )
    if channel:
        base = base.where(InboxConversation.channel == channel)
    if status:
        base = base.where(InboxConversation.status == status)
    if assigned_agent_id:
        base = base.where(InboxConversation.assigned_agent_id == assigned_agent_id)

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    offset = (page - 1) * limit
    rows = (
        (
            await db.execute(
                base.order_by(InboxConversation.last_message_at.desc().nullslast())
                .offset(offset)
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return list(rows), total


async def set_status(
    db: AsyncSession, company_id: uuid.UUID, conv_id: uuid.UUID, new_status: str
) -> InboxConversation | None:
    """Transition de statut validée. None si introuvable, ValueError si invalide."""
    conv = await get_conversation(db, company_id, conv_id)
    if conv is None:
        return None
    if not is_valid_inbox_status_transition(conv.status, new_status):
        raise ValueError(f"invalid_transition:{conv.status}->{new_status}")
    conv.status = new_status
    conv.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(conv)
    return conv


async def assign_conversation(
    db: AsyncSession, company_id: uuid.UUID, conv_id: uuid.UUID, agent_user_id: uuid.UUID
) -> InboxConversation | None:
    """Attribue la conversation à un agent (new → assigned automatiquement)."""
    conv = await get_conversation(db, company_id, conv_id)
    if conv is None:
        return None
    conv.assigned_agent_id = agent_user_id
    if conv.status == "new":
        conv.status = "assigned"
    conv.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(conv)
    return conv
