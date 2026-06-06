"""Tâches Celery — module Omnichannel Inbox (IA asynchrone).

Queue : exports (traitements IA non temps-réel, jamais bloquants pour l'agent).

- summarize_conversation(company_id, conversation_id) : résume les N derniers
  messages d'un fil (Gemini si clé présente, sinon repli heuristique local) et
  stocke le résumé dans ``inbox_conversations.channel_metadata['ai_summary']``.
- suggest_tags(company_id, conversation_id) : propose des tags par heuristique
  (mots-clés) + Gemini optionnel, stockés dans
  ``channel_metadata['ai_suggested_tags']`` (ne crée AUCUN lien — l'agent valide).

Consommateurs de fond légitimes → rôle privilégié (``sync_session_maker``),
scan cross-tenant comme les autres tâches cron SGI. Chaque tâche reçoit
néanmoins un ``company_id`` explicite et filtre dessus (Loi 1) : le worker n'agit
que sur le tenant ciblé, jamais sur l'ensemble des sociétés.

Le proxy synchrone de ``sync_session_maker`` exécute chaque appel via
``run_until_complete`` ; on ré-exécute donc proprement les coroutines Gemini
(elles-mêmes async) via ``asyncio.run`` dans un thread dédié pour ne pas entrer
en conflit avec une éventuelle boucle d'événements du proxy.
"""

from __future__ import annotations

import asyncio
import logging
import re
import uuid
from collections.abc import Callable, Sequence
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from typing import Any, Protocol, cast

from celery import shared_task as _shared_task  # type: ignore[import-untyped]
from sqlalchemy import Result, Select, select
from sqlalchemy.orm.attributes import flag_modified

from app.core.database import sync_session_maker
from app.routers.inbox.models import InboxConversation, InboxMessage

logger = logging.getLogger(__name__)

# `celery` n'expose pas de stubs (py.typed absent) → `shared_task` est `Any`,
# ce qui rendrait toute fonction décorée « untyped ». On re-type le décorateur
# en identité préservant la signature pour garder les tâches typées (idem
# app.tasks.telephony).
_F = Callable[..., Any]
shared_task: Callable[..., Callable[[_F], _F]] = cast(
    "Callable[..., Callable[[_F], _F]]", _shared_task
)

# Nombre de messages les plus récents pris en compte pour le résumé / les tags.
_MAX_CONTEXT_MESSAGES = 20
# Longueur max du contexte texte envoyé à Gemini (garde-fou coût/latence).
_MAX_CONTEXT_CHARS = 4000


class _SyncSession(Protocol):
    """Interface synchrone réellement exposée par ``sync_session_maker``.

    Le context manager (cf. ``app.core.database``) yield un proxy dont ``execute``
    renvoie un ``Result`` synchrone et ``commit``/``rollback`` sont bloquants.
    """

    def execute(self, stmt: Select[Any], *args: Any, **kwargs: Any) -> Result[Any]: ...

    def commit(self) -> None: ...

    def rollback(self) -> None: ...


# ── Heuristique de suggestion de tags (sans IA) ────────────────────────────

# Mots-clés → tag suggéré. Couvre l'immobilier UAE + intentions transverses.
# Les libellés de tag restent en français (UI backoffice), insensibles à la casse
# sur la recherche.
_TAG_KEYWORDS: dict[str, tuple[str, ...]] = {
    "achat": ("acheter", "achat", "buy", "purchase", "شراء"),
    "location": ("louer", "location", "rent", "rental", "bail", "lease", "إيجار"),
    "visite": ("visite", "visiter", "viewing", "visit", "rendez-vous", "rdv"),
    "prix": ("prix", "price", "budget", "coût", "cost", "aed", "dirham", "سعر"),
    "golden_visa": ("golden visa", "résidence", "residency", "visa", "إقامة"),
    "urgent": ("urgent", "asap", "au plus vite", "immédiat", "rapidement", "عاجل"),
    "plainte": ("plainte", "complaint", "problème", "problem", "insatisfait", "شكوى"),
    "maintenance": ("réparation", "repair", "panne", "maintenance", "fuite", "صيانة"),
    "paiement": ("paiement", "payment", "facture", "invoice", "chèque", "cheque", "دفع"),
}

_WORD_RE = re.compile(r"\w+", re.UNICODE)


