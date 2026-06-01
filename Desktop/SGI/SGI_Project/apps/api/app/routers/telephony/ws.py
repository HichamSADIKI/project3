"""WebSocket Téléphonie — événements d'appel temps réel (screen pop, statut).

Même architecture que comms/ws.py : fan-out multi-réplicas via Valkey pub/sub,
compatible `make scale`.

Channel : `voice:{company_id}:ext:{extension}`
  → namespacé par tenant (Loi 1) ET par extension agent, pour qu'un agent ne
    reçoive QUE les événements de SA ligne. Deux tenants peuvent réutiliser la
    même extension sans fuite croisée.

Events poussés au softphone (JSON) :
  {"type": "call.ringing",   "data": {...screen pop: from, client matches...}}
  {"type": "call.answered",  "data": {...}}
  {"type": "call.ended",     "data": {...}}
  {"type": "agent.status",   "data": {...}}
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

import redis.asyncio as aioredis
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

_connections: dict[str, set[WebSocket]] = {}
_subscriber_tasks: dict[str, asyncio.Task] = {}


def voice_channel(company_id: str, extension: str) -> str:
    return f"voice:{company_id}:ext:{extension}"


def _valkey_url() -> str:
    return os.getenv("VALKEY_URL", "redis://valkey:6379/0")


async def publish_voice_event(
    company_id: str, extension: str, event: dict[str, Any]
) -> None:
    """Publie un event d'appel dans le channel Valkey de l'extension (best-effort)."""
    try:
        async with aioredis.from_url(_valkey_url(), decode_responses=True) as r:
            await r.publish(voice_channel(company_id, extension), json.dumps(event))
    except Exception as exc:  # noqa: BLE001
        logger.warning("voice publish failed (non-blocking): %s", exc)


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
        logger.warning("Valkey voice subscriber error on %s: %s", channel, exc)
    finally:
        _subscriber_tasks.pop(channel, None)


def _ensure_subscriber(channel: str) -> None:
    if channel not in _subscriber_tasks:
        _subscriber_tasks[channel] = asyncio.ensure_future(_subscribe_loop(channel))


async def voice_ws_handler(
    websocket: WebSocket, company_id: str, extension: str
) -> None:
    """Connexion WS d'un agent : reçoit les events de sa ligne. Keepalive ping."""
    await websocket.accept()
    channel = voice_channel(company_id, extension)
    _register(channel, websocket)
    _ensure_subscriber(channel)
    logger.info("voice WS connected: company=%s ext=%s", company_id, extension)
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
                await websocket.send_text(
                    json.dumps({"type": "error", "detail": "invalid_json"})
                )
                continue
            if msg.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        logger.info("voice WS disconnected: company=%s ext=%s", company_id, extension)
    except Exception as exc:  # noqa: BLE001
        logger.warning("voice WS error ext=%s: %s", extension, exc)
    finally:
        _unregister(channel, websocket)
