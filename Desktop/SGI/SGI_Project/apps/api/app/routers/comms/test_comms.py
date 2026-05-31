"""Tests module Communication (Phase 3).

Couvre : helpers purs, CRUD conversations, contrôle d'accès participant
(non-participant → 403), ajout de participants, envoi/contrôle de messages,
marquage lu, isolation multi-tenant.

⚠️ Tests d'intégration (parties DB) : requièrent PostgreSQL via `DATABASE_URL`.
Lancer avec : `docker compose exec api uv run pytest app/routers/comms/test_comms.py`.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import hash_password
from app.models.company import Company
from app.models.user import User, UserRole, UserStatus
from app.routers.comms.schemas import (
    ConversationCreate,
    MessageCreate,
    ParticipantAdd,
)
from app.routers.comms.service import (
    add_participant,
    create_conversation,
    get_conversation,
    get_participants,
    is_valid_conversation_type,
    is_valid_message_kind,
    list_conversations,
    list_messages,
    mark_read,
    send_message,
)

# ── Helpers purs ─────────────────────────────────────────────────────────────


def test_valid_conversation_types() -> None:
    for t in ("direct", "group", "ticket", "contract"):
        assert is_valid_conversation_type(t), f"'{t}' should be valid"


def test_invalid_conversation_type() -> None:
    assert not is_valid_conversation_type("chat")
    assert not is_valid_conversation_type("")
    assert not is_valid_conversation_type("DIRECT")


def test_valid_message_kinds() -> None:
    for k in ("text", "voice", "system"):
        assert is_valid_message_kind(k), f"'{k}' should be valid"


def test_invalid_message_kind() -> None:
    assert not is_valid_message_kind("image")
    assert not is_valid_message_kind("")
    assert not is_valid_message_kind("TEXT")


# ── Fixtures DB ──────────────────────────────────────────────────────────────


async def _make_user(db: AsyncSession, company: Company) -> User:
    u = User(
        id=uuid.uuid4(),
        company_id=company.id,
        email=f"u-{uuid.uuid4().hex[:8]}@sgi.test",
        hashed_password=hash_password("Passw0rd!23"),
        full_name="U",
        role=UserRole.AGENT.value,
        status=UserStatus.ACTIVE.value,
        is_active=True,
    )
    db.add(u)
    await db.commit()
    return u


async def _conv(db, company, creator, members):
    # participant_ids exige ≥ 1 élément ; si aucun membre n'est fourni, on ajoute
    # un membre de remplissage (les tests ne portent que sur creator/outsider).
    if not members:
        members = [await _make_user(db, company)]
    return await create_conversation(
        db,
        company.id,
        ConversationCreate(type="group", subject="Test", participant_ids=[m.id for m in members]),
        creator.id,
    )


# ── Création + participants ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_conversation_adds_creator_as_admin(
    db_session: AsyncSession, seed_company: Company
) -> None:
    creator = await _make_user(db_session, seed_company)
    member = await _make_user(db_session, seed_company)
    conv = await _conv(db_session, seed_company, creator, [member])

    parts = await get_participants(db_session, seed_company.id, conv.id)
    roles = {p.user_id: p.role for p in parts}
    assert roles[creator.id] == "admin"
    assert roles[member.id] == "member"


@pytest.mark.asyncio
async def test_add_participant_ok_unknown_404_duplicate_409(
    db_session: AsyncSession, seed_company: Company
) -> None:
    creator = await _make_user(db_session, seed_company)
    conv = await _conv(db_session, seed_company, creator, [])
    newcomer = await _make_user(db_session, seed_company)

    part = await add_participant(
        db_session, seed_company.id, conv.id, ParticipantAdd(user_id=newcomer.id)
    )
    assert part.role == "member"

    # Conversation inconnue → 404
    with pytest.raises(HTTPException) as exc404:
        await add_participant(
            db_session, seed_company.id, uuid.uuid4(), ParticipantAdd(user_id=newcomer.id)
        )
    assert exc404.value.status_code == 404

    # Doublon (déjà participant) → 409
    with pytest.raises(HTTPException) as exc409:
        await add_participant(
            db_session, seed_company.id, conv.id, ParticipantAdd(user_id=newcomer.id)
        )
    assert exc409.value.status_code == 409


# ── Contrôle d'accès (get / list) ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_conversation_participant_vs_outsider(
    db_session: AsyncSession, seed_company: Company
) -> None:
    creator = await _make_user(db_session, seed_company)
    conv = await _conv(db_session, seed_company, creator, [])

    # Participant → ok
    got = await get_conversation(db_session, seed_company.id, conv.id, creator.id)
    assert got is not None and got.id == conv.id

    # Non-participant → 403
    outsider = await _make_user(db_session, seed_company)
    with pytest.raises(HTTPException) as exc:
        await get_conversation(db_session, seed_company.id, conv.id, outsider.id)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_get_conversation_unknown_returns_none(
    db_session: AsyncSession, seed_company: Company
) -> None:
    user = await _make_user(db_session, seed_company)
    assert await get_conversation(db_session, seed_company.id, uuid.uuid4(), user.id) is None


@pytest.mark.asyncio
async def test_list_conversations_only_mine(
    db_session: AsyncSession, seed_company: Company
) -> None:
    creator = await _make_user(db_session, seed_company)
    member = await _make_user(db_session, seed_company)
    await _conv(db_session, seed_company, creator, [member])

    mine, total = await list_conversations(db_session, seed_company.id, creator.id)
    assert total == 1

    # Un utilisateur tiers ne voit aucune conversation.
    outsider = await _make_user(db_session, seed_company)
    _, n_out = await list_conversations(db_session, seed_company.id, outsider.id)
    assert n_out == 0


# ── Messages ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_send_message_updates_last_message_at(
    db_session: AsyncSession, seed_company: Company
) -> None:
    creator = await _make_user(db_session, seed_company)
    member = await _make_user(db_session, seed_company)
    conv = await _conv(db_session, seed_company, creator, [member])

    msg = await send_message(
        db_session,
        seed_company.id,
        conv.id,
        creator.id,
        MessageCreate(body="Bonjour", mentioned_user_ids=[member.id]),
    )
    assert msg.body == "Bonjour"

    refreshed = await get_conversation(db_session, seed_company.id, conv.id, creator.id)
    assert refreshed is not None and refreshed.last_message_at is not None

    msgs, total = await list_messages(db_session, seed_company.id, conv.id, creator.id)
    assert total >= 1 and msgs[0].id == msg.id


@pytest.mark.asyncio
async def test_send_message_text_requires_body(
    db_session: AsyncSession, seed_company: Company
) -> None:
    creator = await _make_user(db_session, seed_company)
    conv = await _conv(db_session, seed_company, creator, [])
    with pytest.raises(HTTPException) as exc:
        await send_message(
            db_session,
            seed_company.id,
            conv.id,
            creator.id,
            MessageCreate(body=None, kind="text"),
        )
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_send_message_non_participant_403(
    db_session: AsyncSession, seed_company: Company
) -> None:
    creator = await _make_user(db_session, seed_company)
    conv = await _conv(db_session, seed_company, creator, [])
    outsider = await _make_user(db_session, seed_company)
    with pytest.raises(HTTPException) as exc:
        await send_message(
            db_session,
            seed_company.id,
            conv.id,
            outsider.id,
            MessageCreate(body="intrusion"),
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_list_messages_non_participant_403(
    db_session: AsyncSession, seed_company: Company
) -> None:
    creator = await _make_user(db_session, seed_company)
    conv = await _conv(db_session, seed_company, creator, [])
    outsider = await _make_user(db_session, seed_company)
    with pytest.raises(HTTPException) as exc:
        await list_messages(db_session, seed_company.id, conv.id, outsider.id)
    assert exc.value.status_code == 403


# ── Marquage lu ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_mark_read_participant_vs_outsider(
    db_session: AsyncSession, seed_company: Company
) -> None:
    creator = await _make_user(db_session, seed_company)
    conv = await _conv(db_session, seed_company, creator, [])
    assert await mark_read(db_session, seed_company.id, conv.id, creator.id) is True

    outsider = await _make_user(db_session, seed_company)
    assert await mark_read(db_session, seed_company.id, conv.id, outsider.id) is False
