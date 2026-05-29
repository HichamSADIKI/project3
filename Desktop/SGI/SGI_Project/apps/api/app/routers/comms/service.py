"""Service Communication — CRUD conversations, messages, participants.

Toutes les fonctions filtrent par company_id (Loi 1).
Un utilisateur ne peut lire/écrire que dans les conversations dont il est participant.
"""
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import (
    Conversation,
    ConversationMessage,
    ConversationParticipant,
    MessageMention,
)

from .schemas import ConversationCreate, MessageCreate, ParticipantAdd


# ── Helpers purs ──────────────────────────────────────────────────────────

def is_valid_conversation_type(t: str) -> bool:
    return t in ("direct", "group", "ticket", "contract")


def is_valid_message_kind(k: str) -> bool:
    return k in ("text", "voice", "system")


# ── Conversations ─────────────────────────────────────────────────────────

async def create_conversation(
    db: AsyncSession,
    company_id: uuid.UUID,
    data: ConversationCreate,
    creator_id: uuid.UUID,
) -> Conversation:
    if not data.body if hasattr(data, "body") else False:
        pass  # body optionnel

    conv = Conversation(
        company_id=company_id,
        type=data.type,
        subject=data.subject,
        maintenance_ticket_id=data.maintenance_ticket_id,
        contract_id=data.contract_id,
        created_by=creator_id,
    )
    db.add(conv)
    await db.flush()

    # Ajouter le créateur comme admin.
    creator_part = ConversationParticipant(
        company_id=company_id,
        conversation_id=conv.id,
        user_id=creator_id,
        role="admin",
    )
    db.add(creator_part)

    # Ajouter les autres participants (membres).
    for uid in data.participant_ids:
        if uid == creator_id:
            continue
        part = ConversationParticipant(
            company_id=company_id,
            conversation_id=conv.id,
            user_id=uid,
            role="member",
        )
        db.add(part)

    await db.commit()
    await db.refresh(conv)
    return conv


