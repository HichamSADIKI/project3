"""Service Workflow Engine — CRUD + machine à états + helpers purs."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.workflow import (
    WorkflowEvent,
    WorkflowInstance,
    WorkflowStep,
    WorkflowTemplate,
)

from .schemas import InstanceCreate, StepAction, TemplateCreate

# ── Helpers purs ──────────────────────────────────────────────────────────

STEP_TRANSITIONS: dict[str, list[str]] = {
    "pending": ["in_progress", "skipped"],
    "in_progress": ["approved", "rejected", "escalated", "skipped"],
    "approved": [],
    "rejected": [],
    "skipped": [],
    "escalated": ["in_progress"],
}

INSTANCE_TRANSITIONS: dict[str, list[str]] = {
    "in_progress": ["approved", "rejected", "cancelled"],
    "approved": [],
    "rejected": [],
    "cancelled": [],
}


def is_valid_step_transition(current: str, target: str) -> bool:
    return target in STEP_TRANSITIONS.get(current, [])


def is_valid_instance_transition(current: str, target: str) -> bool:
    return target in INSTANCE_TRANSITIONS.get(current, [])


def is_step_sla_breached(step: WorkflowStep) -> bool:
    if step.status not in ("pending", "in_progress"):
        return False
    if not step.sla_due_at:
        return False
    due = step.sla_due_at
    if due.tzinfo is None:
        due = due.replace(tzinfo=UTC)
    return datetime.now(UTC) > due


def compute_step_sla(sla_hours: int | None, from_dt: datetime) -> datetime | None:
    if not sla_hours:
        return None
    base = from_dt if from_dt.tzinfo else from_dt.replace(tzinfo=UTC)
    return base + timedelta(hours=sla_hours)


# ── Templates ─────────────────────────────────────────────────────────────


async def list_templates(
    db: AsyncSession, company_id: uuid.UUID, active_only: bool = True
) -> list[WorkflowTemplate]:
    filters = [
        WorkflowTemplate.company_id == company_id,
        WorkflowTemplate.deleted_at.is_(None),
    ]
    if active_only:
        filters.append(WorkflowTemplate.active.is_(True))
    result = await db.execute(
        select(WorkflowTemplate)
        .where(and_(*filters))
        .order_by(WorkflowTemplate.workflow_type, WorkflowTemplate.name)
    )
    return list(result.scalars().all())


async def create_template(
    db: AsyncSession, company_id: uuid.UUID, data: TemplateCreate
) -> WorkflowTemplate:
    tpl = WorkflowTemplate(
        company_id=company_id,
        name=data.name,
        workflow_type=data.workflow_type,
        description=data.description,
        steps_definition=[s.model_dump() for s in data.steps_definition],
        active=True,
    )
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    return tpl


# ── Instances ─────────────────────────────────────────────────────────────


async def start_workflow(
    db: AsyncSession,
    company_id: uuid.UUID,
    data: InstanceCreate,
    started_by: uuid.UUID,
) -> WorkflowInstance:
    """Crée une instance + ses steps à partir du template."""
    tpl_result = await db.execute(
        select(WorkflowTemplate).where(
            WorkflowTemplate.id == data.template_id,
            WorkflowTemplate.company_id == company_id,
            WorkflowTemplate.deleted_at.is_(None),
            WorkflowTemplate.active.is_(True),
        )
    )
    tpl = tpl_result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="template_not_found")

    instance = WorkflowInstance(
        company_id=company_id,
        template_id=tpl.id,
        maintenance_ticket_id=data.maintenance_ticket_id,
        maintenance_quote_id=data.maintenance_quote_id,
        contract_id=data.contract_id,
        status="in_progress",
        started_by=started_by,
    )
    db.add(instance)
    await db.flush()

    # Crée les steps à partir de la définition.
    now = datetime.now(UTC)
    steps_def: list[dict] = tpl.steps_definition or []
    for step_def in sorted(steps_def, key=lambda s: s.get("order", 0)):
        step = WorkflowStep(
            company_id=company_id,
            instance_id=instance.id,
            step_order=step_def.get("order", 0),
            name=step_def.get("name", "step"),
            step_type=step_def.get("step_type", "approval"),
            actor_role=step_def.get("actor_role"),
            status="pending" if step_def.get("order", 0) > 1 else "in_progress",
            sla_due_at=compute_step_sla(step_def.get("sla_hours"), now),
        )
        db.add(step)

    # Journal : event start.
    event = WorkflowEvent(
        company_id=company_id,
        instance_id=instance.id,
        actor_user_id=started_by,
        event_type="start",
        created_at=now,
    )
    db.add(event)

    await db.commit()
    await db.refresh(instance)
    return instance


async def get_instance(
    db: AsyncSession, company_id: uuid.UUID, instance_id: uuid.UUID
) -> WorkflowInstance | None:
    result = await db.execute(
        select(WorkflowInstance).where(
            WorkflowInstance.id == instance_id,
            WorkflowInstance.company_id == company_id,
            WorkflowInstance.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def list_instances(
    db: AsyncSession,
    company_id: uuid.UUID,
    status: str | None = None,
    page: int = 1,
    limit: int = 20,
) -> tuple[list[WorkflowInstance], int]:
    filters = [
        WorkflowInstance.company_id == company_id,
        WorkflowInstance.deleted_at.is_(None),
    ]
    if status:
        filters.append(WorkflowInstance.status == status)
    total = (
        await db.execute(select(func.count()).select_from(WorkflowInstance).where(and_(*filters)))
    ).scalar_one()
    result = await db.execute(
        select(WorkflowInstance)
        .where(and_(*filters))
        .order_by(WorkflowInstance.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    return list(result.scalars().all()), total


async def get_steps(
    db: AsyncSession, company_id: uuid.UUID, instance_id: uuid.UUID
) -> list[WorkflowStep]:
    result = await db.execute(
        select(WorkflowStep)
        .where(
            WorkflowStep.instance_id == instance_id,
            WorkflowStep.company_id == company_id,
        )
        .order_by(WorkflowStep.step_order)
    )
    return list(result.scalars().all())


async def get_steps_map(
    db: AsyncSession, company_id: uuid.UUID, instance_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[WorkflowStep]]:
    """Étapes de plusieurs instances en UNE requête (évite le N+1 du listing).

    Triées par (instance, step_order) → l'ordre des étapes est préservé par instance.
    """
    if not instance_ids:
        return {}
    result = await db.execute(
        select(WorkflowStep)
        .where(
            WorkflowStep.instance_id.in_(instance_ids),
            WorkflowStep.company_id == company_id,
        )
        .order_by(WorkflowStep.instance_id, WorkflowStep.step_order)
    )
    out: dict[uuid.UUID, list[WorkflowStep]] = {}
    for s in result.scalars().all():
        out.setdefault(s.instance_id, []).append(s)
    return out


async def get_events(
    db: AsyncSession, company_id: uuid.UUID, instance_id: uuid.UUID
) -> list[WorkflowEvent]:
    result = await db.execute(
        select(WorkflowEvent)
        .where(
            WorkflowEvent.instance_id == instance_id,
            WorkflowEvent.company_id == company_id,
        )
        .order_by(WorkflowEvent.created_at)
    )
    return list(result.scalars().all())


# ── Actions sur step ──────────────────────────────────────────────────────


async def _act_on_step(
    db: AsyncSession,
    company_id: uuid.UUID,
    instance_id: uuid.UUID,
    step_id: uuid.UUID,
    actor_id: uuid.UUID,
    action: str,  # approve | reject | note | escalate
    comment: str | None,
) -> WorkflowInstance:
    instance = await get_instance(db, company_id, instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="instance_not_found")
    if instance.status != "in_progress":
        raise HTTPException(status_code=422, detail="instance_not_active")

    step_result = await db.execute(
        select(WorkflowStep).where(
            WorkflowStep.id == step_id,
            WorkflowStep.instance_id == instance_id,
            WorkflowStep.company_id == company_id,
        )
    )
    step = step_result.scalar_one_or_none()
    if not step:
        raise HTTPException(status_code=404, detail="step_not_found")

    now = datetime.now(UTC)
    target_status = {
        "approve": "approved",
        "reject": "rejected",
        "escalate": "escalated",
        "note": step.status,  # note ne change pas le statut
    }.get(action, step.status)

    if action != "note" and not is_valid_step_transition(step.status, target_status):
        raise HTTPException(
            status_code=422,
            detail=f"invalid_step_transition: {step.status}→{target_status}",
        )

    step.status = target_status
    if action != "note":
        step.completed_at = now
    if comment:
        step.notes = comment

    # Journal.
    db.add(
        WorkflowEvent(
            company_id=company_id,
            instance_id=instance_id,
            step_id=step_id,
            actor_user_id=actor_id,
            event_type=action,
            comment=comment,
            created_at=now,
        )
    )

    # Avancement de l'instance.
    steps = await get_steps(db, company_id, instance_id)
    if action == "reject":
        instance.status = "rejected"
        instance.completed_at = now
        db.add(
            WorkflowEvent(
                company_id=company_id,
                instance_id=instance_id,
                actor_user_id=actor_id,
                event_type="complete",
                comment="Rejected",
                created_at=now,
            )
        )
    elif action == "approve":
        # Passe au step suivant ou clôture l'instance.
        next_steps = [s for s in steps if s.step_order > step.step_order and s.status == "pending"]
        if next_steps:
            next_steps[0].status = "in_progress"
        else:
            instance.status = "approved"
            instance.completed_at = now
            db.add(
                WorkflowEvent(
                    company_id=company_id,
                    instance_id=instance_id,
                    actor_user_id=actor_id,
                    event_type="complete",
                    comment="All steps approved",
                    created_at=now,
                )
            )

    await db.commit()
    await db.refresh(instance)
    return instance


async def approve_step(
    db, company_id, instance_id, step_id, actor_id, data: StepAction
) -> WorkflowInstance:
    return await _act_on_step(
        db, company_id, instance_id, step_id, actor_id, "approve", data.comment
    )


async def reject_step(
    db, company_id, instance_id, step_id, actor_id, data: StepAction
) -> WorkflowInstance:
    return await _act_on_step(
        db, company_id, instance_id, step_id, actor_id, "reject", data.comment
    )


async def note_step(
    db, company_id, instance_id, step_id, actor_id, data: StepAction
) -> WorkflowInstance:
    return await _act_on_step(db, company_id, instance_id, step_id, actor_id, "note", data.comment)
