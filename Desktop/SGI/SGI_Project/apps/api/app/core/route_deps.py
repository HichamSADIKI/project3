"""
Dépendances FastAPI partagées par les routers.

Évite la duplication de `_get_company_id` + `_require_roles` dans chaque
fichier router. Les routers existants gardent leur version inline pour
ne pas casser leur signature ; les nouveaux routers (party-roles, etc.)
importent depuis ici.
"""

import uuid

from fastapi import HTTPException, Request, status
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession


async def get_company_id(db: AsyncSession) -> uuid.UUID:
    """
    Récupère le company_id depuis la session PostgreSQL.
    Injecté par TenantMiddleware via `SET LOCAL app.current_company_id` (Loi 1).
    """
    result = await db.execute(sql_text("SELECT current_setting('app.current_company_id', true)"))
    raw = result.scalar()
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="tenant_context_missing",
        )
    return uuid.UUID(raw)


def require_roles(*allowed_roles: str):
    """Dépendance vérifiant le rôle utilisateur (RBAC)."""

    async def _check(request: Request) -> None:
        role = getattr(request.state, "role", None)
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="insufficient_permissions",
            )

    return _check
