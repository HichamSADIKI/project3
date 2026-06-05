"""Sous-routeur Admin · Utilisateurs / groupes / permissions (app-admin, tenant).

Périmètre A (Loi 1) : gère les utilisateurs et leurs droits PAR société, au-dessus
du module `iam`. Garde `require_admin` posée au niveau routeur (frozen Wave 0) ;
les écritures sensibles (PATCH) montent en plus `require_admin_write` (admin seul).

Toujours filtrer par company_id via `get_db_session` (RLS, Loi 1) + le helper
`_get_company_id`. INTERDIT de modifier `is_platform_admin` ici (cross-tenant,
hors périmètre — géré par les endpoints `/admin/platform/*`).
"""

import uuid
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.models.user import User
from app.routers.admin.deps import require_admin, require_admin_write
from app.routers.iam.models import Group

users_router = APIRouter(prefix="/users", tags=["admin"], dependencies=[Depends(require_admin)])

# Valeurs autorisées (alignées sur app.models.user.UserRole / UserStatus).
_ROLE_VALUES: tuple[str, ...] = ("admin", "manager", "agent", "client", "fournisseur")
_STATUS_VALUES: tuple[str, ...] = ("active", "pending", "rejected", "suspended")

UserRoleLiteral = Literal["admin", "manager", "agent", "client", "fournisseur"]
UserStatusLiteral = Literal["active", "pending", "rejected", "suspended"]


# ── Schémas Pydantic v2 ───────────────────────────────────────────────────────


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    status: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserListOut(BaseModel):
    success: bool = True
    data: list[UserOut]
    meta: dict[str, Any]


class UserDetailOut(BaseModel):
    success: bool = True
    data: UserOut


class UserUpdate(BaseModel):
    """Modification d'un utilisateur. Tous les champs optionnels (PATCH partiel).

    `is_platform_admin` est volontairement ABSENT : hors périmètre app-admin.
    """

    role: UserRoleLiteral | None = None
    status: UserStatusLiteral | None = None
    is_active: bool | None = None


class GroupOut(BaseModel):
    id: uuid.UUID
    slug: str
    name_ar: str | None
    name_en: str | None
    name_fr: str | None
    is_system: bool

    model_config = {"from_attributes": True}


class GroupListOut(BaseModel):
    success: bool = True
    data: list[GroupOut]
    meta: dict[str, Any]


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _get_company_id(db: AsyncSession) -> uuid.UUID:
    """Récupère le company_id depuis la session PostgreSQL (injecté par le middleware JWT)."""
    result = await db.execute(sql_text("SELECT current_setting('app.current_company_id', true)"))
    raw = result.scalar()
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="tenant_context_missing",
        )
    return uuid.UUID(raw)


async def _get_user(db: AsyncSession, company_id: uuid.UUID, user_id: uuid.UUID) -> User | None:
    """Charge un utilisateur du tenant courant (non supprimé). None si hors tenant/inexistant."""
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.company_id == company_id,
            User.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


# ── Endpoints ─────────────────────────────────────────────────────────────────


@users_router.get("/health")
async def users_health() -> dict[str, str]:
    return {"section": "admin.users", "status": "ok"}


# Déclaré AVANT /{user_id} pour que « groups » ne soit pas capturé comme un UUID.
@users_router.get("/groups", response_model=GroupListOut)
async def list_groups_endpoint(
    db: AsyncSession = Depends(get_db_session),
) -> GroupListOut:
    """Liste les groupes IAM du tenant (best-effort, lecture seule)."""
    company_id = await _get_company_id(db)
    stmt = (
        select(Group)
        .where(Group.company_id == company_id, Group.deleted_at.is_(None))
        .order_by(Group.slug)
    )
    rows = (await db.execute(stmt)).scalars().all()
    data = [GroupOut.model_validate(g) for g in rows]
    return GroupListOut(data=data, meta={"total": len(data)})


@users_router.get("", response_model=UserListOut)
async def list_users_endpoint(
    role: str | None = Query(None, pattern="^(admin|manager|agent|client|fournisseur)$"),
    status_filter: str | None = Query(
        None, alias="status", pattern="^(active|pending|rejected|suspended)$"
    ),
    q: str | None = Query(None, max_length=255),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> UserListOut:
    """Liste paginée des utilisateurs du tenant (Loi 1 : filtre company_id + RLS)."""
    company_id = await _get_company_id(db)
    base = select(User).where(
        User.company_id == company_id,
        User.deleted_at.is_(None),
    )
    if role:
        base = base.where(User.role == role)
    if status_filter:
        base = base.where(User.status == status_filter)
    if q:
        pattern = f"%{q.strip()}%"
        base = base.where(or_(User.email.ilike(pattern), User.full_name.ilike(pattern)))

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    offset = (page - 1) * limit
    rows = (
        (await db.execute(base.order_by(User.created_at.desc()).offset(offset).limit(limit)))
        .scalars()
        .all()
    )
    return UserListOut(
        data=[UserOut.model_validate(u) for u in rows],
        meta={"total": total, "page": page, "limit": limit},
    )


@users_router.get("/{user_id}", response_model=UserDetailOut)
async def get_user_endpoint(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> UserDetailOut:
    """Détail d'un utilisateur du tenant (404 si hors tenant/inexistant)."""
    company_id = await _get_company_id(db)
    user = await _get_user(db, company_id, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user_not_found")
    return UserDetailOut(data=UserOut.model_validate(user))


@users_router.patch(
    "/{user_id}",
    response_model=UserDetailOut,
    dependencies=[Depends(require_admin_write)],
)
async def update_user_endpoint(
    user_id: uuid.UUID,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db_session),
) -> UserDetailOut:
    """Modifie role/status/is_active d'un utilisateur du tenant (admin seul).

    404 si hors tenant/inexistant. `is_platform_admin` reste intouchable ici.
    """
    company_id = await _get_company_id(db)
    user = await _get_user(db, company_id, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user_not_found")

    fields = body.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="no_fields_to_update")

    if "role" in fields and fields["role"] is not None:
        if fields["role"] not in _ROLE_VALUES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_role")
        user.role = fields["role"]
    if "status" in fields and fields["status"] is not None:
        if fields["status"] not in _STATUS_VALUES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_status")
        user.status = fields["status"]
    if "is_active" in fields and fields["is_active"] is not None:
        user.is_active = fields["is_active"]

    await db.commit()
    await db.refresh(user)
    return UserDetailOut(data=UserOut.model_validate(user))
