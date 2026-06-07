"""Dépendances FastAPI IAM — `require_permission`.

Remplace `require_roles` : autorise une route si le nœud `node_key` est *allow*
dans les permissions effectives résolues de l'utilisateur (cache Valkey).

Isolé dans le module `iam` (et non `core/route_deps`) pour éviter un cycle
d'import : `service` importe les modèles/redis, et `route_deps` est importé très
largement. Les routers qui basculent vers la permission importent d'ici.
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.routers.iam import service


def _ctx(request: Request) -> tuple[uuid.UUID, uuid.UUID]:
    cid = getattr(request.state, "company_id", None)
    uid = getattr(request.state, "user_id", None)
    if not cid or not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="tenant_context_missing"
        )
    return uuid.UUID(cid), uuid.UUID(uid)


def require_permission(node_key: str) -> Callable[..., Awaitable[None]]:
    """Garde une route sur un nœud du catalogue (deny/absent → 403)."""

    async def _check(request: Request, db: AsyncSession = Depends(get_db_session)) -> None:
        company_id, user_id = _ctx(request)
        effective = await service.get_effective_cached(db, company_id, user_id)
        if not service.can(effective, node_key):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="insufficient_permissions"
            )

    return _check
