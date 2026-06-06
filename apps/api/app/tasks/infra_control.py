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
from datetime import UTC, datetime, timedelta

import httpx
from celery import shared_task
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import sync_session_maker
from app.models.admin import InfraAction, InfraRemediationRule, InfraService
from app.routers.admin.prometheus import prometheus_url

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


# ── Auto-remédiation (beat — alerte Prometheus firing → action D2) ──────────────
#
# PLATEFORME uniquement. Triple garde : AUTO_REMEDIATION_ENABLED (sinon dry-run :
# l'intention est journalisée dans infra_actions, aucune exécution), service
# `is_controllable`, et anti-rebond (pas de 2ᵉ action sur un service déjà actionné
# récemment). Reste dans le périmètre infra-admin — aucune donnée tenant.

_REMEDIATION_COOLDOWN_S = 600


def auto_remediation_enabled() -> bool:
    """Exécution réelle de l'auto-remédiation activée ? Défaut false → dry-run. Helper pur."""
    return os.getenv("AUTO_REMEDIATION_ENABLED", "false").strip().lower() == "true"


def firing_alert_names(payload: dict) -> set[str]:
    """Extrait les `alertname` des alertes Prometheus en état 'firing'. Helper PUR."""
    names: set[str] = set()
    for alert in payload.get("data", {}).get("alerts", []):
        if isinstance(alert, dict) and alert.get("state") == "firing":
            name = (alert.get("labels") or {}).get("alertname")
            if name:
                names.add(str(name))
    return names


def _fetch_firing_alert_names(timeout: float = 5.0) -> set[str]:
    """Interroge Prometheus (/api/v1/alerts) en synchrone (contexte worker). [] si indispo."""
    base = prometheus_url()
    if not base:
        return set()
    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.get(f"{base}/api/v1/alerts")
            resp.raise_for_status()
            return firing_alert_names(resp.json())
    except (httpx.HTTPError, ValueError):
        logger.warning("auto_remediate: Prometheus injoignable")
        return set()


def _recently_actioned(db: Session, service_id: uuid.UUID, since: datetime) -> bool:
    """Anti-rebond : une action existe-t-elle déjà pour ce service depuis `since` ?"""
    row = db.execute(
        select(InfraAction.id).where(
            InfraAction.service_id == service_id, InfraAction.created_at >= since
        )
    ).first()
    return row is not None


@shared_task(bind=True, max_retries=1)
def auto_remediate(self) -> dict[str, object]:  # noqa: ANN001
    """Déclenche les actions de remédiation pour les alertes Prometheus firing."""
    triggered = 0
    dry = 0
    with sync_session_maker() as db:
        rules = (
            db.execute(select(InfraRemediationRule).where(InfraRemediationRule.is_active.is_(True)))
            .scalars()
            .all()
        )
        if not rules:
            return {"status": "ok", "triggered": 0, "dry_run": 0}
        firing = _fetch_firing_alert_names()
        now = datetime.now(UTC)
        cooldown_start = now - timedelta(seconds=_REMEDIATION_COOLDOWN_S)
        enabled = auto_remediation_enabled()
        for rule in rules:
            if rule.alert_name not in firing:
                continue
            svc = db.execute(
                select(InfraService).where(InfraService.id == rule.service_id)
            ).scalar_one_or_none()
            if svc is None or not svc.is_controllable or op_for_action(rule.action) is None:
                continue
            if _recently_actioned(db, rule.service_id, cooldown_start):
                continue  # anti-rebond : on a déjà agi récemment sur ce service
            if enabled:
                action = InfraAction(
                    service_id=rule.service_id,
                    action=rule.action,
                    status="requested",
                    detail=f"auto_remediation alert={rule.alert_name}",
                )
                db.add(action)
                db.flush()
                execute_infra_action.delay(str(action.id))
                triggered += 1
            else:
                db.add(
                    InfraAction(
                        service_id=rule.service_id,
                        action=rule.action,
                        status="done",
                        detail=f"auto_remediation dry_run alert={rule.alert_name}",
                    )
                )
                dry += 1
        db.commit()
    return {"status": "ok", "triggered": triggered, "dry_run": dry}
