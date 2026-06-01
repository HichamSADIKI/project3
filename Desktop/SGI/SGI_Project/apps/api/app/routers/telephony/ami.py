"""Pont AMI (Asterisk Manager Interface) → WebSocket.

Deux couches :
- **Helpers purs** (`parse_ami_packet`, `normalize_ami_event`) : parsing du
  protocole AMI et normalisation des events → testables sans Asterisk.
- **Client live** (`AMIClient`) : connexion TCP asyncio, login, lecture
  d'events, action `Originate` (click-to-call), reconnexion automatique.

Le listener tourne en tâche de fond (démarré par le lifespan, gardé) : si l'AMI
est injoignable il boucle en reconnexion silencieuse — l'API reste up. Il ne
fait QUE de la lecture cross-tenant (résolution extension → company_id) puis
publie les events sur le channel Valkey du tenant. La persistance CDR se fait
côté REST (softphone authentifié), pas ici → aucune écriture privilégiée.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

from app.core.config import settings
from app.routers.telephony.ws import publish_voice_event

logger = logging.getLogger(__name__)

# Events AMI qu'on relaie (on ignore le bruit).
_RELEVANT_EVENTS = {"Newchannel", "Newstate", "DialBegin", "DialEnd", "Hangup"}

# Mapping AMI event → type d'event WebSocket métier.
_EVENT_TYPE_MAP = {
    "Newchannel": "call.ringing",
    "DialBegin": "call.ringing",
    "Newstate": "call.state",
    "DialEnd": "call.answered",
    "Hangup": "call.ended",
}


# ─────────────────────────────────────────────────────────────────────────
# Helpers purs (testables sans Asterisk)
# ─────────────────────────────────────────────────────────────────────────


def parse_ami_packet(raw: str) -> dict[str, str]:
    """Parse un paquet AMI (`Key: Value\\r\\n` répétés) en dict.

    Les clés en double (rare) gardent la dernière valeur. Insensible aux fins
    de ligne `\\r\\n` ou `\\n`. Lignes sans `:` ignorées.
    """
    out: dict[str, str] = {}
    for line in raw.replace("\r\n", "\n").split("\n"):
        line = line.strip()
        if not line or ":" not in line:
            continue
        key, _, value = line.partition(":")
        out[key.strip()] = value.strip()
    return out


def normalize_ami_event(packet: dict[str, str]) -> dict[str, Any] | None:
    """Transforme un paquet AMI en event WebSocket normalisé, ou None si non pertinent.

    L'extension ciblée est extraite pour le routage (`extension`). Le matching
    client (screen pop) est fait en aval par le service (DB), pas ici.
    """
    event = packet.get("Event")
    if event not in _RELEVANT_EVENTS:
        return None

    # Extension agent concernée : selon l'event, Exten, ConnectedLineNum,
    # ou dérivée du nom de channel PJSIP/<ext>-xxxx.
    extension = (
        packet.get("Exten")
        or packet.get("ConnectedLineNum")
        or _extension_from_channel(packet.get("Channel", ""))
    )
    return {
        "type": _EVENT_TYPE_MAP.get(event, "call.state"),
        "extension": extension or None,
        "data": {
            "ami_event": event,
            "channel": packet.get("Channel"),
            "uniqueid": packet.get("Uniqueid"),
            "linkedid": packet.get("Linkedid"),
            "caller_number": packet.get("CallerIDNum"),
            "caller_name": packet.get("CallerIDName"),
            "connected_number": packet.get("ConnectedLineNum"),
            "channel_state": packet.get("ChannelStateDesc"),
            "cause": packet.get("Cause-txt") or packet.get("Cause"),
        },
    }


def _extension_from_channel(channel: str) -> str | None:
    """`PJSIP/6001-00000003` → `6001`."""
    if not channel or "/" not in channel:
        return None
    tail = channel.split("/", 1)[1]
    return tail.split("-", 1)[0] or None


# ─────────────────────────────────────────────────────────────────────────
# Client AMI live
# ─────────────────────────────────────────────────────────────────────────


class AMIClient:
    """Client AMI minimal (asyncio). Login, lecture d'events, Originate."""

    def __init__(self) -> None:
        self._reader: asyncio.StreamReader | None = None
        self._writer: asyncio.StreamWriter | None = None
        self._action_id = 0
        self._lock = asyncio.Lock()

    async def connect_and_login(self) -> None:
        self._reader, self._writer = await asyncio.open_connection(
            settings.AMI_HOST, settings.AMI_PORT
        )
        # Bannière de version : on lit la première ligne.
        await self._reader.readline()
        await self._send_action(
            {
                "Action": "Login",
                "Username": settings.AMI_USER,
                "Secret": settings.AMI_PASSWORD,
                "Events": "on",
            }
        )
        logger.info("AMI connecté %s:%s", settings.AMI_HOST, settings.AMI_PORT)

    async def _send_action(self, fields: dict[str, str]) -> None:
        if self._writer is None:
            raise RuntimeError("AMI not connected")
        self._action_id += 1
        fields.setdefault("ActionID", str(self._action_id))
        payload = "".join(f"{k}: {v}\r\n" for k, v in fields.items()) + "\r\n"
        async with self._lock:
            self._writer.write(payload.encode("utf-8"))
            await self._writer.drain()

    async def originate(
        self,
        extension: str,
        to_number: str,
        *,
        context: str = "internal",
        caller_id: str | None = None,
        channel_id: str | None = None,
    ) -> None:
        """Click-to-call : fait sonner l'extension de l'agent puis compose le numéro.

        `channel_id` (optionnel) force l'UNIQUEID du canal Asterisk via le
        paramètre `ChannelId` de l'action Originate (Asterisk ≥14). On le
        renseigne pour que l'enregistrement (`<UNIQUEID>.wav`) soit rapprochable
        du CDR applicatif (`Call.channel_id`).
        """
        action = {
            "Action": "Originate",
            "Channel": f"PJSIP/{extension}",
            "Context": context,
            "Exten": to_number,
            "Priority": "1",
            "CallerID": caller_id or to_number,
            "Async": "true",
        }
        if channel_id:
            action["ChannelId"] = channel_id
        await self._send_action(action)

    async def read_packets(self):
        """Générateur asynchrone de paquets AMI (un dict par bloc)."""
        assert self._reader is not None
        buffer: list[str] = []
        while True:
            line = await self._reader.readline()
            if not line:  # connexion fermée
                break
            decoded = line.decode("utf-8", errors="replace")
            if decoded in ("\r\n", "\n"):
                if buffer:
                    yield parse_ami_packet("".join(buffer))
                    buffer = []
            else:
                buffer.append(decoded)

    async def close(self) -> None:
        if self._writer is not None:
            self._writer.close()
            try:
                await self._writer.wait_closed()
            except Exception:  # noqa: BLE001
                pass


