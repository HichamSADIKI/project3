"""WebSocket Notifications temps réel — push in-app par utilisateur.

Même architecture que `inbox/ws.py` / `comms/ws.py` : registre local de
connexions par channel sur chaque réplica, fan-out inter-réplicas via Valkey
pub/sub (`make scale n=`). Aucune clé Valkey éphémère sans TTL.

Channel (namespacé par tenant — Loi 1) :

  notif:{company_id}:{user_id}  — flux PERSONNEL : uniquement les notifications
                                  in-app destinées à cet utilisateur de ce
                                  tenant. Le préfixe `{company_id}` borne tout
                                  par société (deux tenants ne se croisent
                                  jamais, même user_id improbable).

Events poussés au client (JSON) :
  {"type": "notification.created", "data": {...}}  — nouvelle notif in-app
  {"type": "ping"} / {"type": "pong"}              — keepalive

Les actions (marquer lu, tout lire) passent par REST, jamais par WS.
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

# Registre local des connexions WS (par channel, par réplica).
_connections: dict[str, set[WebSocket]] = {}
_subscriber_tasks: dict[str, asyncio.Task[None]] = {}


def user_channel(company_id: str, user_id: str) -> str:
    """Flux personnel de notifications d'un utilisateur, borné au tenant (Loi 1)."""
    return f"notif:{company_id}:{user_id}"


def _valkey_url() -> str:
    return os.getenv("VALKEY_URL", "redis://valkey:6379/0")


# ── Publication (appelée depuis le service, best-effort) ───────────────────


async def publish_notification(
    company_id: uuid.UUID | str,
    user_id: uuid.UUID | str,
    event: dict[str, Any],
) -> None:
    """Publie un event JSON sur le channel personnel de l'utilisateur.

    Best-effort : un échec Valkey n'interrompt jamais la requête métier. La
    notification reste persistée en base ; le WS n'est qu'un confort temps réel.
    """
    channel = user_channel(str(company_id), str(user_id))
    try:
        async with aioredis.from_url(_valkey_url(), decode_responses=True) as r:
            await r.publish(channel, json.dumps(event))
    except Exception as exc:  # noqa: BLE001
        logger.warning("notif publish failed (non-blocking): %s", exc)


# ── Connexions locales ──────────────────────────────────────────────────────


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
        logger.warning("Valkey notif subscriber error on %s: %s", channel, exc)
    finally:
        _subscriber_tasks.pop(channel, None)


def _ensure_subscriber(channel: str) -> None:
    if channel not in _subscriber_tasks:
        _subscriber_tasks[channel] = asyncio.ensure_future(_subscribe_loop(channel))


# ── Handler principal WebSocket ────────────────────────────────────────────


async def notifications_ws_handler(websocket: WebSocket, company_id: str, user_id: str) -> None:
    """Connexion WS du centre de notifications d'un utilisateur.

    Protocole (JSON) :
      Client → serveur : {"type": "ping"}
      Serveur → client : {"type": "notification.created", "data": {...}}
                       | {"type": "pong"} | {"type": "ping"} (keepalive)
    """
    await websocket.accept()
    channel = user_channel(company_id, user_id)
    _register(channel, websocket)
    _ensure_subscriber(channel)
    logger.info("notif WS connected: company=%s user=%s", company_id, user_id)
    try:
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=25)
            except TimeoutError:
                await websocket.send_text(json.dumps({"type": "ping"}))
                continue
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "error", "detail": "invalid_json"}))
                continue
            if msg.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        logger.info("notif WS disconnected: company=%s user=%s", company_id, user_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("notif WS error user=%s: %s", user_id, exc)
    finally:
        _unregister(channel, websocket)
