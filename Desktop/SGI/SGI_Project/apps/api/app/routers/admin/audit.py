"""Sous-routeur Admin · Audit applicatif & sécurité des modules (app-admin, tenant).

Périmètre A (Loi 1) : consultation des `audit_logs` de la société (filtres, recherche,
export CSV anti-injection de formule) + vue sécurité « qui accède à quoi ». Lecture seule.
Garde `require_admin` posée au niveau routeur (frozen Wave 0).

⚠️ `audit_logs` est EXEMPTÉE de la RLS automatique (pas de TenantMixin). Le filtrage
multi-tenant (Loi 1) est donc fait EXPLICITEMENT ici : chaque requête contraint
`company_id == <tenant courant>`. Ne jamais retirer ce filtre.
"""

import csv
import io
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import Select, func, or_, select
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.models.audit_log import AuditLog
from app.routers.admin.deps import require_admin

audit_router = APIRouter(prefix="/audit", tags=["admin"], dependencies=[Depends(require_admin)])


# ── Tenant ────────────────────────────────────────────────────────────────────


async def _get_company_id(db: AsyncSession) -> uuid.UUID:
    """Récupère le company_id depuis la session PostgreSQL (posé par get_db_session
    à partir du JWT). Aligné sur le router `accounting`."""
    result = await db.execute(sql_text("SELECT current_setting('app.current_company_id', true)"))
    raw = result.scalar()
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="tenant_context_missing",
        )
    return uuid.UUID(raw)


# ── Schémas ─────────────────────────────────────────────────────────────────


class AuditLogOut(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    user_id: uuid.UUID | None
    user_email: str | None
    action: str
    resource: str
    resource_id: uuid.UUID | None
    changes: dict[str, Any]
    ip_address: str | None
    user_agent: str | None
    request_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogListOut(BaseModel):
    success: bool = True
    data: list[AuditLogOut]
    meta: dict[str, Any]


# ── Construction de requête (helper pur, testé) ───────────────────────────────


def build_audit_query(
    company_id: uuid.UUID,
    *,
    action: str | None = None,
    actor: uuid.UUID | None = None,
    resource: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    q: str | None = None,
) -> Select[tuple[AuditLog]]:
    """Construit la requête SELECT filtrée et triée (desc par date).

    Loi 1 : la contrainte `company_id` est posée en PREMIER et n'est jamais
    optionnelle — `audit_logs` n'a pas de RLS automatique.
    """
    stmt = select(AuditLog).where(AuditLog.company_id == company_id)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if actor is not None:
        stmt = stmt.where(AuditLog.user_id == actor)
    if resource:
        stmt = stmt.where(AuditLog.resource == resource)
    if date_from is not None:
        stmt = stmt.where(AuditLog.created_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(AuditLog.created_at <= date_to)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                AuditLog.action.ilike(like),
                AuditLog.resource.ilike(like),
                AuditLog.user_email.ilike(like),
            )
        )
    return stmt.order_by(AuditLog.created_at.desc())


# ── Neutralisation d'injection de formule CSV (OWASP) ─────────────────────────

# Caractères qui déclenchent une formule à l'ouverture du CSV dans un tableur.
_CSV_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def csv_safe(value: object) -> str:
    """Neutralise l'injection de formule CSV : préfixe d'une apostrophe les cellules
    commençant par =/+/-/@/TAB/CR. Aligné sur l'export clients (PR #158).

    Réimplémenté localement (et non importé de `clients`) pour garder le sous-routeur
    autonome : le helper `clients._csv_safe` est privé et lié à ce module.
    """
    s = "" if value is None else str(value)
    return "'" + s if s[:1] in _CSV_FORMULA_PREFIXES else s


_EXPORT_COLUMNS = (
    "id",
    "created_at",
    "user_id",
    "user_email",
    "action",
    "resource",
    "resource_id",
    "ip_address",
    "request_id",
)


# ── Endpoints ─────────────────────────────────────────────────────────────────


@audit_router.get("/health")
async def audit_health() -> dict[str, str]:
    return {"section": "admin.audit", "status": "ok"}


@audit_router.get("", response_model=AuditLogListOut)
@audit_router.get("/", response_model=AuditLogListOut, include_in_schema=False)
async def list_audit_logs(
    action: str | None = Query(None, max_length=100),
    actor: uuid.UUID | None = Query(None, description="Filtre par user_id de l'auteur"),
    resource: str | None = Query(None, max_length=100, description="Ressource/entité ciblée"),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    q: str | None = Query(None, description="Recherche action/resource/email"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> AuditLogListOut:
    """Liste paginée des logs d'audit du tenant (lecture seule, tri desc par date)."""
    company_id = await _get_company_id(db)
    stmt = build_audit_query(
        company_id,
        action=action,
        actor=actor,
        resource=resource,
        date_from=date_from,
        date_to=date_to,
        q=q,
    )
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    offset = (page - 1) * limit
    rows = (await db.execute(stmt.offset(offset).limit(limit))).scalars().all()
    return AuditLogListOut(
        data=[AuditLogOut.model_validate(r) for r in rows],
        meta={"total": total, "page": page, "limit": limit},
    )


_EXPORT_MAX = 10000


@audit_router.get("/export.csv")
async def export_audit_csv(
    action: str | None = Query(None, max_length=100),
    actor: uuid.UUID | None = Query(None),
    resource: str | None = Query(None, max_length=100),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    q: str | None = Query(None),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    """Export CSV des logs d'audit du tenant (Loi 1 : scoping `company_id`).

    Neutralisation d'injection de formule sur toute cellule (champs `action`,
    `resource`, `user_email`… potentiellement contrôlés en amont). Synchrone
    (stdlib `csv`) — plafonné à `_EXPORT_MAX`.
    """
    company_id = await _get_company_id(db)
    stmt = build_audit_query(
        company_id,
        action=action,
        actor=actor,
        resource=resource,
        date_from=date_from,
        date_to=date_to,
        q=q,
    )
    rows = (await db.execute(stmt.limit(_EXPORT_MAX))).scalars().all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(_EXPORT_COLUMNS)
    for r in rows:
        writer.writerow([csv_safe(getattr(r, col, "")) for col in _EXPORT_COLUMNS])

    return Response(
        content=buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="audit_logs.csv"'},
    )
