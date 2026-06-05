"""Sous-routeur Admin · Serveurs & réseau (infra-admin, PLATEFORME cross-tenant).

Périmètre B (HORS Loi 1) : état des serveurs/services (`infra_services`) + métriques
réseau (bande passante rx/tx, connexions actives) interrogées en direct sur
**Prometheus** (cf. `app.routers.admin.prometheus`). Lecture seule en Phase 1 (le
contrôle réel start/stop est Phase 3). Garde `require_platform_admin` au niveau
routeur (frozen Wave 0) → JAMAIS exposé sans le drapeau super-admin.

Utilise `get_db` (PAS `get_db_session` : périmètre cross-tenant volontaire — pas de
GUC tenant, pas de RLS sur ces tables). Dégradation propre si Prometheus injoignable :
`PrometheusUnavailableError` est rattrapée et traduite en réponse `available=false`
+ `live_state=null` (JAMAIS un 500), pour que la console reste utilisable hors prod.
"""

from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.admin import InfraAction, InfraService
from app.routers.admin.deps import require_platform_admin
from app.routers.admin.prometheus import (
    PrometheusUnavailableError,
    active_alerts,
    instant_query,
    range_query,
)
from app.tasks.infra_control import execute_infra_action

infra_router = APIRouter(
    prefix="/platform",
    tags=["admin-platform"],
    dependencies=[Depends(require_platform_admin)],
)


# ── Schémas Pydantic v2 ───────────────────────────────────────────────────────


class InfraServiceOut(BaseModel):
    """Service supervisé + son état live Prometheus (null si Prometheus indispo)."""

    id: uuid.UUID
    name: str
    kind: str
    description: str | None
    last_known_state: str | None
    last_checked_at: datetime | None
    is_controllable: bool
    # État live calculé à la volée (pas en base) : "up" | "down" | None.
    live_state: str | None = None

    model_config = {"from_attributes": True}


class ServerListOut(BaseModel):
    success: bool = True
    data: list[InfraServiceOut]
    meta: dict[str, Any]


class NetworkMetrics(BaseModel):
    """Métriques réseau instantanées (octets/s et connexions). None si indispo."""

    rx_bytes_per_sec: float | None = None
    tx_bytes_per_sec: float | None = None
    active_connections: float | None = None


class NetworkOut(BaseModel):
    success: bool = True
    data: NetworkMetrics
    meta: dict[str, Any]


# ── Helpers (purs / testables) ────────────────────────────────────────────────


def _availability_expr(service_name: str) -> str:
    """PromQL d'instantané de disponibilité d'un service (vecteur `up`).

    Retourne une expression filtrée par label `job`. Helper pur (pas d'I/O) pour
    rester testable sans Prometheus.
    """
    safe = service_name.replace('"', "")
    return f'up{{job="{safe}"}}'


def _live_state_from_value(value: float | None) -> str | None:
    """Traduit la valeur scalaire `up` (1.0/0.0/None) en état lisible."""
    if value is None:
        return None
    return "up" if value >= 1.0 else "down"


# ── Endpoints ─────────────────────────────────────────────────────────────────


@infra_router.get("/health")
async def infra_health() -> dict[str, str]:
    return {"section": "admin.platform.infra", "status": "ok"}


