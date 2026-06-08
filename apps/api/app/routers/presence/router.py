"""Router présence — heartbeat (tout user authentifié) + sessions actives (admin).

- `POST /api/v1/presence/heartbeat` : le navigateur signale sa session + sa page.
- `GET  /api/v1/presence/active?advanced=1` : panneau de surveillance — RÉSERVÉ
  admin/manager (les IP/positions des utilisateurs ne fuient pas aux non-admins).

RLS via get_db_session (Loi 1). L'IP est lue côté serveur (X-Forwarded-For derrière
le proxy, sinon IP socket).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.routers.presence import service
from app.routers.presence.schemas import (
    ActiveResponse,
    ActiveSession,
    Advanced,
    Bucket,
    HeartbeatBody,
)

router = APIRouter(prefix="/presence", tags=["presence"])

_ADMIN_ROLES = ("admin", "manager")


def _company_user(request: Request) -> tuple[uuid.UUID, uuid.UUID]:
    raw_c = getattr(request.state, "company_id", None)
    raw_u = getattr(request.state, "user_id", None)
    if not raw_c or not raw_u:
        raise HTTPException(status_code=401, detail="authentication_required")
    try:
        return uuid.UUID(raw_c), uuid.UUID(raw_u)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="invalid_context") from exc


def _require_admin(request: Request) -> uuid.UUID:
    company_id, _ = _company_user(request)
    if getattr(request.state, "role", None) not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="insufficient_permissions")
    return company_id


def _client_ip(request: Request) -> str | None:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip() or None
    return request.client.host if request.client else None


@router.post("/heartbeat")
async def heartbeat_endpoint(
    body: HeartbeatBody,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    company_id, user_id = _company_user(request)
    await service.heartbeat(
        db,
        company_id,
        user_id,
        session_key=body.session_key,
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        category=body.category,
        subcategory=body.subcategory,
        page=body.page,
    )
    return {"success": True}


@router.get("/active", response_model=ActiveResponse)
async def active_endpoint(
    request: Request,
    advanced: int = Query(0),
    db: AsyncSession = Depends(get_db_session),
) -> ActiveResponse:
    company_id = _require_admin(request)
    rows = await service.active_sessions(db, company_id)

    sessions = [
        ActiveSession(
            user_id=s.user_id,
            user_label=label,
            ip=s.ip,
            country=s.geo_country,
            city=s.geo_city,
            lat=s.geo_lat,
            lng=s.geo_lng,
            category=s.category,
            subcategory=s.subcategory,
            page=s.page,
            last_seen_at=s.last_seen_at,
        )
        for (s, label) in rows
    ]

    def buckets(items: list[tuple[str | None, str | None]]) -> list[Bucket]:
        return [Bucket(**b) for b in service.count_by(items)]

    adv = None
    if advanced:
        adv = Advanced(
            by_category=buckets([(s.category, None) for (s, _) in rows]),
            by_subcategory=buckets([(s.subcategory, None) for (s, _) in rows]),
            by_page=buckets([(s.page, None) for (s, _) in rows]),
        )

    return ActiveResponse(
        sessions=sessions,
        by_user=buckets([(str(s.user_id), label) for (s, label) in rows]),
        by_ip=buckets([(s.ip, None) for (s, _) in rows]),
        by_region=buckets([(s.geo_country, s.geo_city) for (s, _) in rows]),
        advanced=adv,
    )
