"""WebSocket Communication — fan-out multi-réplicas via Valkey pub/sub.

Architecture :
  Client WebSocket  ←→  API réplica N  ←→  Valkey pub/sub channel
                                            conv:{company_id}:{conv_id}

Chaque réplica API maintient une liste locale de connexions WS par channel.
À la réception d'un message REST (send_message), le service publie dans le
channel Valkey. Chaque réplica (y compris celui qui n'a pas reçu la requête
REST) écoute son canal, reçoit l'event et le pousse à ses WS connectés.
Compatible `make scale n=` — cohérence garantie via le bus Valkey.

Clés Valkey utilisées :
  conv:{cid}:{conv_id}         — pub/sub channel (pas de TTL : éphémère)
  presence:{user_id}           — timestamp dernière activité  (TTL 30 s)
  typing:{conv_id}:{user_id}   — flag typing                  (TTL 5 s)

Jamais de clé Valkey sans TTL pour les états éphémères (règle SGI).
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


def _channel(company_id: str, conv_id: str) -> str:
    return f"conv:{company_id}:{conv_id}"


def _valkey_url() -> str:
    return os.getenv("VALKEY_URL", "redis://valkey:6379/0")


# ── Publication (appelée depuis service.send_message) ─────────────────────


async def publish_event(
    company_id: uuid.UUID,
    conv_id: uuid.UUID,
    event: dict[str, Any],
) -> None:
    """Publie un event JSON dans le channel Valkey de la conversation."""
    try:
        async with aioredis.from_url(_valkey_url(), decode_responses=True) as r:
            channel = _channel(str(company_id), str(conv_id))
            await r.publish(channel, json.dumps(event))
    except Exception as exc:  # noqa: BLE001
        logger.warning("WS publish failed (non-blocking): %s", exc)


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
    """Pousse le message à toutes les connexions WS locales de ce channel."""
    dead: list[WebSocket] = []
    for ws in list(_connections.get(channel, set())):
        try:
            await ws.send_text(data)
        except Exception:  # noqa: BLE001
            dead.append(ws)
    for ws in dead:
        _unregister(channel, ws)


# ── Subscriber Valkey (tâche background par channel actif) ────────────────

_subscriber_tasks: dict[str, asyncio.Task] = {}


async def _subscribe_loop(channel: str) -> None:
    """Écoute le channel Valkey et pousse aux WS locaux."""
    url = _valkey_url()
    try:
        async with aioredis.from_url(url, decode_responses=True) as r:
            pubsub = r.pubsub()
            await pubsub.subscribe(channel)
            async for message in pubsub.listen():
                if message["type"] == "message":
                    await _broadcast_local(channel, message["data"])
                # Arrêt propre si plus personne n'écoute.
                if not _connections.get(channel):
                    break
            await pubsub.unsubscribe(channel)
    except asyncio.CancelledError:
        pass
    except Exception as exc:  # noqa: BLE001
        logger.warning("Valkey subscriber error on %s: %s", channel, exc)
    finally:
        _subscriber_tasks.pop(channel, None)


def _ensure_subscriber(channel: str) -> None:
    """Lance la tâche subscriber si elle n'existe pas encore."""
    if channel not in _subscriber_tasks:
        task = asyncio.ensure_future(_subscribe_loop(channel))
        _subscriber_tasks[channel] = task


# ── Présence & typing ─────────────────────────────────────────────────────


async def _set_presence(user_id: str, r: aioredis.Redis) -> None:
    await r.setex(f"presence:{user_id}", 30, "1")


async def _set_typing(conv_id: str, user_id: str, r: aioredis.Redis) -> None:
    await r.setex(f"typing:{conv_id}:{user_id}", 5, "1")


# ── Handler principal WebSocket ───────────────────────────────────────────


async def ws_handler(
    websocket: WebSocket,
    company_id: str,
    conv_id: str,
    user_id: str,
) -> None:
    """
    Gère la connexion WebSocket d'un participant.

    Protocole (JSON) :
      Client → serveur : {"type": "typing"} | {"type": "ping"}
      Serveur → client : {"type": "message.created", "data": {...}}
                       | {"type": "message.read", "user_id": "...", "conv_id": "..."}
                       | {"type": "typing", "user_id": "..."}
                       | {"type": "pong"}
                       | {"type": "error", "detail": "..."}
    """
    await websocket.accept()
    channel = _channel(company_id, conv_id)
    _register(channel, websocket)
    _ensure_subscriber(channel)

    logger.info("WS connected: user=%s conv=%s", user_id, conv_id)

    async with aioredis.from_url(_valkey_url(), decode_responses=True) as r:
        await _set_presence(user_id, r)

        try:
            while True:
                try:
                    raw = await asyncio.wait_for(websocket.receive_text(), timeout=25)
                except TimeoutError:
                    # Keepalive : envoie un ping si le client est silencieux.
                    await websocket.send_text(json.dumps({"type": "ping"}))
                    continue

                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    await websocket.send_text(
                        json.dumps({"type": "error", "detail": "invalid_json"})
                    )
                    continue

                event_type = msg.get("type")

                if event_type == "typing":
                    await _set_typing(conv_id, user_id, r)
                    await publish_event(
                        uuid.UUID(company_id),
                        uuid.UUID(conv_id),
                        {"type": "typing", "user_id": user_id},
                    )

                elif event_type == "ping":
                    await _set_presence(user_id, r)
                    await websocket.send_text(json.dumps({"type": "pong"}))

                # Les messages texte sont envoyés via REST (POST /messages),
                # pas directement par WS — le WS reçoit uniquement les events.

        except WebSocketDisconnect:
            logger.info("WS disconnected: user=%s conv=%s", user_id, conv_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("WS error user=%s: %s", user_id, exc)
        finally:
            _unregister(channel, websocket)