@infra_router.get("/servers", response_model=ServerListOut)
async def list_servers_endpoint(
    db: AsyncSession = Depends(get_db),
) -> ServerListOut:
    """Liste les services supervisés (`infra_services`) + état live Prometheus.

    Cross-tenant (périmètre PLATEFORME) : pas de filtre `company_id` — ces tables
    n'en ont pas. Pour chaque service, tente un `instant_query` de disponibilité.
    Si Prometheus est indisponible, on rattrape `PrometheusUnavailableError` UNE
    seule fois (inutile de retenter par service) : tous les `live_state` restent
    `null` et `meta.prometheus_available` passe à `false`. Jamais de 500.
    """
    stmt = select(InfraService).where(InfraService.deleted_at.is_(None)).order_by(InfraService.name)
    services = (await db.execute(stmt)).scalars().all()

    prometheus_available = True
    data: list[InfraServiceOut] = []
    for svc in services:
        out = InfraServiceOut.model_validate(svc)
        if prometheus_available:
            try:
                value = await instant_query(_availability_expr(svc.name))
            except PrometheusUnavailableError:
                # Dégradation : on cesse d'interroger Prometheus pour ce batch.
                prometheus_available = False
            else:
                out.live_state = _live_state_from_value(value)
        data.append(out)

    return ServerListOut(
        data=data,
        meta={"total": len(data), "prometheus_available": prometheus_available},
    )


@infra_router.get("/network", response_model=NetworkOut)
async def network_metrics_endpoint(
    db: AsyncSession = Depends(get_db),
) -> NetworkOut:
    """Métriques réseau instantanées via Prometheus (bande passante + connexions).

    Cross-tenant (périmètre PLATEFORME). Si Prometheus est injoignable, on rattrape
    `PrometheusUnavailableError` et renvoie `data` à `null`/`null` avec
    `meta.available=false` (PAS un 500). `db` est injectée pour homogénéité de la
    frontière (et usages futurs Phase 3) même si la Phase 1 ne lit que Prometheus.
    """
    try:
        rx = await instant_query("sum(rate(node_network_receive_bytes_total[5m]))")
        tx = await instant_query("sum(rate(node_network_transmit_bytes_total[5m]))")
        conns = await instant_query("sum(node_netstat_Tcp_CurrEstab)")
    except PrometheusUnavailableError:
        return NetworkOut(data=NetworkMetrics(), meta={"available": False})

    return NetworkOut(
        data=NetworkMetrics(
            rx_bytes_per_sec=rx,
            tx_bytes_per_sec=tx,
            active_connections=conns,
        ),
        meta={"available": True},
    )


# ── Alertes infra Prometheus (définies dans prometheus/alerts.yml) ──────────────


class PrometheusAlertOut(BaseModel):
    """Alerte infra remontée par Prometheus (lecture seule, B2)."""

    name: str
    severity: str | None = None
    state: str | None = None  # firing | pending
    summary: str | None = None
    active_at: str | None = None


class AlertsOut(BaseModel):
    success: bool = True
    data: list[PrometheusAlertOut]
    meta: dict[str, Any]


def map_prometheus_alert(raw: dict[str, Any]) -> PrometheusAlertOut:
    """Mappe une alerte brute Prometheus vers la forme compacte. Helper PUR (testable)."""
    labels = raw.get("labels") or {}
    annotations = raw.get("annotations") or {}
    return PrometheusAlertOut(
        name=labels.get("alertname") or "unknown",
        severity=labels.get("severity"),
        state=raw.get("state"),
        summary=annotations.get("summary") or annotations.get("description"),
        active_at=raw.get("activeAt"),
    )


@infra_router.get("/alerts", response_model=AlertsOut)
async def list_infra_alerts(
    db: AsyncSession = Depends(get_db),
) -> AlertsOut:
    """Alertes infra actives remontées par Prometheus (cf. prometheus/alerts.yml).

    Cross-tenant (PLATEFORME). Lecture seule : on ne stocke rien, on relaie l'état
    courant de Prometheus. Dégradation propre si Prometheus injoignable → liste vide
    + `meta.available=false` (jamais un 500). `db` injectée pour homogénéité de la garde.
    """
    try:
        raw_alerts = await active_alerts()
    except PrometheusUnavailableError:
        return AlertsOut(data=[], meta={"available": False, "total": 0})
    data = [map_prometheus_alert(a) for a in raw_alerts]
    # Tri : firing avant pending, puis par sévérité critique d'abord.
    _sev_rank = {"critical": 0, "warning": 1, "info": 2}
    data.sort(key=lambda a: (a.state != "firing", _sev_rank.get(a.severity or "", 9)))
    return AlertsOut(data=data, meta={"available": True, "total": len(data)})


