"""Webhook WhatsApp Cloud API — entrée inbound de l'Inbox omnicanal (Ph3).

Ce router est **séparé** du router métier (`inbox_webhook_router`) et **sans auth
JWT** : c'est Meta (WhatsApp Cloud API) qui appelle ces endpoints, pas un agent.
La sécurité repose donc sur :

1. **GET /inbox/webhook/whatsapp** — vérification du challenge Meta. On compare
   `hub.verify_token` au secret partagé `WHATSAPP_VERIFY_TOKEN` (env) et on renvoie
   `hub.challenge` en clair (exigence Meta). Échec → 403.
2. **POST /inbox/webhook/whatsapp** — réception des messages. Protégé par la
   signature `X-Hub-Signature-256` (HMAC SHA-256 du corps avec l'app secret).
   En prod : `WHATSAPP_APP_SECRET` défini **et** `WHATSAPP_REQUIRE_SIGNATURE=true`
   → tout payload non signé/mal signé est rejeté (fail-closed). En dev (flag à
   `false`, défaut) : best-effort si le secret est absent.

────────────────────────────────────────────────────────────────────────────
RÉSOLUTION MULTI-TENANT (Loi 1) — point d'attention
────────────────────────────────────────────────────────────────────────────
Meta envoie le `phone_number_id` du numéro WhatsApp Business destinataire. Le
tenant est résolu via la table **`inbox_channel_configs`** (migration 0045),
interrogée par la fonction **SECURITY DEFINER** `inbox_resolve_company` : le
webhook n'ayant aucun contexte RLS (pas de JWT), cette fonction — propriété de
l'owner des tables — contourne la RLS pour ce seul lookup et ne renvoie que le
`company_id` du canal actif. L'enrôlement se fait via `POST /inbox/channels`
(tenant-scopé, RLS). Le mapping env historique `WHATSAPP_PHONE_NUMBER_MAP`
(JSON `{"<phone_number_id>": "<company_uuid>"}`) reste un **fallback déprécié**.
Un `phone_number_id` inconnu → 200 + ignoré (Meta ne doit jamais recevoir
d'erreur, sinon il retire l'abonnement).

Comme aucun JWT n'est présent, le `TenantMiddleware` ne pose pas le contexte RLS :
on pose donc manuellement le GUC `app.current_company_id` sur la connexion
épinglée (même pattern que `telephony.ws`) avant tout accès DB.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.routers.inbox import service

logger = logging.getLogger(__name__)

inbox_webhook_router = APIRouter(prefix="/inbox/webhook", tags=["inbox"])

_WHATSAPP_CHANNEL = "whatsapp"
# Clé Valkey de déduplication des messages WhatsApp (TTL impératif — règle SGI).
_DEDUP_TTL_SECONDS = 3 * 24 * 3600  # 3 jours : Meta peut rejouer un message ~24-72 h.

_SET_TENANT = sql_text("SELECT set_config('app.current_company_id', :cid, false)")


# ─────────────────────────────────────────────────────────────────────────
# Helper pur — parsing du payload WhatsApp Cloud API (testable sans réseau)
# ─────────────────────────────────────────────────────────────────────────


def extract_whatsapp_messages(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Extrait les messages entrants d'un payload WhatsApp Cloud API.

    Forme attendue (simplifiée) ::

        {"entry": [{"changes": [{"value": {
            "messaging_product": "whatsapp",
            "metadata": {"phone_number_id": "...", "display_phone_number": "..."},
            "contacts": [{"wa_id": "971500000000", "profile": {"name": "Ali"}}],
            "messages": [{"id": "wamid.xxx", "from": "971500000000",
                          "timestamp": "1717322400", "type": "text",
                          "text": {"body": "Salam"}}],
        }}]}]}

    Retourne une liste de dicts normalisés ::

        {external_message_id, from, text, timestamp, phone_number_id, contact_name}

    Robuste aux formes partielles (clés manquantes → liste vide), aux events de
    statut (`statuses` sans `messages` → ignorés) et aux types non-texte
    (image/audio/document → `text=None` mais message conservé pour traçabilité).
    Ne lève jamais : un payload inattendu produit une liste vide.
    """
    results: list[dict[str, Any]] = []
    if not isinstance(payload, dict):
        return results

    for entry in payload.get("entry") or []:
        if not isinstance(entry, dict):
            continue
        for change in entry.get("changes") or []:
            if not isinstance(change, dict):
                continue
            value = change.get("value")
            if not isinstance(value, dict):
                continue

            metadata = value.get("metadata") or {}
            phone_number_id = (
                metadata.get("phone_number_id") if isinstance(metadata, dict) else None
            )

            # Mapping wa_id → nom de profil (contacts), pour l'affichage agent.
            contact_names: dict[str, str] = {}
            for contact in value.get("contacts") or []:
                if not isinstance(contact, dict):
                    continue
                wa_id = contact.get("wa_id")
                profile = contact.get("profile") or {}
                name = profile.get("name") if isinstance(profile, dict) else None
                if isinstance(wa_id, str) and isinstance(name, str):
                    contact_names[wa_id] = name

            for message in value.get("messages") or []:
                if not isinstance(message, dict):
                    continue
                msg_id = message.get("id")
                sender = message.get("from")
                if not isinstance(msg_id, str) or not isinstance(sender, str):
                    # Sans identifiant ni expéditeur, on ne peut ni dédoublonner
                    # ni rattacher la conversation : on ignore.
                    continue

                results.append(
                    {
                        "external_message_id": msg_id,
                        "from": sender,
                        "text": _extract_text(message),
                        "timestamp": message.get("timestamp"),
                        "phone_number_id": phone_number_id,
                        "contact_name": contact_names.get(sender),
                    }
                )
    return results