async def _check_participant(
    db: AsyncSession, company_id: uuid.UUID, conv_id: uuid.UUID, user_id: uuid.UUID
) -> bool:
    """Vérifie que user_id est participant de la conversation (isolation)."""
    result = await db.execute(
        select(ConversationParticipant).where(
            ConversationParticipant.conversation_id == conv_id,
            ConversationParticipant.user_id == user_id,
            ConversationParticipant.company_id == company_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def get_conversation(
    db: AsyncSession,
    company_id: uuid.UUID,
    conv_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Conversation | None:
    """Retourne la conversation si user_id en est participant."""
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conv_id,
            Conversation.company_id == company_id,
            Conversation.deleted_at.is_(None),
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        return None
    if not await _check_participant(db, company_id, conv_id, user_id):
        raise HTTPException(status_code=403, detail="not_a_participant")
    return conv


async def list_conversations(
    db: AsyncSession,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    type_filter: str | None = None,
    page: int = 1,
    limit: int = 20,
) -> tuple[list[Conversation], int]:
    """Retourne uniquement les conversations où user_id est participant."""
    # Sous-requête : IDs des conversations de cet utilisateur.
    my_conv_ids = select(ConversationParticipant.conversation_id).where(
        ConversationParticipant.user_id == user_id,
        ConversationParticipant.company_id == company_id,
    )

    filters = [
        Conversation.company_id == company_id,
        Conversation.deleted_at.is_(None),
        Conversation.id.in_(my_conv_ids),
    ]
    if type_filter:
        filters.append(Conversation.type == type_filter)

    total = (
        await db.execute(
            select(func.count()).select_from(Conversation).where(and_(*filters))
        )
    ).scalar_one()

    result = await db.execute(
        select(Conversation)
        .where(and_(*filters))
        .order_by(Conversation.last_message_at.desc().nulls_last())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    return list(result.scalars().all()), total


async def get_participants(
    db: AsyncSession, company_id: uuid.UUID, conv_id: uuid.UUID
) -> list[ConversationParticipant]:
    result = await db.execute(
        select(ConversationParticipant).where(
            ConversationParticipant.conversation_id == conv_id,
            ConversationParticipant.company_id == company_id,
        )
    )
    return list(result.scalars().all())


async def add_participant(
    db: AsyncSession,
    company_id: uuid.UUID,
    conv_id: uuid.UUID,
    data: ParticipantAdd,
) -> ConversationParticipant:
    # Vérifie que la conversation existe.
    conv = await db.execute(
        select(Conversation).where(
            Conversation.id == conv_id,
            Conversation.company_id == company_id,
            Conversation.deleted_at.is_(None),
        )
    )
    if not conv.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="conversation_not_found")

    part = ConversationParticipant(
        company_id=company_id,
        conversation_id=conv_id,
        user_id=data.user_id,
        role=data.role,
    )
    db.add(part)
    try:
        await db.commit()
        await db.refresh(part)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=409, detail="already_participant")
    return part


async def mark_read(
    db: AsyncSession,
    company_id: uuid.UUID,
    conv_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    result = await db.execute(
        select(ConversationParticipant).where(
            ConversationParticipant.conversation_id == conv_id,
            ConversationParticipant.user_id == user_id,
            ConversationParticipant.company_id == company_id,
        )
    )
    part = result.scalar_one_or_none()
    if not part:
        return False
    part.last_read_at = datetime.now(timezone.utc)
    await db.commit()
    return True


# ── Messages ──────────────────────────────────────────────────────────────

async def send_message(
    db: AsyncSession,
    company_id: uuid.UUID,
    conv_id: uuid.UUID,
    sender_id: uuid.UUID,
    data: MessageCreate,
) -> ConversationMessage:
    if not await _check_participant(db, company_id, conv_id, sender_id):
        raise HTTPException(status_code=403, detail="not_a_participant")
    if not data.body and data.kind == "text":
        raise HTTPException(status_code=422, detail="body_required_for_text_message")

    now = datetime.now(timezone.utc)
    msg = ConversationMessage(
        company_id=company_id,
        conversation_id=conv_id,
        sender_user_id=sender_id,
        kind=data.kind,
        body=data.body,
        reply_to_id=data.reply_to_id,
        created_at=now,
    )
    db.add(msg)
    await db.flush()

    # Mentions.
    for uid in set(data.mentioned_user_ids):
        db.add(MessageMention(
            company_id=company_id,
            message_id=msg.id,
            mentioned_user_id=uid,
        ))

    # Mise à jour last_message_at sur la conversation.
    conv_result = await db.execute(
        select(Conversation).where(
            Conversation.id == conv_id, Conversation.company_id == company_id
        )
    )
    conv = conv_result.scalar_one_or_none()
    if conv:
        conv.last_message_at = now

    await db.commit()
    await db.refresh(msg)
    return msg


async def list_messages(
    db: AsyncSession,
    company_id: uuid.UUID,
    conv_id: uuid.UUID,
    user_id: uuid.UUID,
    before_id: uuid.UUID | None = None,
    limit: int = 50,
) -> tuple[list[ConversationMessage], int]:
    """Pagination par curseur (before_id) — plus récents en premier."""
    if not await _check_participant(db, company_id, conv_id, user_id):
        raise HTTPException(status_code=403, detail="not_a_participant")

    filters = [
        ConversationMessage.conversation_id == conv_id,
        ConversationMessage.company_id == company_id,
        ConversationMessage.deleted_at.is_(None),
    ]

    if before_id:
        cursor_result = await db.execute(
            select(ConversationMessage.created_at).where(
                ConversationMessage.id == before_id
            )
        )
        cursor_ts = cursor_result.scalar_one_or_none()
        if cursor_ts:
            filters.append(ConversationMessage.created_at < cursor_ts)

    total = (
        await db.execute(
            select(func.count()).select_from(ConversationMessage)
            .where(and_(*filters))
        )
    ).scalar_one()

    result = await db.execute(
        select(ConversationMessage)
        .where(and_(*filters))
        .order_by(ConversationMessage.created_at.desc())
        .limit(limit)
    )
    msgs = list(result.scalars().all())
    msgs.reverse()  # Chronologique pour l'UI.
    return msgs, total
