"""Stockage objet MinIO (S3-compatible) — documents fournisseurs/contrats.

Conception :
- Le client `minio` est synchrone (urllib3) → on l'exécute toujours via
  `run_in_threadpool` pour ne pas bloquer la boucle asyncio.
- Fail-safe : si MinIO n'est pas joignable ou pas configuré, les fonctions
  d'upload lèvent `StorageError` que l'appelant traite en best-effort
  (le compte fournisseur est créé quand même, l'admin redemande la licence).
- Le bucket est créé à la volée la première fois (idempotent).

Arborescence des clés objet :
  fournisseurs/{company_id}/{user_id}/{slug-document}-{hex}.{ext}
"""

from __future__ import annotations

import logging
import uuid
from io import BytesIO

from fastapi.concurrency import run_in_threadpool

from app.core.config import settings

logger = logging.getLogger(__name__)


class StorageError(RuntimeError):
    """Levée quand MinIO est indisponible ou mal configuré."""


# Extensions acceptées pour une licence commerciale (PDF ou image scannée).
_EXT_BY_MIME = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


def is_configured() -> bool:
    """True si les credentials MinIO sont renseignés (sinon on skippe l'upload)."""
    return bool(settings.MINIO_ENDPOINT and settings.MINIO_ACCESS_KEY and settings.MINIO_SECRET_KEY)


def extension_for_mime(content_type: str) -> str | None:
    """Extension de fichier pour un MIME licence, ou None si non supporté."""
    return _EXT_BY_MIME.get((content_type or "").split(";")[0].strip().lower())


def _client(endpoint: str | None = None):  # type: ignore[no-untyped-def]
    """Instancie un client MinIO. Import paresseux pour ne pas exiger la lib
    en environnement de test sans MinIO.

    `endpoint` permet de signer des URLs présignées contre l'hôte PUBLIC
    (joignable par le navigateur) plutôt que l'endpoint interne Docker.
    """
    try:
        from minio import Minio
    except ImportError as exc:  # pragma: no cover - dépendance déclarée
        raise StorageError("minio_library_missing") from exc

    ep = endpoint or settings.MINIO_ENDPOINT
    secure = ep.startswith("https://")
    ep = ep.replace("https://", "").replace("http://", "")
    return Minio(
        ep,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=secure,
        # Région fixée → la présignature contre l'endpoint PUBLIC ne déclenche
        # PAS d'appel de découverte de région (sinon le worker tenterait de
        # joindre localhost:9000, injoignable depuis le conteneur).
        region="us-east-1",
    )


def _put_sync(object_key: str, data: bytes, content_type: str) -> str:
    client = _client()
    bucket = settings.MINIO_BUCKET
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)
    client.put_object(
        bucket,
        object_key,
        BytesIO(data),
        length=len(data),
        content_type=content_type or "application/octet-stream",
    )
    return object_key


def _presigned_sync(object_key: str, expires_seconds: int) -> str:
    from datetime import timedelta

    # Signer contre l'endpoint PUBLIC si défini (URL consultée par le navigateur).
    client = _client(settings.MINIO_PUBLIC_ENDPOINT or None)
    return client.presigned_get_object(
        settings.MINIO_BUCKET,
        object_key,
        expires=timedelta(seconds=expires_seconds),
    )


def build_fournisseur_license_key(
    company_id: uuid.UUID, user_id: uuid.UUID, content_type: str
) -> str:
    """Clé objet déterministe-par-tenant pour une licence commerciale."""
    ext = extension_for_mime(content_type) or "bin"
    return f"fournisseurs/{company_id}/{user_id}/licence-commerciale-{uuid.uuid4().hex[:12]}.{ext}"


def download_bytes(object_key: str) -> tuple[bytes, str]:
    """Télécharge un objet MinIO et retourne (bytes, content_type).

    Synchrone — à appeler depuis un thread Celery (via sync_session_maker).
    Lève StorageError si indisponible.
    """
    if not is_configured():
        raise StorageError("minio_not_configured")
    try:
        client = _client()
        response = client.get_object(settings.MINIO_BUCKET, object_key)
        data = response.read()
        content_type = response.headers.get("Content-Type", "application/octet-stream")
        response.close()
        return data, content_type
    except Exception as exc:  # noqa: BLE001
        raise StorageError(f"minio_download_failed: {exc}") from exc


async def upload_bytes(object_key: str, data: bytes, content_type: str) -> str:
    """Uploade un blob et retourne sa clé objet. Lève StorageError si KO."""
    if not is_configured():
        raise StorageError("minio_not_configured")
    try:
        return await run_in_threadpool(_put_sync, object_key, data, content_type)
    except StorageError:
        raise
    except Exception as exc:  # noqa: BLE001 — toute erreur réseau/minio
        logger.warning("MinIO upload échoué (%s): %s", object_key, exc)
        raise StorageError("minio_upload_failed") from exc


async def presigned_url(object_key: str, expires_seconds: int = 3600) -> str | None:
    """URL signée temporaire pour consulter un objet. None si indisponible."""
    if not object_key or not is_configured():
        return None
    try:
        return await run_in_threadpool(_presigned_sync, object_key, expires_seconds)
    except Exception as exc:  # noqa: BLE001
        logger.warning("MinIO presign échoué (%s): %s", object_key, exc)
        return None


def _delete_sync(object_key: str) -> None:
    client = _client()
    client.remove_object(settings.MINIO_BUCKET, object_key)


def delete_object_sync(object_key: str) -> bool:
    """Supprime un objet MinIO (synchrone — pour les tâches Celery, ex. purge
    de rétention PDPL). Retourne True si supprimé, False si indisponible/échec."""
    if not object_key or not is_configured():
        return False
    try:
        _delete_sync(object_key)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("MinIO delete échoué (%s): %s", object_key, exc)
        return False
