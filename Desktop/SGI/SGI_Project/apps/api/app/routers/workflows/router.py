"""Router Workflow Engine — /api/v1/workflows."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import get_company_id, require_roles

from .schemas import (
    EventOut,
    InstanceCreate,
    InstanceDetailOut,
    InstanceListOut,
    InstanceOut,
    StepAction,
    StepOut,
    TemplateCreate,
    TemplateOut,
)
from .service import (
    approve_step,
    create_template,
    get_events,
    get_instance,
    get_steps,
    list_instances,
    list_templates,
    note_step,
    reject_step,
    start_workflow,
)

router = APIRouter(prefix="/workflows", tags=["workflows"])


def _uid(request: Request) -> uuid.UUID:
    uid = getattr(request.state, "user_id", None)
    if not uid:
        raise HTTPException(status_code=401, detail="not_authenticated")
    return uuid.UUID(uid)


# ── Templates ─────────────────────────────────────────────────────────────

@router.get("/templates", response_model=list[TemplateOut])
async def list_tpls(
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager")),
) -> list[TemplateOut]:
    cid = await get_company_id(db)
    return [TemplateOut.model_validate(t) for t in await list_templates(db, cid, active_only)]


@router.post("/templates", response_model=TemplateOut,
             status_code=status.HTTP_201_CREATED)
async def create_tpl(
    body: TemplateCreate,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin")),
) -> TemplateOut:
    cid = await get_company_id(db)
    return TemplateOut.model_validate(await create_template(db, cid, body))


# ── Instances ─────────────────────────────────────────────────────────────

@router.get("/instances", response_model=InstanceListOut)
async def list_inst(
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> InstanceListOut:
    cid = await get_company_id(db)
    items, total = await list_instances(db, cid, status, page, limit)
    pages = (total + limit - 1) // limit
    data = []
    for inst in items:
        steps = await get_steps(db, cid, inst.id)
        out = InstanceOut.model_validate(inst)
        out.steps = [StepOut.model_validate(s) for s in steps]
        data.append(out)
    return InstanceListOut(
        data=data, meta={"total": total, "page": page, "limit": limit, "pages": pages}
    )


@router.post("/instances", response_model=InstanceDetailOut,
             status_code=status.HTTP_201_CREATED)
async def create_inst(
    body: InstanceCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager")),
) -> InstanceDetailOut:
    cid = await get_company_id(db)
    inst = await start_workflow(db, cid, body, _uid(request))
    steps = await get_steps(db, cid, inst.id)
    out = InstanceOut.model_validate(inst)
    out.steps = [StepOut.model_validate(s) for s in steps]
    return InstanceDetailOut(data=out)


@router.get("/instances/{instance_id}", response_model=InstanceDetailOut)
async def get_inst(
    instance_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> InstanceDetailOut:
    cid = await get_company_id(db)
    inst = await get_instance(db, cid, instance_id)
    if not inst:
        raise HTTPException(status_code=404, detail="instance_not_found")
    steps = await get_steps(db, cid, instance_id)
    out = InstanceOut.model_validate(inst)
    out.steps = [StepOut.model_validate(s) for s in steps]
    return InstanceDetailOut(data=out)


# ── Actions sur step ──────────────────────────────────────────────────────

@router.post("/instances/{instance_id}/steps/{step_id}/approve",
             response_model=InstanceDetailOut)
async def do_approve(
    instance_id: uuid.UUID, step_id: uuid.UUID,
    body: StepAction, request: Request,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager")),
) -> InstanceDetailOut:
    cid = await get_company_id(db)
    inst = await approve_step(db, cid, instance_id, step_id, _uid(request), body)
    steps = await get_steps(db, cid, instance_id)
    out = InstanceOut.model_validate(inst)
    out.steps = [StepOut.model_validate(s) for s in steps]
    return InstanceDetailOut(data=out)


@router.post("/instances/{instance_id}/steps/{step_id}/reject",
             response_model=InstanceDetailOut)
async def do_reject(
    instance_id: uuid.UUID, step_id: uuid.UUID,
    body: StepAction, request: Request,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager")),
) -> InstanceDetailOut:
    cid = await get_company_id(db)
    inst = await reject_step(db, cid, instance_id, step_id, _uid(request), body)
    steps = await get_steps(db, cid, instance_id)
    out = InstanceOut.model_validate(inst)
    out.steps = [StepOut.model_validate(s) for s in steps]
    return InstanceDetailOut(data=out)


@router.post("/instances/{instance_id}/steps/{step_id}/note",
             response_model=InstanceDetailOut)
async def do_note(
    instance_id: uuid.UUID, step_id: uuid.UUID,
    body: StepAction, request: Request,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> InstanceDetailOut:
    cid = await get_company_id(db)
    inst = await note_step(db, cid, instance_id, step_id, _uid(request), body)
    steps = await get_steps(db, cid, instance_id)
    out = InstanceOut.model_validate(inst)
    out.steps = [StepOut.model_validate(s) for s in steps]
    return InstanceDetailOut(data=out)


# ── Events ────────────────────────────────────────────────────────────────

@router.get("/instances/{instance_id}/events", response_model=list[EventOut])
async def get_evts(
    instance_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_roles("admin", "manager", "agent")),
) -> list[EventOut]:
    cid = await get_company_id(db)
    return [EventOut.model_validate(e) for e in await get_events(db, cid, instance_id)]
