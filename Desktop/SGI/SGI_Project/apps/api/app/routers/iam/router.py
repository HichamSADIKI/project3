"""Router FastAPI — IAM (gestion des accès & permissions).

Tout est filtré par `company_id` (Loi 1) et gardé par `require_permission` sur le
nœud `settings.access.*` (l'IAM se gère via sa propre permission ; par défaut seul
l'admin l'a). `GET /iam/me/permissions` est ouvert à tout utilisateur authentifié
(le frontend hydrate son store). Anti-BOLA : 404 — jamais 403 — quand une entité
n'appartient pas au tenant.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.models.user import User
from app.routers.iam import service
from app.routers.iam.deps import require_permission
from app.routers.iam.schemas import (
    CatalogueOut,
    EffectiveEntry,
    EffectiveOut,
    GrantOut,
    GrantsOut,
    GrantsUpsert,
    GroupCreate,
    GroupItemOut,
    GroupListOut,
    GroupOut,
    GroupUpdate,
    MemberBody,
    NodeOut,
    UnitCreate,
    UnitItemOut,
    UnitListOut,
    UnitOut,
    UnitUpdate,
    UserCreate,
    UserItemOut,
    UserListOut,
    UserOut,
    UserUpdate,
)

router = APIRouter(prefix="/iam", tags=["iam"])

_READ = require_permission("settings.access.read")
_CREATE = require_permission("settings.access.create")
_UPDATE = require_permission("settings.access.update")
_DELETE = require_permission("settings.access.delete")


def _ctx(request: Request) -> tuple[uuid.UUID, uuid.UUID]:
    cid = getattr(request.state, "company_id", None)
    uid = getattr(request.state, "user_id", None)
    if not cid or not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="tenant_context_missing"
        )
    return uuid.UUID(cid), uuid.UUID(uid)


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "iam", "status": "ok"}


# ── Permissions de l'utilisateur courant (hydratation frontend) ──────────────────


@router.get("/me/permissions", response_model=EffectiveOut)
async def my_permissions(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> EffectiveOut:
    company_id, user_id = _ctx(request)
    effective = await service.get_effective_cached(db, company_id, user_id)
    return EffectiveOut(
        data={
            k: EffectiveEntry(effect=e.effect, source=e.source, via_node=e.via_node)
            for k, e in effective.items()
        },
        allowed=sorted(service.allowed_keys(effective)),
    )


# ── Catalogue ────────────────────────────────────────────────────────────────────


@router.get("/catalogue", response_model=CatalogueOut, dependencies=[Depends(_READ)])
async def get_catalogue(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> CatalogueOut:
    company_id, _ = _ctx(request)
    nodes = await service.load_nodes(db, company_id)
    return CatalogueOut(data=[NodeOut.model_validate(n) for n in nodes])


# ── Utilisateurs ─────────────────────────────────────────────────────────────────


async def _user_out(db: AsyncSession, company_id: uuid.UUID, user: User) -> UserOut:
    group_ids, unit_ids = await service.user_memberships(db, company_id, user.id)
    base = UserOut.model_validate(user)
    return base.model_copy(update={"group_ids": group_ids, "unit_ids": unit_ids})


@router.get("/users", response_model=UserListOut, dependencies=[Depends(_READ)])
async def list_users_endpoint(
    request: Request,
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> UserListOut:
    company_id, _ = _ctx(request)
    users, total = await service.list_users(db, company_id, page=page, limit=limit, search=search)
    data = [await _user_out(db, company_id, u) for u in users]
    return UserListOut(data=data, meta={"total": total, "page": page, "limit": limit})


@router.post(
    "/users",
    response_model=UserItemOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_CREATE)],
)
async def create_user_endpoint(
    body: UserCreate, request: Request, db: AsyncSession = Depends(get_db_session)
) -> UserItemOut:
    company_id, _ = _ctx(request)
    if await service.email_taken(db, body.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email_taken")
    user = await service.create_user(db, company_id, body.model_dump())
    return UserItemOut(data=await _user_out(db, company_id, user))


@router.get("/users/{user_id}", response_model=UserItemOut, dependencies=[Depends(_READ)])
async def get_user_endpoint(
    user_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db_session)
) -> UserItemOut:
    company_id, _ = _ctx(request)
    user = await service.get_user(db, company_id, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user_not_found")
    return UserItemOut(data=await _user_out(db, company_id, user))


@router.put("/users/{user_id}", response_model=UserItemOut, dependencies=[Depends(_UPDATE)])
async def update_user_endpoint(
    user_id: uuid.UUID,
    body: UserUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> UserItemOut:
    company_id, _ = _ctx(request)
    user = await service.get_user(db, company_id, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user_not_found")
    user = await service.update_user(db, company_id, user, body.model_dump(exclude_unset=True))
    return UserItemOut(data=await _user_out(db, company_id, user))


@router.get(
    "/users/{user_id}/effective", response_model=EffectiveOut, dependencies=[Depends(_READ)]
)
async def user_effective_endpoint(
    user_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db_session)
) -> EffectiveOut:
    company_id, _ = _ctx(request)
    if await service.get_user(db, company_id, user_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user_not_found")
    effective = await service.compute_effective(db, company_id, user_id)
    return EffectiveOut(
        data={
            k: EffectiveEntry(effect=e.effect, source=e.source, via_node=e.via_node)
            for k, e in effective.items()
        },
        allowed=sorted(service.allowed_keys(effective)),
    )


# ── Groupes ──────────────────────────────────────────────────────────────────────


@router.get("/groups", response_model=GroupListOut, dependencies=[Depends(_READ)])
async def list_groups_endpoint(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> GroupListOut:
    company_id, _ = _ctx(request)
    groups = await service.list_groups(db, company_id)
    return GroupListOut(
        data=[GroupOut.model_validate(g) for g in groups], meta={"total": len(groups)}
    )


@router.post(
    "/groups",
    response_model=GroupItemOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_CREATE)],
)
async def create_group_endpoint(
    body: GroupCreate, request: Request, db: AsyncSession = Depends(get_db_session)
) -> GroupItemOut:
    company_id, _ = _ctx(request)
    group = await service.create_group(db, company_id, body.model_dump())
    return GroupItemOut(data=GroupOut.model_validate(group))


@router.put("/groups/{group_id}", response_model=GroupItemOut, dependencies=[Depends(_UPDATE)])
async def update_group_endpoint(
    group_id: uuid.UUID,
    body: GroupUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> GroupItemOut:
    company_id, _ = _ctx(request)
    group = await service.get_group(db, company_id, group_id)
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="group_not_found")
    group = await service.update_group(db, group, body.model_dump(exclude_unset=True))
    return GroupItemOut(data=GroupOut.model_validate(group))


@router.delete(
    "/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(_DELETE)]
)
async def delete_group_endpoint(
    group_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db_session)
) -> None:
    company_id, _ = _ctx(request)
    group = await service.get_group(db, company_id, group_id)
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="group_not_found")
    if group.is_system:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="cannot_delete_system_group"
        )
    await service.soft_delete_group(db, group)
    await service.bump_company_version(company_id)


@router.post(
    "/groups/{group_id}/members",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(_UPDATE)],
)
async def add_group_member_endpoint(
    group_id: uuid.UUID,
    body: MemberBody,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    company_id, _ = _ctx(request)
    if await service.get_group(db, company_id, group_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="group_not_found")
    if await service.get_user(db, company_id, body.user_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_not_in_company")
    await service.add_group_member(db, company_id, group_id, body.user_id)


@router.delete(
    "/groups/{group_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(_UPDATE)],
)
async def remove_group_member_endpoint(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    company_id, _ = _ctx(request)
    if await service.get_group(db, company_id, group_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="group_not_found")
    await service.remove_group_member(db, company_id, group_id, user_id)


# ── Unités (sous-groupes) ────────────────────────────────────────────────────────


@router.get("/units", response_model=UnitListOut, dependencies=[Depends(_READ)])
async def list_units_endpoint(
    request: Request,
    group_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db_session),
) -> UnitListOut:
    company_id, _ = _ctx(request)
    units = await service.list_units(db, company_id, group_id)
    return UnitListOut(data=[UnitOut.model_validate(u) for u in units], meta={"total": len(units)})


@router.post(
    "/units",
    response_model=UnitItemOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_CREATE)],
)
async def create_unit_endpoint(
    body: UnitCreate, request: Request, db: AsyncSession = Depends(get_db_session)
) -> UnitItemOut:
    company_id, _ = _ctx(request)
    # Loi 1 : le groupe parent DOIT appartenir au tenant.
    if await service.get_group(db, company_id, body.group_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="group_not_in_company")
    unit = await service.create_unit(db, company_id, body.model_dump())
    return UnitItemOut(data=UnitOut.model_validate(unit))


@router.put("/units/{unit_id}", response_model=UnitItemOut, dependencies=[Depends(_UPDATE)])
async def update_unit_endpoint(
    unit_id: uuid.UUID,
    body: UnitUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> UnitItemOut:
    company_id, _ = _ctx(request)
    unit = await service.get_unit(db, company_id, unit_id)
    if unit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unit_not_found")
    unit = await service.update_unit(db, unit, body.model_dump(exclude_unset=True))
    return UnitItemOut(data=UnitOut.model_validate(unit))


@router.delete(
    "/units/{unit_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(_DELETE)]
)
async def delete_unit_endpoint(
    unit_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db_session)
) -> None:
    company_id, _ = _ctx(request)
    unit = await service.get_unit(db, company_id, unit_id)
    if unit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unit_not_found")
    await service.soft_delete_unit(db, unit)
    await service.bump_company_version(company_id)


@router.post(
    "/units/{unit_id}/members",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(_UPDATE)],
)
async def add_unit_member_endpoint(
    unit_id: uuid.UUID,
    body: MemberBody,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    company_id, _ = _ctx(request)
    if await service.get_unit(db, company_id, unit_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unit_not_found")
    if await service.get_user(db, company_id, body.user_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_not_in_company")
    await service.add_unit_member(db, company_id, unit_id, body.user_id)


@router.delete(
    "/units/{unit_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(_UPDATE)],
)
async def remove_unit_member_endpoint(
    unit_id: uuid.UUID,
    user_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    company_id, _ = _ctx(request)
    if await service.get_unit(db, company_id, unit_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unit_not_found")
    await service.remove_unit_member(db, company_id, unit_id, user_id)


# ── Grants (matrice) ─────────────────────────────────────────────────────────────


@router.get("/grants", response_model=GrantsOut, dependencies=[Depends(_READ)])
async def get_grants_endpoint(
    request: Request,
    subject_type: str = Query(..., pattern="^(group|unit|user)$"),
    subject_id: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db_session),
) -> GrantsOut:
    company_id, _ = _ctx(request)
    rows = await service.get_subject_grants(db, company_id, subject_type, subject_id)
    return GrantsOut(
        data=[GrantOut(node_key=k, effect=e, scope=s) for k, e, s in rows],
        meta={"total": len(rows)},
    )


@router.put("/grants", response_model=GrantsOut, dependencies=[Depends(_UPDATE)])
async def put_grants_endpoint(
    body: GrantsUpsert, request: Request, db: AsyncSession = Depends(get_db_session)
) -> GrantsOut:
    company_id, user_id = _ctx(request)
    # Loi 1 : le sujet groupe/unité DOIT appartenir au tenant (anti cross-tenant).
    if (
        body.subject_type == "group"
        and await service.get_group(db, company_id, body.subject_id) is None
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="subject_not_in_company"
        )
    if (
        body.subject_type == "unit"
        and await service.get_unit(db, company_id, body.subject_id) is None
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="subject_not_in_company"
        )
    if (
        body.subject_type == "user"
        and await service.get_user(db, company_id, body.subject_id) is None
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="subject_not_in_company"
        )
    items: list[tuple[str, str, str]] = [
        (it.node_key, it.effect, it.scope) for it in body.items
    ]
    await service.replace_subject_grants(
        db, company_id, body.subject_type, body.subject_id, items, created_by=user_id
    )
    rows = await service.get_subject_grants(db, company_id, body.subject_type, body.subject_id)
    return GrantsOut(
        data=[GrantOut(node_key=k, effect=e, scope=s) for k, e, s in rows],
        meta={"total": len(rows)},
    )
