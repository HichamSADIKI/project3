"""WebSocket Omnichannel Inbox — temps réel + état agent (fan-out multi-réplicas).

Même architecture que `comms/ws.py` et `telephony/ws.py` : chaque réplica API
maintient un registre local de connexions WS par channel ; le bus Valkey pub/sub
assure le fan-out entre réplicas (`make scale n=`). Aucune clé Valkey éphémère
sans TTL (règle SGI).

Modèle de channels (DEUX niveaux, namespacés par tenant — Loi 1) :

  inbox:{company_id}                  — flux TENANT : tous les events de la
                                        société. Réservé aux superviseurs
                                        (admin/manager) qui pilotent toute la
                                        file omnicanale.
  inbox:{company_id}:agent:{user_id}  — flux AGENT : uniquement les events des
                                        conversations qui le concernent
                                        (assignées, @mention). Un agent ne voit
                                        QUE son périmètre — anti-fuite Loi 1.

Justification : un superviseur a besoin de la vue d'ensemble (temps réel sur la
file entière), tandis qu'un agent ne doit pas recevoir les conversations des
autres. `publish_inbox_event` publie donc systématiquement sur le channel tenant
et, si un agent est ciblé (`target_agent_id`), aussi sur son channel dédié. Le
préfixe `{company_id}` borne tout par tenant : deux sociétés ne peuvent jamais se
croiser, même avec le même `user_id` improbable.

État agent : présence in/out gérée par clé Valkey à TTL court (auto-expire si le
WS tombe), exposée via le flux tenant pour le tableau de bord superviseur.

Events poussés au client (JSON) :
  {"type": "conversation.created", "data": {...}}
  {"type": "message.created",      "data": {...}}
  {"type": "conversation.status",  "data": {...}}
  {"type": "conversation.assigned","data": {...}}
  {"type": "agent.presence",       "data": {"user_id": "...", "status": "online"}}
  {"type": "ping"} / {"type": "pong"} — keepalive
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from typing import Any

import redis.asyncio as aioredis
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

# ── Registre local des connexions WS (par channel, par réplica) ────────────

_connections: dict[str, set[WebSocket]] = {}
_subscriber_tasks: dict[str, asyncio.Task[None]] = {}

# TTL présence agent (s) : > intervalle de keepalive (25 s) pour ne pas
# clignoter, < assez court pour expirer vite si le WS tombe sans fermeture.
_PRESENCE_TTL_S = 45


# ── Channels (namespacés par tenant — Loi 1) ──────────────────────────────


def tenant_channel(company_id: str) -> str:
    """Flux temps réel de toute la file omnicanale d'un tenant (superviseurs)."""
    return f"inbox:{company_id}"


def agent_channel(company_id: str, user_id: str) -> str:
    """Flux des conversations d'un agent donné, borné au tenant."""
    return f"inbox:{company_id}:agent:{user_id}"


def presence_key(company_id: str, user_id: str) -> str:
    """Clé Valkey de présence agent (TTL court — jamais sans expiration)."""
    return f"inbox:presence:{company_id}:{user_id}"


def _valkey_url() -> str:
    return os.getenv("VALKEY_URL", "redis://valkey:6379/0")


# ── Publication (appelée depuis le router/service, best-effort) ────────────


async def publish_inbox_event(
    company_id: uuid.UUID | str,
    event: dict[str, Any],
    *,
    target_agent_id: uuid.UUID | str | None = None,
) -> None:
    """Publie un event JSON sur le channel tenant (et le channel agent si ciblé).

    Best-effort : un échec Valkey n'interrompt jamais la requête métier. Les
    events restent persistés en base ; le WS est un confort temps réel.
    """
    cid = str(company_id)
    payload = json.dumps(event)
    try:
        async with aioredis.from_url(_valkey_url(), decode_responses=True) as r:
            await r.publish(tenant_channel(cid), payload)
            if target_agent_id is not None:
                await r.publish(agent_channel(cid, str(target_agent_id)), payload)
    except Exception as exc:  # noqa: BLE001
        logger.warning("inbox publish failed (non-blocking): %s", exc)


async def publish_event(
    company_id: uuid.UUID | str,
    conversation_id: uuid.UUID | str,
    event: dict[str, Any],
    *,
    target_agent_id: uuid.UUID | str | None = None,
) -> None:
    """Adaptateur de compatibilité pour le webhook Ph3 (`webhook._publish_realtime`).

    Le webhook appelle `inbox.ws.publish_event(company_id, conversation_id, event)`
    (signature historique). On enrichit l'event avec `conversation_id` puis on
    délègue à `publish_inbox_event` (best-effort, jamais bloquant).
    """
    enriched = dict(event)
    enriched.setdefault("conversation_id", str(conversation_id))
    await publish_inbox_event(company_id, enriched, target_agent_id=target_agent_id)