# ── Listener de fond (gardé) ──────────────────────────────────────────────

_listener_task: asyncio.Task | None = None
_client: AMIClient | None = None


async def _resolve_companies_for_extension(db, extension: str) -> list[str]:
    """Résout TOUS les company_id propriétaires d'une extension (cross-tenant).

    Consommateur de fond légitime → rôle privilégié (comme les tâches Celery).

    Correctif M-3 : l'extension n'est unique que PAR tenant
    (``uq_agent_states_extension = (company_id, extension)``). Un ancien
    ``.limit(1)`` sans ``company_id`` pouvait publier un event sur le MAUVAIS
    tenant (fan-out croisé) si deux sociétés partagent une extension (ex. 6001
    en dev). On retourne l'ensemble des tenants concernés : chaque agent ne
    s'abonnant qu'au channel de SON tenant (``voice:{company_id}:ext:{ext}``),
    l'event n'atteint que les destinataires légitimes — aucune fuite inter-tenant.
    """
    from sqlalchemy import select

    from app.routers.telephony.models import AgentState

    rows = (
        await db.execute(
            select(AgentState.company_id).where(AgentState.extension == extension)
        )
    ).scalars().all()
    return [str(r) for r in rows]


async def _dispatch(packet: dict[str, str]) -> None:
    """Pour chaque event AMI pertinent : persiste/maj le CDR (idempotent) PUIS
    publie l'event temps réel, par tenant propriétaire de l'extension.

    Écriture privilégiée cross-tenant assumée (pattern Celery), bornée au
    company_id résolu. Tout échec est non bloquant : le flux AMI continue.
    """
    import uuid as _uuid

    from app.core.database import async_session_maker
    from app.routers.telephony import service

    event = normalize_ami_event(packet)
    if event is None or not event.get("extension"):
        return
    extension = event["extension"]
    try:
        async with async_session_maker() as db:
            company_ids = await _resolve_companies_for_extension(db, extension)
            for company_id in company_ids:
                try:
                    await service.apply_ami_cdr(db, _uuid.UUID(company_id), event)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("persistance CDR AMI échouée (%s): %s",
                                   company_id, exc)
                # Publication ciblée par channel tenant (cf. M-3).
                await publish_voice_event(company_id, extension, event)
    except Exception as exc:  # noqa: BLE001
        logger.warning("dispatch AMI (session) échoué: %s", exc)


async def _run_listener() -> None:
    """Boucle de reconnexion AMI. Ne lève jamais : l'API reste up sans Asterisk."""
    global _client
    backoff = 1
    while True:
        try:
            _client = AMIClient()
            await _client.connect_and_login()
            backoff = 1
            async for packet in _client.read_packets():
                try:
                    await _dispatch(packet)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("dispatch AMI échoué: %s", exc)
            logger.warning("flux AMI terminé, reconnexion…")
        except asyncio.CancelledError:
            break
        except Exception as exc:  # noqa: BLE001
            logger.warning("AMI indisponible (%s) — retry dans %ss", exc, backoff)
        finally:
            if _client is not None:
                await _client.close()
        try:
            await asyncio.sleep(backoff)
        except asyncio.CancelledError:
            break
        backoff = min(backoff * 2, 30)


def start_ami_listener() -> None:
    """Démarre le listener AMI en tâche de fond (idempotent, gardé par flag)."""
    global _listener_task
    if not settings.TELEPHONY_AMI_ENABLED:
        logger.info("AMI listener désactivé (TELEPHONY_AMI_ENABLED=false)")
        return
    # Durcissement M-3 : un AMI sans secret est inacceptable hors dev. En prod
    # (DEBUG=false) on refuse de démarrer le listener avec un mot de passe vide
    # plutôt que de se logger en clair sur le manager Asterisk.
    if not settings.AMI_PASSWORD:
        if not settings.DEBUG:
            logger.error(
                "AMI_PASSWORD vide en production : listener AMI NON démarré "
                "(définir AMI_PASSWORD ou TELEPHONY_AMI_ENABLED=false)"
            )
            return
        logger.warning("AMI_PASSWORD vide (dev) : login AMI sans secret")
    if _listener_task is None or _listener_task.done():
        _listener_task = asyncio.ensure_future(_run_listener())
        logger.info("AMI listener démarré")


async def stop_ami_listener() -> None:
    global _listener_task
    if _listener_task is not None:
        _listener_task.cancel()
        try:
            await _listener_task
        except asyncio.CancelledError:
            pass
        _listener_task = None


def get_client() -> AMIClient | None:
    """Client AMI courant (pour les actions Originate depuis le router)."""
    return _client