# ── Contrôle des serveurs (D1 — dry-run derrière un flag) ───────────────────────
#
# ⚠️ SÉCURITÉ : en Phase 1/D1 l'exécution est SIMULÉE — aucun accès Docker. Le flag
# `INFRA_CONTROL_ENABLED` est le seul point d'activation de l'exécution réelle (D2),
# qui passera par un exécuteur à privilège minimal (jamais docker.sock dans cette API).
# Garde-fous déjà en place ici : allowlist (`is_controllable`), double confirmation
# (saisie du nom du service), journalisation `infra_actions` + acteur, audit middleware.

ActionLiteral = Literal["start", "stop", "restart", "suspend"]


def control_enabled() -> bool:
    """Exécution réelle activée ? (D2). Défaut false → dry-run. Helper pur (testable)."""
    return os.getenv("INFRA_CONTROL_ENABLED", "false").strip().lower() == "true"


class ActionRequest(BaseModel):
    action: ActionLiteral
    # Double confirmation : doit être EXACTEMENT le nom du service ciblé.
    confirmation: str


class InfraActionOut(BaseModel):
    id: uuid.UUID
    service_id: uuid.UUID
    action: str
    requested_by: uuid.UUID | None
    status: str
    detail: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class InfraActionDetailOut(BaseModel):
    success: bool = True
    data: InfraActionOut


class InfraActionListOut(BaseModel):
    success: bool = True
    data: list[InfraActionOut]
    meta: dict[str, Any]


@infra_router.post(
    "/servers/{service_id}/actions",
    response_model=InfraActionDetailOut,
    status_code=status.HTTP_201_CREATED,
)
async def request_server_action(
    service_id: uuid.UUID,
    body: ActionRequest,
    actor: uuid.UUID = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
) -> InfraActionDetailOut:
    """Demande une action de contrôle sur un service (start/stop/restart/suspend).

    Garde-fous : service existant + `is_controllable` (allowlist), double confirmation
    (`confirmation` == nom du service). L'API n'exécute JAMAIS l'action elle-même :
    - flag OFF (dry-run) : action JOURNALISÉE `status='done'`, detail='dry_run'.
    - flag ON (D2) : action `status='requested'` puis DÉLÉGUÉE au worker dédié
      `app.tasks.infra_control.execute_infra_action` (queue `infra`, seul à voir le
      docker-socket-proxy). Le worker la fait transiter en running→done/failed.
    """
    svc = (
        await db.execute(
            select(InfraService).where(
                InfraService.id == service_id, InfraService.deleted_at.is_(None)
            )
        )
    ).scalar_one_or_none()
    if svc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="service_not_found")
    if not svc.is_controllable:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="service_not_controllable")
    if body.confirmation != svc.name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="confirmation_mismatch")

    if control_enabled():
        action = InfraAction(
            service_id=svc.id, action=body.action, requested_by=actor, status="requested"
        )
        db.add(action)
        await db.commit()
        await db.refresh(action)
        # Délégation au worker isolé — l'API ne touche jamais Docker.
        execute_infra_action.delay(str(action.id))
        return InfraActionDetailOut(data=InfraActionOut.model_validate(action))

    # Dry-run (flag off) : action journalisée, aucune exécution.
    action = InfraAction(
        service_id=svc.id,
        action=body.action,
        requested_by=actor,
        status="done",
        detail="dry_run (INFRA_CONTROL_ENABLED=false)",
    )
    db.add(action)
    await db.commit()
    await db.refresh(action)
    return InfraActionDetailOut(data=InfraActionOut.model_validate(action))


