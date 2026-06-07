"""Router admin Self-Defense (admin/manager) — config + verrouillages.

`get_db_session` arme la RLS sur le tenant du JWT ⇒ Loi 1 (chaque société ne voit
que sa config / ses verrouillages). Les hashes de codes ne sont JAMAIS renvoyés.

Routes (préfixe `/api/v1/admin/self-defense`) :
- `GET    /config`                 — flags (codes définis ?) + max_attempts + options.
- `PUT    /config`                 — définir codes (hashés), max_attempts, armgate, options.
- `GET    /lockouts`               — utilisateurs verrouillés.
- `POST   /lockouts/{user_id}/unlock` — déverrouiller un utilisateur.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.routers.self_defense import service
from app.routers.self_defense.schemas import (
    ConfigEnvelope,
    ConfigOut,
    ConfigUpdate,
    LockoutOut,
    LockoutsEnvelope,
)

router = APIRouter(prefix="/admin/self-defense", tags=["self_defense_admin"])

_ADMIN_ROLES = ("admin", "manager")


def require_admin(request: Request) -> uuid.UUID:
    """401 si non authentifié, 403 si rôle insuffisant. Retourne le company_id."""
    raw = getattr(request.state, "company_id", None)
    role = getattr(request.state, "role", None)
    if not raw or role is None:
        raise HTTPException(status_code=401, detail="authentication_required")
    if role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="insufficient_permissions")
    try:
        return uuid.UUID(raw)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="invalid_tenant_context") from exc


@router.get("/config", response_model=ConfigEnvelope)
async def get_config_endpoint(
    company_id: uuid.UUID = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
) -> ConfigEnvelope:
    cfg = await service.get_config(db, company_id)
    data = ConfigOut(
        arm_code_set=bool(cfg and cfg.arm_code_hash),
        disarm_code_set=bool(cfg and cfg.disarm_code_hash),
        max_attempts=cfg.max_attempts if cfg else service.DEFAULT_MAX_ATTEMPTS,
        armgate_enabled=cfg.armgate_enabled if cfg else True,
        options=cfg.options if cfg else {},
    )
    return ConfigEnvelope(data=data)


@router.put("/config", response_model=ConfigEnvelope)
async def update_config_endpoint(
    body: ConfigUpdate,
    company_id: uuid.UUID = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
) -> ConfigEnvelope:
    cfg = await service.update_config(
        db,
        company_id,
        arm_code=body.arm_code,
        disarm_code=body.disarm_code,
        max_attempts=body.max_attempts,
        armgate_enabled=body.armgate_enabled,
        options=body.options,
    )
    data = ConfigOut(
        arm_code_set=bool(cfg.arm_code_hash),
        disarm_code_set=bool(cfg.disarm_code_hash),
        max_attempts=cfg.max_attempts,
        armgate_enabled=cfg.armgate_enabled,
        options=cfg.options,
    )
    return ConfigEnvelope(data=data)


@router.get("/lockouts", response_model=LockoutsEnvelope)
async def list_lockouts_endpoint(
    company_id: uuid.UUID = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
) -> LockoutsEnvelope:
    rows = await service.list_lockouts(db, company_id)
    return LockoutsEnvelope(data=[LockoutOut.model_validate(r, from_attributes=True) for r in rows])


@router.post("/lockouts/{user_id}/unlock", status_code=status.HTTP_200_OK)
async def unlock_endpoint(
    user_id: uuid.UUID,
    company_id: uuid.UUID = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    ok = await service.unlock_user(db, company_id, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="not_found")
    return {"success": True}