def _extract_text(message: dict[str, Any]) -> str | None:
    """Extrait le corps texte d'un message WhatsApp (text / button / interactive)."""
    text = message.get("text")
    if isinstance(text, dict):
        body = text.get("body")
        if isinstance(body, str):
            return body
    button = message.get("button")
    if isinstance(button, dict):
        btn_text = button.get("text")
        if isinstance(btn_text, str):
            return btn_text
    interactive = message.get("interactive")
    if isinstance(interactive, dict):
        for sub_key in ("button_reply", "list_reply"):
            sub = interactive.get(sub_key)
            if isinstance(sub, dict):
                title = sub.get("title")
                if isinstance(title, str):
                    return title
    return None


# ─────────────────────────────────────────────────────────────────────────
# Résolution tenant (MVP env-based — voir docstring module + wiring_needed)
# ─────────────────────────────────────────────────────────────────────────


def resolve_company_id(phone_number_id: str | None) -> uuid.UUID | None:
    """Résout le tenant à partir du `phone_number_id` WhatsApp via le mapping env.

    `WHATSAPP_PHONE_NUMBER_MAP` = JSON `{"<phone_number_id>": "<company_uuid>"}`.
    Retourne None si non configuré, JSON invalide, id absent ou UUID malformé.
    """
    if not phone_number_id:
        return None
    raw = os.getenv("WHATSAPP_PHONE_NUMBER_MAP", "")
    if not raw:
        return None
    try:
        mapping = json.loads(raw)
    except (ValueError, TypeError):
        logger.warning("WHATSAPP_PHONE_NUMBER_MAP n'est pas un JSON valide")
        return None
    if not isinstance(mapping, dict):
        return None
    company_raw = mapping.get(phone_number_id)
    if not isinstance(company_raw, str):
        return None
    try:
        return uuid.UUID(company_raw)
    except ValueError:
        logger.warning("company_id invalide dans le mapping WhatsApp pour %s", phone_number_id)
        return None


# ─────────────────────────────────────────────────────────────────────────
# Signature Meta (X-Hub-Signature-256) — fail-closed en prod (REQUIRE_SIGNATURE)
# ─────────────────────────────────────────────────────────────────────────