@infra_router.get("/actions", response_model=InfraActionListOut)
async def list_actions(
    service_id: uuid.UUID | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> InfraActionListOut:
    """Historique des actions de contrôle (cross-tenant plateforme, tri desc)."""
    base = select(InfraAction)
    if service_id is not None:
        base = base.where(InfraAction.service_id == service_id)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    offset = (page - 1) * limit
    rows = (
        (await db.execute(base.order_by(InfraAction.created_at.desc()).offset(offset).limit(limit)))
        .scalars()
        .all()
    )
    return InfraActionListOut(
        data=[InfraActionOut.model_validate(a) for a in rows],
        meta={"total": total, "page": page, "limit": limit},
    )


# ── Prédiction de tendance (B3 — projection linéaire sur Prometheus) ────────────

# Métriques projetées : (clé, label, PromQL, seuil, unité).
_TREND_METRICS: tuple[tuple[str, str, str, float, str], ...] = (
    (
        "disk",
        "Disque /",
        '100 * (1 - sum(node_filesystem_avail_bytes{fstype!="tmpfs"}) '
        '/ sum(node_filesystem_size_bytes{fstype!="tmpfs"}))',
        90.0,
        "%",
    ),
    (
        "memory",
        "Mémoire",
        "100 * (1 - sum(node_memory_MemAvailable_bytes) / sum(node_memory_MemTotal_bytes))",
        90.0,
        "%",
    ),
)
_TREND_WINDOW_SECONDS = 6 * 3600
_TREND_STEP_SECONDS = 300.0


def project_seconds_to_threshold(
    points: list[tuple[float, float]], threshold: float
) -> float | None:
    """Secondes avant d'atteindre `threshold` par régression linéaire (helper PUR).

    None si < 2 points, pente <= 0 (pas de tendance haussière), déjà au-dessus du
    seuil, ou croisement dans le passé. Moindres carrés sur (ts, valeur).
    """
    if len(points) < 2:
        return None
    n = len(points)
    sx = sum(ts for ts, _ in points)
    sy = sum(v for _, v in points)
    sxx = sum(ts * ts for ts, _ in points)
    sxy = sum(ts * v for ts, v in points)
    denom = n * sxx - sx * sx
    if denom == 0:
        return None
    slope = (n * sxy - sx * sy) * 1.0 / denom
    intercept = (sy - slope * sx) / n
    if slope <= 0:
        return None
    last_ts, last_val = points[-1]
    if last_val >= threshold:
        return None
    cross_ts = (threshold - intercept) / slope
    eta = cross_ts - last_ts
    return eta if eta > 0 else None


class TrendItem(BaseModel):
    key: str
    label: str
    unit: str
    current: float | None = None
    threshold: float
    eta_seconds: float | None = None  # None = pas de tendance vers le seuil
    trending: bool = False


class TrendOut(BaseModel):
    success: bool = True
    data: list[TrendItem]
    meta: dict[str, Any]


@infra_router.get("/trend", response_model=TrendOut)
async def trend_endpoint(
    db: AsyncSession = Depends(get_db),
) -> TrendOut:
    """Projection de tendance des ressources (« seuil atteint dans ~X »).

    Cross-tenant (PLATEFORME). Lecture seule : range-queries Prometheus + projection
    linéaire pure. Dégradation propre si Prometheus injoignable → data vide +
    `meta.available=false` (jamais 500). `db` injectée pour homogénéité de la garde.
    """
    now = datetime.now(UTC).timestamp()
    start = now - _TREND_WINDOW_SECONDS
    items: list[TrendItem] = []
    try:
        for key, label, expr, threshold, unit in _TREND_METRICS:
            points = await range_query(expr, start=start, end=now, step=_TREND_STEP_SECONDS)
            current = points[-1][1] if points else None
            eta = project_seconds_to_threshold(points, threshold)
            items.append(
                TrendItem(
                    key=key,
                    label=label,
                    unit=unit,
                    current=current,
                    threshold=threshold,
                    eta_seconds=eta,
                    trending=eta is not None,
                )
            )
    except PrometheusUnavailableError:
        return TrendOut(data=[], meta={"available": False})
    return TrendOut(data=items, meta={"available": True})
