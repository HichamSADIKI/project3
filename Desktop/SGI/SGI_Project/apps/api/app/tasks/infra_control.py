"""Tâches Celery — Admin Console · exécuteur de contrôle serveurs (D2, HAUT RISQUE).

Queue : **infra** (consommée par un worker DÉDIÉ — le seul à voir le
`docker-socket-proxy`). L'API publique n'exécute jamais ces actions : elle se contente
de créer un `infra_actions` (status='requested') et d'enqueuer `execute_infra_action`.

Garde-fous (défense en profondeur) :
- Whitelist d'actions EN DUR ici (`restart/stop/start/pause`) — JAMAIS `kill`/`remove`.
  Le socket-proxy ne filtre que par section (CONTAINERS+POST) ; la granularité d'action
  est imposée par CE code.
- L'action n'est exécutée que si le service est `is_controllable` ET a un `compose_service`.
- Résolution du conteneur par label `com.docker.compose.service` (robuste au préfixe projet).
- Désactivé par défaut : sans `DOCKER_PROXY_URL`, l'action échoue proprement (status='failed').
  L'activation réelle est gardée en amont par `INFRA_CONTROL_ENABLED` (routeur).
- Idempotent : ne traite que les actions encore en 'requested'.
"""

import json
import logging
import os
import uuid

import httpx
from celery import shared_task
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import sync_session_maker
from app.models.admin import InfraAction, InfraService

logger = logging.getLogger(__name__)

# Action métier → opération Docker autorisée. Source de vérité de la whitelist.
_OP_FOR_ACTION: dict[str, str] = {
    "restart": "restart",
    "stop": "stop",
    "start": "start",
    "suspend": "pause",  # Docker n'a pas 'suspend' → pause
    "pause": "pause",
}


def op_for_action(action: str) -> str | None:
    """Opération Docker pour une action métier, ou None si hors whitelist. Helper pur."""
    return _OP_FOR_ACTION.get(action)


def docker_proxy_url() -> str | None:
    """URL TCP du docker-socket-proxy (ex. http://docker-socket-proxy:2375), ou None."""
    url = os.getenv("DOCKER_PROXY_URL", "").strip()
    return url or None


def _compose_filter(compose_service: str) -> str:
    """Filtre Docker API (JSON) ciblant un service compose par label."""
    return json.dumps({"label": [f"com.docker.compose.service={compose_service}"]})


def _resolve_container_id(client: httpx.Client, base: str, compose_service: str) -> str | None:
    """Résout l'ID du conteneur d'un service compose (None si introuvable)."""
    resp = client.get(
        f"{base}/containers/json",
        params={"all": "true", "filters": _compose_filter(compose_service)},
    )
    resp.raise_for_status()
    rows = resp.json()
    if not isinstance(rows, list) or not rows:
        return None
    cid = rows[0].get("Id")
    return str(cid) if cid else None


def _finish(db: Session, action: InfraAction, status: str, detail: str) -> dict[str, object]:
    action.status = status
    action.detail = detail[:1000]
    db.commit()
    return {"status": status, "action_id": str(action.id), "detail": detail}


@shared_task(bind=True, max_retries=2)
def execute_infra_action(self, action_id: str) -> dict[str, object]:  # noqa: ANN001
    """Exécute une action de contrôle déjà enregistrée (`infra_actions`)."""
    with sync_session_maker() as db:
        action = db.execute(
            select(InfraAction).where(InfraAction.id == uuid.UUID(action_id))
        ).scalar_one_or_none()
        if action is None or action.status != "requested":
            return {"status": "skipped", "action_id": action_id}

        op = op_for_action(action.action)
        if op is None:
            return _finish(db, action, "failed", f"action_not_allowed:{action.action}")

        svc = db.execute(
            select(InfraService).where(InfraService.id == action.service_id)
        ).scalar_one_or_none()
        if svc is None or not svc.is_controllable or not svc.compose_service:
            return _finish(db, action, "failed", "service_not_controllable")

        base = docker_proxy_url()
        if not base:
            return _finish(db, action, "failed", "docker_proxy_not_configured")

        action.status = "running"
        db.commit()

        try:
            with httpx.Client(timeout=15.0) as client:
                cid = _resolve_container_id(client, base, svc.compose_service)
                if cid is None:
                    return _finish(db, action, "failed", "container_not_found")
                resp = client.post(f"{base}/containers/{cid}/{op}")
                resp.raise_for_status()
        except httpx.HTTPError as exc:
            logger.exception("execute_infra_action: échec Docker")
            return _finish(db, action, "failed", f"docker_error:{exc}")

        return _finish(db, action, "done", f"{op} ok (compose_service={svc.compose_service})")
