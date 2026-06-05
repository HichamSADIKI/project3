"""Sous-routeur Admin · Supervision des sauvegardes (infra-admin, PLATEFORME).

Périmètre B (HORS Loi 1) : état des sauvegardes (`backup_runs`) — DB PostgreSQL &
stockage MinIO : statut/âge/taille, dernier succès, alerte si échec. Lecture seule
en Phase 1 (le déclenchement et la restauration sont Phase 3). Garde
`require_platform_admin` au niveau routeur (frozen Wave 0).

Utilise `get_db` (PAS `get_db_session` : périmètre cross-tenant — `backup_runs` n'a
pas de `company_id`, pas de RLS).
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
from app.models.admin import BackupRun
from app.routers.admin.deps import require_platform_admin
from app.tasks.backups import run_backup

backups_router = APIRouter(
    prefix="/platform/backups",
    tags=["admin-platform"],
    dependencies=[Depends(require_platform_admin)],
)

# Au-delà de ce seuil sans succès, la cible est considérée « non saine ».
_STALE_AFTER_HOURS = 36.0
_TARGETS = ("db", "minio")


# ── Schémas Pydantic v2 ───────────────────────────────────────────────────────


class BackupRunOut(BaseModel):
    id: uuid.UUID
    target: str
    kind: str
    status: str
    size_bytes: int | None
    location: str | None
    error: str | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class BackupListOut(BaseModel):
    success: bool = True
    data: list[BackupRunOut]
    meta: dict[str, Any]


class BackupTargetSummary(BaseModel):
    target: str
    last_status: str | None = None
    last_run_at: datetime | None = None
    age_hours: float | None = None
    size_bytes: int | None = None
    healthy: bool = False


class BackupSummaryOut(BaseModel):
    success: bool = True
    data: list[BackupTargetSummary]


# ── Helpers (purs / testables) ────────────────────────────────────────────────


def _age_hours(ref: datetime | None, *, now: datetime) -> float | None:
    """Âge en heures d'un horodatage (timezone-aware). None si absent."""
    if ref is None:
        return None
    if ref.tzinfo is None:
        ref = ref.replace(tzinfo=UTC)
    return (now - ref).total_seconds() / 3600.0


def _is_healthy(status: str | None, age_hours: float | None) -> bool:
    """Cible saine = dernier run en succès ET daté de moins de `_STALE_AFTER_HOURS`."""
    if status != "success" or age_hours is None:
        return False
    return age_hours <= _STALE_AFTER_HOURS


def backup_trigger_enabled() -> bool:
    """Exécution réelle du déclenchement activée ? Défaut false → dry-run. Helper pur."""
    return os.getenv("BACKUP_TRIGGER_ENABLED", "false").strip().lower() == "true"


class BackupTriggerRequest(BaseModel):
    # Phase 3 : seul 'db' (pg_dump) est déclenchable pour l'instant.
    target: Literal["db"]
    # Double confirmation : doit valoir exactement le nom de la cible.
    confirmation: str


class BackupTriggerOut(BaseModel):
    success: bool = True
    data: BackupRunOut


# ── Endpoints ─────────────────────────────────────────────────────────────────


@backups_router.get("/health")
async def backups_health() -> dict[str, str]:
    return {"section": "admin.platform.backups", "status": "ok"}


@backups_router.post(
    "/trigger",
    response_model=BackupTriggerOut,
    status_code=status.HTTP_201_CREATED,
)
async def trigger_backup(
    body: BackupTriggerRequest,
    db: AsyncSession = Depends(get_db),
) -> BackupTriggerOut:
    """Déclenche une sauvegarde (NON destructif). Double confirmation = nom de la cible.

    Flag OFF (dry-run) : `backup_run` journalisé `status='success'`, detail='dry_run',
    aucune exécution. Flag ON : `status='running'` + délégation au worker (`run_backup`)
    qui lance pg_dump. La restauration (destructive) reste hors scope.
    """
    if body.confirmation != body.target:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="confirmation_mismatch")

    if backup_trigger_enabled():
        run = BackupRun(target=body.target, kind="manual", status="running")
        db.add(run)
        await db.commit()
        await db.refresh(run)
        run_backup.delay(str(run.id))  # délégation worker — l'API ne lance pas pg_dump
        return BackupTriggerOut(data=BackupRunOut.model_validate(run))

    run = BackupRun(
        target=body.target,
        kind="manual",
        status="success",
        location="dry_run (BACKUP_TRIGGER_ENABLED=false)",
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return BackupTriggerOut(data=BackupRunOut.model_validate(run))


@backups_router.get("/summary", response_model=BackupSummaryOut)
async def backups_summary_endpoint(
    db: AsyncSession = Depends(get_db),
) -> BackupSummaryOut:
    """Résumé par cible (db / minio) : dernier run, âge, taille, santé.

    Cross-tenant (PLATEFORME). `healthy=false` si le dernier run a échoué, est
    absent, ou date de plus de `_STALE_AFTER_HOURS` heures.
    """
    now = datetime.now(UTC)
    summaries: list[BackupTargetSummary] = []
    for target in _TARGETS:
        stmt = (
            select(BackupRun)
            .where(BackupRun.target == target)
            .order_by(BackupRun.created_at.desc())
            .limit(1)
        )
        last = (await db.execute(stmt)).scalar_one_or_none()
        if last is None:
            summaries.append(BackupTargetSummary(target=target))
            continue
        ref = last.finished_at or last.created_at
        age = _age_hours(ref, now=now)
        summaries.append(
            BackupTargetSummary(
                target=target,
                last_status=last.status,
                last_run_at=ref,
                age_hours=age,
                size_bytes=last.size_bytes,
                healthy=_is_healthy(last.status, age),
            )
        )
    return BackupSummaryOut(data=summaries)


@backups_router.get("", response_model=BackupListOut)
@backups_router.get("/", response_model=BackupListOut, include_in_schema=False)
async def list_backups_endpoint(
    target: str | None = Query(None, pattern="^(db|minio)$"),
    status_filter: str | None = Query(None, alias="status", pattern="^(running|success|failed)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> BackupListOut:
    """Liste paginée des exécutions de sauvegarde (tri desc created_at)."""
    base = select(BackupRun)
    if target:
        base = base.where(BackupRun.target == target)
    if status_filter:
        base = base.where(BackupRun.status == status_filter)

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    offset = (page - 1) * limit
    rows = (
        (await db.execute(base.order_by(BackupRun.created_at.desc()).offset(offset).limit(limit)))
        .scalars()
        .all()
    )
    return BackupListOut(
        data=[BackupRunOut.model_validate(r) for r in rows],
        meta={"total": total, "page": page, "limit": limit},
    )
