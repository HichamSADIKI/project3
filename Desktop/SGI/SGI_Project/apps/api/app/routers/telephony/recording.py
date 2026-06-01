"""Enregistrement des appels (PDPL UAE) — service + router.

Conformité **PDPL** (Federal Decree-Law No. 45 of 2021) : un appel n'est
enregistré qu'avec consentement (`Call.recording_consent`), précédé côté
Asterisk d'une annonce de consentement (cf. `infra/asterisk/config/extensions.conf`,
macro `pdpl-record`). Ce module gère le versant applicatif :

- **Association** : Asterisk écrit le `.wav` dans le volume partagé puis un
  worker l'uploade vers MinIO et appelle `attach_recording` qui pose la clé
  objet dans `Call.recording_url` (la colonne existe déjà, migration 0028).
- **Téléchargement sécurisé** : `GET /telephony/calls/{id}/recording` — filtré
  par `company_id` (Loi 1), vérifie le consentement, renvoie une URL signée
  MinIO temporaire (jamais le binaire en clair via l'API).

Le module n'expose qu'un `APIRouter` SANS prefix (`recording_router`) que
l'architecte monte sur le router telephony existant (voir wiring_needed). Les
helpers de dépendances (`_get_company_id`, `_require_roles`) sont ré-importés
depuis `router.py` pour rester cohérents avec le reste du module.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import storage
from app.core.deps import get_db_session
from app.routers.telephony import service
from app.routers.telephony.models import Call

# ─────────────────────────────────────────────────────────────────────────
# Stockage objet — clé déterministe par tenant
# ─────────────────────────────────────────────────────────────────────────


def build_recording_key(company_id: uuid.UUID, call_id: uuid.UUID) -> str:
    """Clé objet MinIO d'un enregistrement, namespacée par tenant (Loi 1).

    Arborescence : ``telephony/{company_id}/recordings/{call_id}.wav``. Le
    company_id en tête permet un audit/purge PDPL par société.
    """
    return f"telephony/{company_id}/recordings/{call_id}.wav"


def channel_id_from_filename(filename: str) -> str | None:
    """`<UNIQUEID>.wav` → `<UNIQUEID>`. None si ce n'est pas un .wav.

    Asterisk nomme l'enregistrement d'après l'UNIQUEID du canal (cf. macro
    `pdpl-record`), qu'on stocke dans `Call.channel_id` au click-to-call.
    """
    if not filename.endswith(".wav"):
        return None
    stem = filename[:-4]
    return stem or None


def is_recording_expired(
    ended_at: datetime | None, retention_days: int, now: datetime
) -> bool:
    """True si un appel terminé dépasse la durée de rétention PDPL.

    Pur : sert à la purge. `ended_at` None (appel non terminé) → jamais expiré.
    `retention_days <= 0` désactive la purge (jamais expiré).
    """
    if ended_at is None or retention_days <= 0:
        return False
    return now - ended_at > timedelta(days=retention_days)


# ─────────────────────────────────────────────────────────────────────────
# Fonctions de service — toujours filtrées par company_id (Loi 1)
# ─────────────────────────────────────────────────────────────────────────


async def find_call_by_channel_id(
    db: AsyncSession, company_id: uuid.UUID, channel_id: str
) -> Call | None:
    """Retrouve un appel par son channel_id (UNIQUEID Asterisk), scoped tenant."""
    result = await db.execute(
        select(Call).where(
            Call.company_id == company_id, Call.channel_id == channel_id
        )
    )
    return result.scalar_one_or_none()


async def attach_recording(
    db: AsyncSession,
    company_id: uuid.UUID,
    call_id: uuid.UUID,
    *,
    object_key: str,
) -> service.Call | None:
    """Associe une clé objet MinIO à un appel (renseigne `recording_url`).

    Filtré tenant. Retourne l'appel mis à jour, ou ``None`` si l'appel
    n'existe pas dans ce tenant. Refuse l'association si le consentement
    d'enregistrement n'a pas été recueilli (PDPL).
    """
    call = await service.get_call(db, company_id, call_id)
    if call is None:
        return None
    if not call.recording_consent:
        raise ValueError("recording_consent_missing")
    call.recording_url = object_key
    await db.commit()
    await db.refresh(call)
    return call


async def upload_recording(
    db: AsyncSession,
    company_id: uuid.UUID,
    call_id: uuid.UUID,
    *,
    data: bytes,
    content_type: str = "audio/wav",
) -> service.Call | None:
    """Uploade le binaire d'un enregistrement vers MinIO puis l'associe au call.

    Pensé pour un worker qui lit le ``.wav`` du volume Asterisk partagé et le
    pousse côté objet. Lève ``storage.StorageError`` si MinIO est indisponible,
    ``ValueError`` si le consentement manque. Filtré tenant (Loi 1).
    """
    call = await service.get_call(db, company_id, call_id)
    if call is None:
        return None
    if not call.recording_consent:
        raise ValueError("recording_consent_missing")
    object_key = build_recording_key(company_id, call_id)
    await storage.upload_bytes(object_key, data, content_type)
    call.recording_url = object_key
    await db.commit()
    await db.refresh(call)
    return call


async def get_recording_url(
    db: AsyncSession,
    company_id: uuid.UUID,
    call_id: uuid.UUID,
    *,
    expires_seconds: int = 3600,
) -> str:
    """URL signée temporaire d'écoute d'un enregistrement.

    Vérifie successivement : existence dans le tenant (Loi 1), consentement
    PDPL, présence d'un enregistrement, disponibilité de MinIO. Lève
    ``LookupError`` / ``PermissionError`` / ``storage.StorageError`` que le
    router mappe en codes HTTP.
    """
    call = await service.get_call(db, company_id, call_id)
    if call is None:
        raise LookupError("call_not_found")
    if not call.recording_consent:
        raise PermissionError("recording_consent_missing")
    if not call.recording_url:
        raise LookupError("recording_not_found")
    url = await storage.presigned_url(call.recording_url, expires_seconds)
    if url is None:
        raise storage.StorageError("storage_unavailable")
    return url


# ─────────────────────────────────────────────────────────────────────────
# Router — à monter sur le router telephony (voir wiring_needed)
# ─────────────────────────────────────────────────────────────────────────

recording_router = APIRouter(tags=["telephony"])


def _get_company_id(request: Request) -> uuid.UUID:
    """Reprend la logique du router telephony (contexte tenant du middleware)."""
    raw = getattr(request.state, "company_id", None)
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="tenant_context_missing"
        )
    return uuid.UUID(raw)


def _require_roles(*allowed_roles: str):
    async def _check(request: Request) -> None:
        role = getattr(request.state, "role", None)
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="insufficient_permissions",
            )

    return _check


@recording_router.get(
    "/calls/{call_id}/recording",
    dependencies=[Depends(_require_roles("admin", "manager", "agent"))],
)
async def get_call_recording_endpoint(
    call_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Téléchargement sécurisé de l'enregistrement d'un appel (PDPL).

    Renvoie une URL signée MinIO à durée de vie courte plutôt que le binaire :
    on ne diffuse jamais l'audio brut via l'API. Filtré tenant (Loi 1) et
    conditionné au consentement PDPL.
    """
    company_id = _get_company_id(request)
    try:
        url = await get_recording_url(db, company_id, call_id)
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)
        ) from exc
    except storage.StorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="storage_unavailable",
        ) from exc
    return {"success": True, "data": {"url": url}}
