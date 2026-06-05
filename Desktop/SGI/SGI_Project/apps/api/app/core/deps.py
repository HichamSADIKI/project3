import uuid

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

# Lecture du drapeau super-admin plateforme (table users, exemptée Loi 1 → pas de
# filtre company_id). Le flag n'est PAS dans le JWT : on le lit en base à chaque
# requête infra-admin (faible trafic, gain de sécurité : révocation immédiate).
_IS_PLATFORM_ADMIN = text(
    "SELECT is_platform_admin FROM users WHERE id = :uid AND deleted_at IS NULL"
)

# GUC tenant lue par les policies RLS : current_setting('app.current_company_id').
_SET_TENANT = text("SELECT set_config('app.current_company_id', :cid, false)")
_CLEAR_TENANT = text("SELECT set_config('app.current_company_id', '', false)")


async def get_company_id(request: Request) -> str:
    company_id = getattr(request.state, "company_id", None)
    if not company_id:
        raise HTTPException(status_code=401, detail="tenant_required")
    return company_id


async def get_db_session(
    db: AsyncSession = Depends(get_db),
    company_id: str = Depends(get_company_id),
) -> AsyncSession:
    """Session API avec contexte tenant pour la RLS.

    Le GUC `app.current_company_id` est posé au niveau **session** (is_local=
    false) → il survit aux commits faits par les services (pattern commit puis
    refresh), contrairement à un SET LOCAL transactionnel. `get_db` épingle la
    connexion pour la requête, donc le SET reste valable. Reset fail-closed en
    fin de requête pour éviter toute fuite cross-tenant via le pool.
    """
    await db.execute(_SET_TENANT, {"cid": company_id})
    await db.commit()  # clôt la tx implicite ; le SET (session) persiste
    try:
        yield db
    finally:
        try:
            await db.execute(_CLEAR_TENANT)
            await db.commit()
        except Exception:  # noqa: S110  reset best-effort du GUC en fin de requête
            pass


def require_role(*roles: str):
    async def checker(request: Request) -> None:
        user_role = getattr(request.state, "role", None)
        if user_role not in roles:
            raise HTTPException(status_code=403, detail="forbidden")

    return checker


async def require_platform_admin(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> uuid.UUID:
    """Garde infra-admin PLATEFORME (cross-tenant, hors Loi 1).

    À utiliser EXCLUSIVEMENT sur les endpoints `/admin/platform/*`. N'utilise PAS
    `get_db_session` (qui exige un contexte tenant) : le périmètre est volontairement
    cross-tenant. Refuse `401` sans JWT, `403` si l'utilisateur n'a pas le drapeau
    `is_platform_admin`. Retourne l'UUID du super-admin (pour l'audit des actions).
    """
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="authentication_required"
        )
    result = await db.execute(_IS_PLATFORM_ADMIN, {"uid": user_id})
    if not result.scalar():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="platform_admin_required")
    return uuid.UUID(user_id)