def heuristic_tags(text: str, *, max_n: int = 5) -> list[str]:
    """Tags suggérés par simple correspondance de mots-clés (helper pur).

    Trié par nombre de correspondances décroissant. Liste vide si rien ne matche
    — on ne force jamais un tag par défaut (l'agent reste maître)."""
    t = (text or "").lower()
    if not t:
        return []
    scores: dict[str, int] = {}
    for tag, keywords in _TAG_KEYWORDS.items():
        hits = sum(1 for kw in keywords if kw in t)
        if hits:
            scores[tag] = hits
    ordered = sorted(scores, key=lambda k: scores[k], reverse=True)
    return ordered[:max_n]


def heuristic_summary(messages: Sequence[tuple[str, str | None]], *, max_chars: int = 280) -> str:
    """Résumé factuel local (helper pur) : compte les échanges + dernier message.

    ``messages`` = séquence ``(direction, body)`` du plus ancien au plus récent.
    Utilisé en repli si Gemini est indisponible. Ne lève jamais."""
    if not messages:
        return "Conversation sans message."
    inbound = sum(1 for d, _ in messages if d == "inbound")
    outbound = len(messages) - inbound
    last_body = next((b for _, b in reversed(messages) if b), None)
    parts = [f"{len(messages)} message(s) ({inbound} entrant(s), {outbound} sortant(s))."]
    if last_body:
        snippet = last_body.strip().replace("\n", " ")
        parts.append(f"Dernier message : « {snippet[:max_chars]} »")
    return " ".join(parts)


# ── Helpers internes ───────────────────────────────────────────────────────


def _run_async(coro: Any) -> Any:
    """Exécute une coroutine depuis le contexte synchrone Celery.

    ``sync_session_maker`` peut détenir une boucle d'événements active ; pour
    éviter tout conflit on lance la coroutine Gemini dans un thread dédié avec
    sa propre boucle (``asyncio.run``)."""
    with ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(lambda: asyncio.run(coro)).result()


def _fetch_recent_messages(
    db: _SyncSession, company_id: uuid.UUID, conversation_id: uuid.UUID
) -> list[tuple[str, str | None]]:
    """Les ``_MAX_CONTEXT_MESSAGES`` derniers messages (direction, body), ordre
    chronologique croissant. Filtré par company_id (Loi 1)."""
    rows = db.execute(
        select(InboxMessage.direction, InboxMessage.body)
        .where(
            InboxMessage.company_id == company_id,
            InboxMessage.conversation_id == conversation_id,
        )
        .order_by(InboxMessage.created_at.desc())
        .limit(_MAX_CONTEXT_MESSAGES)
    ).all()
    # Re-trie en ordre chronologique pour le contexte IA.
    return [(direction, body) for direction, body in reversed(rows)]


def _build_context(messages: Sequence[tuple[str, str | None]]) -> str:
    """Aplati les messages en un bloc texte borné pour le prompt Gemini."""
    lines: list[str] = []
    for direction, body in messages:
        if not body:
            continue
        speaker = "Client" if direction == "inbound" else "Agent"
        lines.append(f"{speaker}: {body.strip()}")
    return "\n".join(lines)[:_MAX_CONTEXT_CHARS]


def _load_conversation(
    db: _SyncSession, company_id: uuid.UUID, conversation_id: uuid.UUID
) -> InboxConversation | None:
    """Conversation du tenant (non supprimée). Filtré company_id (Loi 1)."""
    return (
        db.execute(
            select(InboxConversation).where(
                InboxConversation.id == conversation_id,
                InboxConversation.company_id == company_id,
                InboxConversation.deleted_at.is_(None),
            )
        )
        .scalars()
        .first()
    )


def _set_metadata(conv: InboxConversation, key: str, value: Any) -> None:
    """Écrit ``conv.channel_metadata[key] = value`` en signalant la mutation
    JSONB à SQLAlchemy (sinon le changement in-place n'est pas persisté)."""
    meta = dict(conv.channel_metadata or {})
    meta[key] = value
    conv.channel_metadata = meta
    flag_modified(conv, "channel_metadata")


# ── Tâches Celery ───────────────────────────────────────────────────────────


