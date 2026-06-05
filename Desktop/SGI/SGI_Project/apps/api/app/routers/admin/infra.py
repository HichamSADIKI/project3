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

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.admin import InfraService
from app.routers.admin.deps import require_platform_admin
from app.routers.admin.prometheus import (
    PrometheusUnavailableError,
    instant_query,
)

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
