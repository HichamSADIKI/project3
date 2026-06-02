"""Tâches Celery — AI Copilot (assistance agent asynchrone, queue `exports`).

`assist_async` recalcule l'assistance (brouillon, résumé, sentiment, intention,
NBA) hors du cycle requête et **pousse** le résultat sur le canal WS de l'agent
(`copilot.suggestion`) — confort temps réel, jamais bloquant.

Contexte synchrone Celery (rôle privilégié `sync_session_maker`) : on filtre
TOUJOURS par `company_id` explicite (Loi 1) et on ré-applique la garde de
visibilité agent (anti-BOLA). Les coroutines Gemini/WS tournent dans un thread
dédié via `asyncio.run` pour ne pas entrer en conflit avec une boucle existante.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Protocol, cast

from celery import shared_task as _shared_task  # type: ignore[import-untyped]
from sqlalchemy import Result, Select, select

from app.core.database import sync_session_maker
from app.core.gemini import Locale, generate_text
from app.routers.copilot import service
from app.routers.inbox.models import InboxConversation, InboxMessage
from app.routers.inbox.ws import publish_inbox_event
from app.routers.ticketing.models import ServiceTicket, ServiceTicketEvent

logger = logging.getLogger(__name__)

_F = Callable[..., Any]
shared_task: Callable[..., Callable[[_F], _F]] = cast(
    "Callable[..., Callable[[_F], _F]]", _shared_task
)

_MAX_MESSAGES = 20
_MAX_CONTEXT_CHARS = 4000


class _SyncSession(Protocol):
    def execute(self, stmt: Select[Any], *args: Any, **kwargs: Any) -> Result[Any]: ...
    def commit(self) -> None: ...
    def rollback(self) -> None: ...


def _run_async(coro: Any) -> Any:
    with ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(lambda: asyncio.run(coro)).result()


def _gather_inbox(
    db: _SyncSession,
    company_id: uuid.UUID,
    conversation_id: uuid.UUID,
    agent_id: uuid.UUID,
    role: str | None,
) -> dict[str, Any] | None:
    conv = db.execute(
        select(InboxConversation).where(
            InboxConversation.id == conversation_id,
            InboxConversation.company_id == company_id,
            InboxConversation.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if conv is None or service._agent_blocked(role, conv.assigned_agent_id, agent_id):
        return None
    rows = db.execute(
        select(InboxMessage.direction, InboxMessage.body)
        .where(
            InboxMessage.company_id == company_id,
            InboxMessage.conversation_id == conversation_id,
        )
        .order_by(InboxMessage.created_at.desc())
        .limit(_MAX_MESSAGES)
    ).all()
    messages = list(reversed(rows))
    lines: list[str] = []
    last_client = ""
    for direction, body in messages:
        text = (body or "").strip()
        if text:
            lines.append(f"{'Client' if direction == 'inbound' else 'Agent'}: {text}")
            if direction == "inbound":
                last_client = text
    return {
        "channel": conv.channel,
        "thread_text": "\n".join(lines)[:_MAX_CONTEXT_CHARS],
        "last_client_text": last_client,
        "message_count": len(messages),
    }


def _gather_ticket(
    db: _SyncSession,
    company_id: uuid.UUID,
    ticket_id: uuid.UUID,
    agent_id: uuid.UUID,
    role: str | None,
) -> dict[str, Any] | None:
    ticket = db.execute(
        select(ServiceTicket).where(
            ServiceTicket.id == ticket_id,
            ServiceTicket.company_id == company_id,
            ServiceTicket.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if ticket is None or service._agent_blocked(role, ticket.assigned_agent_id, agent_id):
        return None
    rows = db.execute(
        select(ServiceTicketEvent.body)
        .where(
            ServiceTicketEvent.company_id == company_id,
            ServiceTicketEvent.ticket_id == ticket_id,
            ServiceTicketEvent.event_type == "commented",
        )
        .order_by(ServiceTicketEvent.created_at.asc())
        .limit(_MAX_MESSAGES)
    ).all()
    lines = [f"Sujet: {ticket.subject}"]
    if ticket.description:
        lines.append(f"Description: {ticket.description}")
    for (body,) in rows:
        if body:
            lines.append(f"Commentaire: {body.strip()}")
    return {
        "channel": "ticket",
        "thread_text": "\n".join(lines)[:_MAX_CONTEXT_CHARS],
        "last_client_text": (ticket.description or ticket.subject or "").strip(),
        "message_count": len(rows) + 1,
    }


@shared_task(name="app.tasks.copilot.assist_async", bind=True, max_retries=2)
def assist_async(
    self: Any,
    company_id: str,
    context_type: str,
    context_id: str,
    agent_id: str,
    role: str | None = None,
    locale: str = "fr",
) -> dict[str, Any]:
    """Calcule l'assistance et la pousse sur le canal WS de l'agent."""
    cid = uuid.UUID(company_id)
    ctx_id = uuid.UUID(context_id)
    aid = uuid.UUID(agent_id)
    loc = cast("Locale", locale if locale in ("ar", "en", "fr") else "fr")

    with sync_session_maker() as _raw_db:
        db = cast("_SyncSession", _raw_db)
        ctx = (
            _gather_inbox(db, cid, ctx_id, aid, role)
            if context_type == "inbox"
            else _gather_ticket(db, cid, ctx_id, aid, role)
        )
    if ctx is None:
        return {"status": "not_found", "context_id": context_id}

    last_client = ctx["last_client_text"]
    sentiment = service.detect_sentiment(last_client)
    intent = service.detect_intent(last_client)
    actions = service.next_best_actions(intent, sentiment)

    reply_prompt = (
        f"Conversation ({ctx['channel']}):\n{ctx['thread_text']}\n\nDraft the next agent reply."
    )
    reply_gen = _run_async(
        generate_text(
            reply_prompt,
            system_instruction=service._REPLY_SYSTEM,
            locale=loc,
            temperature=0.4,
        )
    )
    if reply_gen["text"]:
        suggested_reply, engine = reply_gen["text"], reply_gen["engine"]
    else:
        suggested_reply, engine = service.heuristic_reply(intent, sentiment, loc), "fallback"

    summary_gen = _run_async(
        generate_text(
            f"Conversation ({ctx['channel']}):\n{ctx['thread_text']}",
            system_instruction=service._SUMMARY_SYSTEM,
            locale=loc,
            temperature=0.2,
        )
    )
    summary = summary_gen["text"] or service.heuristic_summary(
        ctx["thread_text"], ctx["message_count"]
    )

    data = {
        "context_type": context_type,
        "context_id": context_id,
        "channel": ctx["channel"],
        "summary": summary,
        "suggested_reply": suggested_reply,
        "sentiment": sentiment,
        "intent": intent,
        "next_best_actions": actions,
        "engine": engine,
    }
    try:
        _run_async(
            publish_inbox_event(
                cid, {"type": "copilot.suggestion", "data": data}, target_agent_id=aid
            )
        )
    except Exception as exc:  # noqa: BLE001 — best-effort, le WS est un confort
        logger.warning("copilot.assist_async publish échoué: %s", exc)

    return {"status": "ok", "context_id": context_id, "engine": engine}