@shared_task(name="app.tasks.inbox.summarize_conversation", bind=True)
def summarize_conversation(self: Any, company_id: str, conversation_id: str) -> dict[str, Any]:
    """Résume une conversation et stocke le résumé dans ``channel_metadata``.

    Gemini si ``GEMINI_API_KEY`` présente, sinon repli heuristique local. Jamais
    bloquant : toute erreur IA dégrade vers le résumé factuel."""
    cid = uuid.UUID(company_id)
    conv_id = uuid.UUID(conversation_id)
    try:
        with sync_session_maker() as _raw_db:
            db = cast("_SyncSession", _raw_db)
            conv = _load_conversation(db, cid, conv_id)
            if conv is None:
                return {"status": "not_found", "conversation_id": conversation_id}

            messages = _fetch_recent_messages(db, cid, conv_id)
            summary = heuristic_summary(messages)
            engine = "local_heuristic"

            context = _build_context(messages)
            if context:
                try:
                    from app.core.gemini import parse_client_need

                    result = _run_async(
                        parse_client_need(
                            "Résume cette conversation client (canal "
                            f"{conv.channel}) en 2-3 phrases neutres, en français :\n"
                            f"{context}",
                            locale="fr",
                        )
                    )
                    if str(result.get("engine", "")).startswith("gemini") and result.get("summary"):
                        summary = str(result["summary"])
                        engine = str(result["engine"])
                except Exception as exc:  # noqa: BLE001 — fail-safe : on garde l'heuristique
                    logger.warning("Gemini résumé inbox indisponible (%s): %s", conv_id, exc)

            _set_metadata(
                conv,
                "ai_summary",
                {
                    "text": summary,
                    "engine": engine,
                    "message_count": len(messages),
                    "generated_at": datetime.now(UTC).isoformat(),
                },
            )
            db.commit()
            logger.info(
                "Résumé inbox généré (conv=%s, engine=%s, msgs=%d)",
                conv_id,
                engine,
                len(messages),
            )
            return {
                "status": "ok",
                "conversation_id": conversation_id,
                "engine": engine,
                "message_count": len(messages),
            }
    except Exception as exc:
        logger.error("summarize_conversation failed (conv=%s): %s", conv_id, exc)
        raise self.retry(exc=exc, countdown=120, max_retries=3) from exc


@shared_task(name="app.tasks.inbox.suggest_tags", bind=True)
def suggest_tags(self: Any, company_id: str, conversation_id: str) -> dict[str, Any]:
    """Propose des tags pour une conversation (heuristique + Gemini optionnel).

    Stocke les suggestions dans ``channel_metadata['ai_suggested_tags']`` SANS
    créer de lien : l'agent valide depuis le poste. Jamais bloquant."""
    cid = uuid.UUID(company_id)
    conv_id = uuid.UUID(conversation_id)
    try:
        with sync_session_maker() as _raw_db:
            db = cast("_SyncSession", _raw_db)
            conv = _load_conversation(db, cid, conv_id)
            if conv is None:
                return {"status": "not_found", "conversation_id": conversation_id}

            messages = _fetch_recent_messages(db, cid, conv_id)
            context = _build_context(messages)

            tags = heuristic_tags(context)
            engine = "local_heuristic"

            if context:
                try:
                    from app.core.gemini import detect_categories

                    # Réutilise la détection multi-secteurs comme tags transverses
                    # (realestate, tourisme, sante…) — pur, sans appel réseau.
                    cats = detect_categories(context, max_n=3)
                    for cat in cats:
                        if cat not in tags:
                            tags.append(cat)
                except Exception as exc:  # noqa: BLE001 — fail-safe
                    logger.warning(
                        "suggest_tags enrichissement indisponible (%s): %s", conv_id, exc
                    )

            _set_metadata(
                conv,
                "ai_suggested_tags",
                {
                    "tags": tags,
                    "engine": engine,
                    "generated_at": datetime.now(UTC).isoformat(),
                },
            )
            db.commit()
            logger.info("Tags suggérés inbox (conv=%s): %s", conv_id, tags)
            return {
                "status": "ok",
                "conversation_id": conversation_id,
                "tags": tags,
            }
    except Exception as exc:
        logger.error("suggest_tags failed (conv=%s): %s", conv_id, exc)
        raise self.retry(exc=exc, countdown=120, max_retries=3) from exc
