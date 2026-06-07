"""Sous-routeur Admin · Alertes applicatives & sécurité (app-admin, tenant, Loi 1).

Périmètre A (Loi 1) : règles de seuil PAR société (`admin_alert_rules`) + console des
alertes déclenchées (`admin_alert_events`, machine à états open→acked→resolved). Les
règles sont ÉVALUÉES par la tâche Celery `app.tasks.alerts.evaluate_alert_rules` (beat) :
ici on ne fait que le CRUD + le pilotage des événements. Garde `require_admin` au niveau
routeur (frozen), écritures sensibles sous `require_admin_write`.

Métriques calculables (depuis `audit_logs`, par tenant/fenêtre) — un pic = anomalie :
- `audit_events`   : volume total d'événements d'audit.
- `distinct_ips`   : nb d'IP distinctes (détection d'accès dispersés/compromis).
- `auth_events`    : événements d'authentification (resource='auth').
- `delete_actions` : suppressions (action commençant par 'delete').
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.models.admin import AlertEvent, AlertRule
from app.routers.admin.deps import require_admin, require_admin_write

alerts_router = APIRouter(prefix="/alerts", tags=["admin"], dependencies=[Depends(require_admin)])

# Métriques supportées (calculées sur audit_logs par la tâche Celery). Partagé avec
# `app.tasks.alerts` qui importe cette constante — source unique de vérité.
KNOWN_METRICS: tuple[str, ...] = ("audit_events", "distinct_ips", "auth_events", "delete_actions")

MetricLiteral = Literal["audit_events", "distinct_ips", "auth_events", "delete_actions"]
ComparatorLiteral = Literal["gt", "lt", "gte", "lte"]
SeverityLiteral = Literal["info", "warning", "critical"]


# ── Helpers purs (testables, sans DB) ─────────────────────────────────────────


def evaluate_comparator(value: float, comparator: str, threshold: float) -> bool:
    """Vrai si `value <comparator> threshold`. Comparateur inconnu → False (fail-safe)."""
    if comparator == "gt":
        return value > threshold
    if comparator == "lt":
        return value < threshold
    if comparator == "gte":
        return value >= threshold
    if comparator == "lte":
        return value <= threshold
    return False


def can_transition(current: str, target: str) -> bool:
    """Machine à états des événements : open→acked, open|acked→resolved."""
    if target == "acked":
        return current == "open"
    if target == "resolved":
        return current in ("open", "acked")
    return False


# ── Schémas Pydantic v2 ───────────────────────────────────────────────────────


class AlertRuleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    metric: MetricLiteral
    comparator: ComparatorLiteral
    threshold: Decimal = Field(ge=0)
    window_seconds: int = Field(default=300, ge=30, le=86400)
    severity: SeverityLiteral = "warning"
    channel: str | None = Field(default=None, max_length=40)
    is_active: bool = True


class AlertRuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    metric: MetricLiteral | None = None
    comparator: ComparatorLiteral | None = None
    threshold: Decimal | None = Field(default=None, ge=0)
    window_seconds: int | None = Field(default=None, ge=30, le=86400)
    severity: SeverityLiteral | None = None
    channel: str | None = Field(default=None, max_length=40)
    is_active: bool | None = None


class AlertRuleOut(BaseModel):
    id: uuid.UUID
    name: str
    metric: str
    comparator: str
    threshold: Decimal
    window_seconds: int
    severity: str
    channel: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertRuleListOut(BaseModel):
    success: bool = True
    data: list[AlertRuleOut]
    meta: dict[str, Any]


class AlertRuleDetailOut(BaseModel):
    success: bool = True
    data: AlertRuleOut


class AlertEventOut(BaseModel):
    id: uuid.UUID
    rule_id: uuid.UUID
    observed_value: Decimal | None
    status: str
    acked_by: uuid.UUID | None
    acked_at: datetime | None
    resolved_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertEventListOut(BaseModel):
    success: bool = True
    data: list[AlertEventOut]
    meta: dict[str, Any]


class AlertEventDetailOut(BaseModel):
    success: bool = True
    data: AlertEventOut


# ── Tenant / accès ──────────────────────────────────────────────────────────────


async def _get_company_id(db: AsyncSession) -> uuid.UUID:
    result = await db.execute(sql_text("SELECT current_setting('app.current_company_id', true)"))
    raw = result.scalar()
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="tenant_context_missing"
        )
    return uuid.UUID(raw)


def _actor_id(request: Request) -> uuid.UUID | None:
    raw = getattr(request.state, "user_id", None)
    return uuid.UUID(raw) if raw else None


async def _get_rule(
    db: AsyncSession, company_id: uuid.UUID, rule_id: uuid.UUID
) -> AlertRule | None:
    result = await db.execute(
        select(AlertRule).where(
            AlertRule.id == rule_id,
            AlertRule.company_id == company_id,
            AlertRule.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


# ── Endpoints — Règles ─────────────────────────────────────────────────────────


@alerts_router.get("/health")
async def alerts_health() -> dict[str, str]:
    return {"section": "admin.alerts", "status": "ok"}


@alerts_router.get("/metrics")
async def list_metrics() -> dict[str, Any]:
    """Catalogue des métriques évaluables (pour peupler l'UI de création de règle)."""
    return {"success": True, "data": list(KNOWN_METRICS)}


@alerts_router.get("/rules", response_model=AlertRuleListOut)
async def list_rules(
    is_active: bool | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> AlertRuleListOut:
    company_id = await _get_company_id(db)
    base = select(AlertRule).where(
        AlertRule.company_id == company_id, AlertRule.deleted_at.is_(None)
    )
    if is_active is not None:
        base = base.where(AlertRule.is_active == is_active)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    offset = (page - 1) * limit
    rows = (
        (await db.execute(base.order_by(AlertRule.created_at.desc()).offset(offset).limit(limit)))
        .scalars()
        .all()
    )
    return AlertRuleListOut(
        data=[AlertRuleOut.model_validate(r) for r in rows],
        meta={"total": total, "page": page, "limit": limit},
    )


@alerts_router.post(
    "/rules",
    response_model=AlertRuleDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin_write)],
)
async def create_rule(
    body: AlertRuleCreate,
    db: AsyncSession = Depends(get_db_session),
) -> AlertRuleDetailOut:
    company_id = await _get_company_id(db)
    rule = AlertRule(company_id=company_id, **body.model_dump())
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return AlertRuleDetailOut(data=AlertRuleOut.model_validate(rule))


