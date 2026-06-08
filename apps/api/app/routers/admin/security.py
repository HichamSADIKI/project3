"""Sous-routeur Admin · Superviseur de sécurité GLOBAL (infra-admin, PLATEFORME).

Périmètre B (HORS Loi 1) : dashboard **read-only** qui agrège les signaux sécu de TOUTE
la plateforme. Garde `require_platform_admin` au niveau routeur. Utilise `get_db`
(cross-tenant volontaire — pas de contexte tenant).

Backbone = **`audit_logs`** (table SANS RLS, exemptée Loi 1 comme `companies`/`users`) où
atterrissent déjà la plupart des événements sécu (`self_defense:*`, `honeytoken:access`,
`studio:*`) → comptage cross-tenant propre. + tables **Studio** (plateforme) pour la
gouvernance. La presence live (tenant-RLS) est hors v1 ; ses signaux passent par l'audit.

Lecture seule : aucune écriture, aucune action, aucune donnée tenant RLS contournée.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.audit_log import AuditLog
from app.models.studio import StudioIntegrationRequest, StudioModule, StudioOrchestratorJob
from app.routers.admin.deps import require_platform_admin

security_router = APIRouter(
    prefix="/platform/security",
    tags=["admin-platform"],
    dependencies=[Depends(require_platform_admin)],
)

# Préfixes d'action d'audit considérés comme « événements sécu » + libellé du bucket.
_SECURITY_PREFIXES: tuple[tuple[str, str], ...] = (
    ("self_defense:", "Self-Defense"),
    ("honeytoken:", "Honeytokens"),
    ("studio:", "Studio"),
)

_RECENT_LIMIT = 25


# ── Helpers PURS (testables sans DB) ────────────────────────────────────────────


def prefix_of(action: str, prefixes: tuple[tuple[str, str], ...]) -> str | None:
    """Préfixe sécu correspondant à une action d'audit, ou None. Helper PUR."""
    for prefix, _label in prefixes:
        if action.startswith(prefix):
            return prefix
    return None


def aggregate_by_prefix(
    rows: list[tuple[str, int, int]], prefixes: tuple[tuple[str, str], ...]
) -> list[dict[str, Any]]:
    """Regroupe des lignes (action, count_24h, count_7d) en buckets par préfixe. PUR.

    Renvoie un bucket par préfixe (dans l'ordre déclaré), même à zéro.
    """
    labels = dict(prefixes)
    sums: dict[str, list[int]] = {p: [0, 0] for p, _ in prefixes}
    for action, c24, c7 in rows:
        p = prefix_of(action, prefixes)
        if p is not None:
            sums[p][0] += c24
            sums[p][1] += c7
    return [
        {"prefix": p, "label": labels[p], "count_24h": sums[p][0], "count_7d": sums[p][1]}
        for p, _ in prefixes
    ]


# ── Schémas Pydantic v2 ─────────────────────────────────────────────────────────


class EventBucket(BaseModel):
    prefix: str
    label: str
    count_24h: int
    count_7d: int


class RecentEvent(BaseModel):
    action: str
    resource: str
    user_email: str | None
    company_id: uuid.UUID | None
    ip_address: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class StudioGovernance(BaseModel):
    integration_pending: int
    integration_expired: int
    jobs_failed: int
    jobs_running: int
    modules_total: int
    modules_by_state: dict[str, int]


class SecurityOverview(BaseModel):
    events: list[EventBucket]
    recent: list[RecentEvent]
    studio: StudioGovernance
    window: dict[str, str]


class OverviewOut(BaseModel):
    success: bool = True
    data: SecurityOverview


# ── Endpoint ─────────────────────────────────────────────────────────────────────


@security_router.get("/overview", response_model=OverviewOut)
async def security_overview(db: AsyncSession = Depends(get_db)) -> OverviewOut:
    """Vue d'ensemble sécurité plateforme (lecture seule, cross-tenant via audit_logs)."""
    now = datetime.now(UTC)
    h24 = now - timedelta(hours=24)
    d7 = now - timedelta(days=7)
    sec_filter = or_(*[AuditLog.action.like(f"{p}%") for p, _ in _SECURITY_PREFIXES])

    # Compteurs par action sur 7 j, avec sous-compte 24 h (FILTER Postgres).
    count_rows = (
        await db.execute(
            select(
                AuditLog.action,
                func.count().label("c7"),
                func.count().filter(AuditLog.created_at >= h24).label("c24"),
            )
            .where(AuditLog.created_at >= d7, sec_filter)
            .group_by(AuditLog.action)
        )
    ).all()
    buckets = aggregate_by_prefix(
        [(r.action, int(r.c24), int(r.c7)) for r in count_rows], _SECURITY_PREFIXES
    )

    recent_rows = (
        (
            await db.execute(
                select(AuditLog)
                .where(AuditLog.created_at >= d7, sec_filter)
                .order_by(AuditLog.created_at.desc())
                .limit(_RECENT_LIMIT)
            )
        )
        .scalars()
        .all()
    )

    # ── Gouvernance Studio (tables plateforme, sans RLS) ──
    integration_pending = (
        await db.execute(
            select(func.count())
            .select_from(StudioIntegrationRequest)
            .where(
                StudioIntegrationRequest.status == "pending",
                StudioIntegrationRequest.expires_at > now,
            )
        )
    ).scalar_one()
    integration_expired = (
        await db.execute(
            select(func.count())
            .select_from(StudioIntegrationRequest)
            .where(
                StudioIntegrationRequest.status == "pending",
                StudioIntegrationRequest.expires_at <= now,
            )
        )
    ).scalar_one()
    jobs_failed = (
        await db.execute(
            select(func.count())
            .select_from(StudioOrchestratorJob)
            .where(StudioOrchestratorJob.status == "failed")
        )
    ).scalar_one()
    jobs_running = (
        await db.execute(
            select(func.count())
            .select_from(StudioOrchestratorJob)
            .where(StudioOrchestratorJob.status == "running")
        )
    ).scalar_one()
    modules_total = (
        await db.execute(
            select(func.count()).select_from(StudioModule).where(StudioModule.deleted_at.is_(None))
        )
    ).scalar_one()
    state_rows = (
        await db.execute(
            select(StudioModule.state, func.count())
            .where(StudioModule.deleted_at.is_(None))
            .group_by(StudioModule.state)
        )
    ).all()

    return OverviewOut(
        data=SecurityOverview(
            events=[EventBucket(**b) for b in buckets],
            recent=[RecentEvent.model_validate(r) for r in recent_rows],
            studio=StudioGovernance(
                integration_pending=int(integration_pending),
                integration_expired=int(integration_expired),
                jobs_failed=int(jobs_failed),
                jobs_running=int(jobs_running),
                modules_total=int(modules_total),
                modules_by_state={state: int(c) for state, c in state_rows},
            ),
            window={"from_24h": h24.isoformat(), "from_7d": d7.isoformat()},
        )
    )