# ── Gestion des connexions locales ─────────────────────────────────────────


def _register(channel: str, ws: WebSocket) -> None:
    _connections.setdefault(channel, set()).add(ws)


def _unregister(channel: str, ws: WebSocket) -> None:
    s = _connections.get(channel)
    if s:
        s.discard(ws)
        if not s:
            del _connections[channel]


async def _broadcast_local(channel: str, data: str) -> None:
    dead: list[WebSocket] = []
    for ws in list(_connections.get(channel, set())):
        try:
            await ws.send_text(data)
        except Exception:  # noqa: BLE001
            dead.append(ws)
    for ws in dead:
        _unregister(channel, ws)


# ── Subscriber Valkey (tâche background par channel actif) ────────────────


async def _subscribe_loop(channel: str) -> None:
    try:
        async with aioredis.from_url(_valkey_url(), decode_responses=True) as r:
            pubsub = r.pubsub()
            await pubsub.subscribe(channel)
            async for message in pubsub.listen():
                if message["type"] == "message":
                    await _broadcast_local(channel, message["data"])
                if not _connections.get(channel):
                    break
            await pubsub.unsubscribe(channel)
    except asyncio.CancelledError:
        pass
    except Exception as exc:  # noqa: BLE001
        logger.warning("Valkey inbox subscriber error on %s: %s", channel, exc)
    finally:
        _subscriber_tasks.pop(channel, None)


def _ensure_subscriber(channel: str) -> None:
    if channel not in _subscriber_tasks:
        _subscriber_tasks[channel] = asyncio.ensure_future(_subscribe_loop(channel))


# ── Présence agent ─────────────────────────────────────────────────────────


async def _set_presence(company_id: str, user_id: str, r: aioredis.Redis) -> None:
    await r.setex(presence_key(company_id, user_id), _PRESENCE_TTL_S, "online")


async def _clear_presence(company_id: str, user_id: str, r: aioredis.Redis) -> None:
    await r.delete(presence_key(company_id, user_id))


# ── Handler principal WebSocket ───────────────────────────────────────────


async def inbox_ws_handler(
    websocket: WebSocket,
    company_id: str,
    user_id: str,
    *,
    is_supervisor: bool,
) -> None:
    """Connexion WS d'un agent / superviseur de la file omnicanale.

    Un superviseur s'abonne au flux TENANT (toute la file) ; un agent s'abonne
    à SON flux dédié (`agent:{user_id}`). Marque l'agent présent (présence TTL)
    et publie l'event de présence vers le tableau de bord superviseur.

    Protocole (JSON) :
      Client → serveur : {"type": "ping"}
      Serveur → client : events inbox.* / agent.presence / {"type": "pong"}
                       | {"type": "error", "detail": "..."}
    Les actions métier (réponse, assign, statut) passent par REST, pas par WS.
    """
    await websocket.accept()
    channel = tenant_channel(company_id) if is_supervisor else agent_channel(company_id, user_id)
    _register(channel, websocket)
    _ensure_subscriber(channel)
    logger.info(
        "inbox WS connected: company=%s user=%s supervisor=%s",
        company_id,
        user_id,
        is_supervisor,
    )

    async with aioredis.from_url(_valkey_url(), decode_responses=True) as r:
        await _set_presence(company_id, user_id, r)
        await publish_inbox_event(
            company_id,
            {"type": "agent.presence", "data": {"user_id": user_id, "status": "online"}},
        )
        try:
            while True:
                try:
                    raw = await asyncio.wait_for(websocket.receive_text(), timeout=25)
                except TimeoutError:
                    # Keepalive + rafraîchit le TTL de présence.
                    await _set_presence(company_id, user_id, r)
                    await websocket.send_text(json.dumps({"type": "ping"}))
                    continue
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    await websocket.send_text(
                        json.dumps({"type": "error", "detail": "invalid_json"})
                    )
                    continue
                if msg.get("type") == "ping":
                    await _set_presence(company_id, user_id, r)
                    await websocket.send_text(json.dumps({"type": "pong"}))
        except WebSocketDisconnect:
            logger.info("inbox WS disconnected: company=%s user=%s", company_id, user_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("inbox WS error user=%s: %s", user_id, exc)
        finally:
            _unregister(channel, websocket)
            await _clear_presence(company_id, user_id, r)
            await publish_inbox_event(
                company_id,
                {"type": "agent.presence", "data": {"user_id": user_id, "status": "offline"}},
            )