@alerts_router.get("/rules/{rule_id}", response_model=AlertRuleDetailOut)
async def get_rule(
    rule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> AlertRuleDetailOut:
    company_id = await _get_company_id(db)
    rule = await _get_rule(db, company_id, rule_id)
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="rule_not_found")
    return AlertRuleDetailOut(data=AlertRuleOut.model_validate(rule))


@alerts_router.patch(
    "/rules/{rule_id}",
    response_model=AlertRuleDetailOut,
    dependencies=[Depends(require_admin_write)],
)
async def update_rule(
    rule_id: uuid.UUID,
    body: AlertRuleUpdate,
    db: AsyncSession = Depends(get_db_session),
) -> AlertRuleDetailOut:
    company_id = await _get_company_id(db)
    rule = await _get_rule(db, company_id, rule_id)
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="rule_not_found")
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="no_fields_to_update")
    for key, value in fields.items():
        setattr(rule, key, value)
    await db.commit()
    await db.refresh(rule)
    return AlertRuleDetailOut(data=AlertRuleOut.model_validate(rule))


@alerts_router.delete(
    "/rules/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin_write)],
)
async def delete_rule(
    rule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    company_id = await _get_company_id(db)
    rule = await _get_rule(db, company_id, rule_id)
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="rule_not_found")
    rule.deleted_at = datetime.now(tz=rule.created_at.tzinfo)
    await db.commit()


# ── Endpoints — Événements ──────────────────────────────────────────────────────


@alerts_router.get("/events", response_model=AlertEventListOut)
async def list_events(
    status_filter: str | None = Query(None, alias="status", pattern="^(open|acked|resolved)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> AlertEventListOut:
    company_id = await _get_company_id(db)
    base = select(AlertEvent).where(
        AlertEvent.company_id == company_id, AlertEvent.deleted_at.is_(None)
    )
    if status_filter:
        base = base.where(AlertEvent.status == status_filter)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    offset = (page - 1) * limit
    rows = (
        (await db.execute(base.order_by(AlertEvent.created_at.desc()).offset(offset).limit(limit)))
        .scalars()
        .all()
    )
    return AlertEventListOut(
        data=[AlertEventOut.model_validate(e) for e in rows],
        meta={"total": total, "page": page, "limit": limit},
    )


async def _transition_event(
    db: AsyncSession,
    company_id: uuid.UUID,
    event_id: uuid.UUID,
    target: str,
    actor: uuid.UUID | None,
) -> AlertEvent:
    result = await db.execute(
        select(AlertEvent).where(
            AlertEvent.id == event_id,
            AlertEvent.company_id == company_id,
            AlertEvent.deleted_at.is_(None),
        )
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="event_not_found")
    if not can_transition(event.status, target):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"invalid_transition_{event.status}_{target}",
        )
    now = datetime.now(tz=event.created_at.tzinfo)
    event.status = target
    if target == "acked":
        event.acked_by = actor
        event.acked_at = now
    elif target == "resolved":
        event.resolved_at = now
        if event.acked_by is None:
            event.acked_by = actor
    await db.commit()
    await db.refresh(event)
    return event


@alerts_router.post("/events/{event_id}/ack", response_model=AlertEventDetailOut)
async def ack_event(
    event_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> AlertEventDetailOut:
    company_id = await _get_company_id(db)
    event = await _transition_event(db, company_id, event_id, "acked", _actor_id(request))
    return AlertEventDetailOut(data=AlertEventOut.model_validate(event))


@alerts_router.post("/events/{event_id}/resolve", response_model=AlertEventDetailOut)
async def resolve_event(
    event_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> AlertEventDetailOut:
    company_id = await _get_company_id(db)
    event = await _transition_event(db, company_id, event_id, "resolved", _actor_id(request))
    return AlertEventDetailOut(data=AlertEventOut.model_validate(event))
