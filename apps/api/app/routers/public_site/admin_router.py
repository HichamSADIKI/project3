"""Router admin (AUTHENTIFIÉ) — pilotage du design du site public.

Distinct du router public (`/api/v1/public/*`, sans JWT). Ici on écrit le réglage
pour la société du JWT : la session `get_db_session` arme la RLS sur ce tenant,
donc Loi 1 garantie (aucune société ne peut lire/écrire le réglage d'une autre).

Routes :
- `GET  /api/v1/site-design` — réglage courant + style actif résolu.
- `PUT  /api/v1/site-design` — enregistre mode/style/délai (rôles admin/manager).
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.routers.public_site import service
from app.routers.public_site.models import PublicSiteDesign
from app.routers.public_site.schemas import (
    SiteDesignData,
    SiteDesignEnvelope,
    SiteDesignUpdate,
)

router = APIRouter(prefix="/site-design", tags=["public_site_admin"])

_WRITE_ROLES = ("admin", "manager")


def _get_company_id(request: Request) -> uuid.UUID:
    raw = getattr(request.state, "company_id", None)
    if not raw:
        raise HTTPException(status_code=401, detail="tenant_context_missing")
    return uuid.UUID(raw)


def _require_roles(*allowed_roles: str) -> Callable[[Request], Awaitable[None]]:
    async def _check(request: Request) -> None:
        role = getattr(request.state, "role", None)
        if role not in allowed_roles:
            raise HTTPException(status_code=403, detail="insufficient_permissions")

    return _check


def _to_data(row: PublicSiteDesign | None) -> SiteDesignData:
    """Construit la sortie (défauts si jamais configuré) + style actif résolu."""
    if row is None:
        return SiteDesignData(
            mode="manual",
            style=service.DEFAULT_SITE_STYLE,
            delay_hours=service.DEFAULT_SITE_DELAY_HOURS,
            rotation_since=None,
            active=service.DEFAULT_SITE_STYLE,
        )
    active, nxt, next_in = service.resolve_active_design(
        row.mode,
        row.style,
        row.delay_hours,
        row.rotation_since,
        datetime.now(UTC),
    )
    return SiteDesignData(
        mode=row.mode,
        style=row.style,
        delay_hours=row.delay_hours,
        rotation_since=row.rotation_since,
        active=active,
        next=nxt,
        next_in_seconds=next_in,
    )


@router.get("", response_model=SiteDesignEnvelope)
async def get_site_design_endpoint(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> SiteDesignEnvelope:
    company_id = _get_company_id(request)
    row = await service.get_site_design(db, company_id)
    return SiteDesignEnvelope(data=_to_data(row))


@router.put(
    "",
    response_model=SiteDesignEnvelope,
    dependencies=[Depends(_require_roles(*_WRITE_ROLES))],
)
async def update_site_design_endpoint(
    body: SiteDesignUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> SiteDesignEnvelope:
    company_id = _get_company_id(request)
    row = await service.upsert_site_design(
        db,
        company_id,
        mode=body.mode,
        style=body.style,
        delay_hours=body.delay_hours,
    )
    return SiteDesignEnvelope(data=_to_data(row))