def _require_signature() -> bool:
    """True si la vérification de signature est OBLIGATOIRE (fail-closed).

    Piloté par `WHATSAPP_REQUIRE_SIGNATURE` (à mettre à `true` en prod). Par
    défaut `false` → comportement dev best-effort (cf. `verify_meta_signature`).
    """
    return os.getenv("WHATSAPP_REQUIRE_SIGNATURE", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def verify_meta_signature(raw_body: bytes, header_signature: str | None) -> bool:
    """Vérifie la signature HMAC-SHA256 de Meta (`X-Hub-Signature-256`).

    - Secret défini → on exige une signature valide (sinon False).
    - Secret ABSENT → dépend de `WHATSAPP_REQUIRE_SIGNATURE` : **prod (`true`) →
      False (fail-closed : on refuse les payloads non vérifiables)** ; dev
      (`false`, défaut) → True (best-effort, ne bloque pas le développement local).

    Le fail-closed devient important depuis l'enrôlement par tenant (table
    `inbox_channel_configs`, migration 0045) : un `phone_number_id` résout vers
    un vrai tenant, donc un payload non signé pourrait injecter de faux messages
    dans son inbox. En prod : définir `WHATSAPP_APP_SECRET` **et**
    `WHATSAPP_REQUIRE_SIGNATURE=true`.
    """
    app_secret = os.getenv("WHATSAPP_APP_SECRET", "")
    if not app_secret:
        # Pas de secret : refus en prod (require), best-effort en dev.
        return not _require_signature()
    if not header_signature or not header_signature.startswith("sha256="):
        return False
    expected = hmac.new(app_secret.encode(), raw_body, hashlib.sha256).hexdigest()
    provided = header_signature.removeprefix("sha256=")
    return hmac.compare_digest(expected, provided)


# ─────────────────────────────────────────────────────────────────────────
# Déduplication Valkey (TTL impératif — règle SGI : jamais de clé sans TTL)
# ─────────────────────────────────────────────────────────────────────────


async def _already_processed(external_message_id: str) -> bool:
    """True si ce message a déjà été traité (clé `wa:msg:{id}` posée). Best-effort.

    Utilise SET NX EX : pose la clé si absente, renvoie alors True (première fois).
    On retourne `not first_time` → si Valkey est indisponible, on traite quand même
    (les fonctions service `get_or_create`/`add_message` sont elles-mêmes idempotentes,
    la dédup Valkey n'est qu'une optimisation pour éviter le travail DB redondant).
    """
    try:
        import redis.asyncio as aioredis

        url = os.getenv("VALKEY_URL", "redis://valkey:6379/0")
        async with aioredis.from_url(url, decode_responses=True) as r:
            first_time = await r.set(
                f"wa:msg:{external_message_id}", "1", nx=True, ex=_DEDUP_TTL_SECONDS
            )
            return not first_time
    except Exception as exc:  # noqa: BLE001
        logger.warning("Dédup Valkey indisponible (non bloquant): %s", exc)
        return False


# ─────────────────────────────────────────────────────────────────────────
# Hook temps réel (branché sur le WS Ph4 par l'architecte — voir wiring_needed)
# ─────────────────────────────────────────────────────────────────────────


async def _publish_realtime(
    company_id: uuid.UUID, conversation_id: uuid.UUID, event: dict[str, Any]
) -> None:
    """Publie un event temps réel si le bus WS Ph4 (`inbox.ws`) est présent.

    Import paresseux et tolérant : tant que `inbox/ws.py` n'existe pas (Ph4), ce
    hook est un no-op. L'architecte branchera `inbox.ws.publish_event` ici.
    """
    try:
        from app.routers.inbox import ws as inbox_ws
    except ImportError:
        return
    publish = getattr(inbox_ws, "publish_event", None)
    if publish is None:
        return
    try:
        await publish(company_id, conversation_id, event)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Publication temps réel inbox échouée (non bloquant): %s", exc)


# ─────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────


@inbox_webhook_router.get("/whatsapp")
async def verify_whatsapp_webhook(
    hub_mode: str | None = Query(None, alias="hub.mode"),
    hub_verify_token: str | None = Query(None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(None, alias="hub.challenge"),
) -> Response:
    """Vérification du challenge Meta (abonnement webhook WhatsApp).

    Meta appelle `GET …?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…`.
    On renvoie `hub.challenge` en texte brut si le token correspond, sinon 403.
    """
    expected = os.getenv("WHATSAPP_VERIFY_TOKEN", "")
    if hub_mode == "subscribe" and expected and hub_verify_token == expected and hub_challenge:
        return Response(content=hub_challenge, media_type="text/plain")
    return Response(
        content="forbidden", status_code=status.HTTP_403_FORBIDDEN, media_type="text/plain"
    )


@inbox_webhook_router.post("/whatsapp")
async def receive_whatsapp_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Réception des messages WhatsApp inbound.

    Toujours 200 (Meta retire l'abonnement sur erreur) : les payloads non
    résolubles (tenant inconnu, signature invalide) sont journalisés et ignorés.
    Idempotent : dédup Valkey + idempotence des fonctions service.
    """
    raw_body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256")
    if not verify_meta_signature(raw_body, signature):
        logger.warning("Signature Meta invalide — payload WhatsApp ignoré")
        return {"success": True, "data": {"ignored": "invalid_signature"}}

    try:
        payload = json.loads(raw_body) if raw_body else {}
    except ValueError:
        logger.warning("Payload WhatsApp non-JSON ignoré")
        return {"success": True, "data": {"ignored": "invalid_json"}}

    messages = extract_whatsapp_messages(payload)
    if not messages:
        # Events de statut (delivered/read) ou payload vide : rien à ingérer.
        return {"success": True, "data": {"ingested": 0}}

    ingested = 0
    skipped_no_tenant = 0
    deduped = 0

    for parsed in messages:
        phone_number_id = parsed.get("phone_number_id")
        # Source de vérité : table inbox_channel_configs via la fonction
        # SECURITY DEFINER (résout sans contexte RLS). Fallback : mapping env
        # historique (déprécié) pour ne pas casser les déploiements existants.
        company_id = await service.resolve_company_by_channel(
            db, _WHATSAPP_CHANNEL, phone_number_id
        )
        if company_id is None:
            company_id = resolve_company_id(phone_number_id)
        if company_id is None:
            skipped_no_tenant += 1
            logger.warning(
                "phone_number_id non mappé à un tenant: %s", parsed.get("phone_number_id")
            )
            continue

        external_message_id = parsed["external_message_id"]
        if await _already_processed(external_message_id):
            deduped += 1
            continue

        # Contexte RLS posé manuellement (pas de JWT/middleware sur le webhook).
        await db.execute(_SET_TENANT, {"cid": str(company_id)})
        await db.commit()

        conversation, conv_created = await service.get_or_create_conversation(
            db,
            company_id,
            channel=_WHATSAPP_CHANNEL,
            external_thread_id=parsed["from"],
            contact_display=parsed.get("contact_name") or parsed["from"],
        )
        if conv_created:
            # Nouveau fil → les superviseurs en écoute doivent le voir apparaître.
            await _publish_realtime(
                company_id,
                conversation.id,
                {
                    "type": "conversation.created",
                    "data": {
                        "conversation_id": str(conversation.id),
                        "channel": _WHATSAPP_CHANNEL,
                        "reference": conversation.reference,
                        "contact_display": conversation.contact_display,
                    },
                },
            )
        message, created = await service.add_message(
            db,
            company_id,
            conversation,
            direction="inbound",
            body=parsed.get("text"),
            external_message_id=external_message_id,
            raw_payload=parsed,
        )
        if created:
            ingested += 1
            await _publish_realtime(
                company_id,
                conversation.id,
                {
                    "type": "message.created",
                    "data": {
                        "conversation_id": str(conversation.id),
                        "message_id": str(message.id),
                        "channel": _WHATSAPP_CHANNEL,
                        "direction": "inbound",
                        "body": parsed.get("text"),
                    },
                },
            )
        else:
            deduped += 1

    return {
        "success": True,
        "data": {"ingested": ingested, "deduped": deduped, "skipped_no_tenant": skipped_no_tenant},
    }
