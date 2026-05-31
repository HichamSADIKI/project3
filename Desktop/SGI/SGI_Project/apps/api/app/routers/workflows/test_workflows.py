"""Tests Workflow Engine — helpers purs + moteur (template→instance→steps→events).

⚠️ Tests d'intégration (parties DB) : requièrent PostgreSQL via `DATABASE_URL`.
Lancer avec : `docker compose exec api uv run pytest app/routers/workflows/test_workflows.py`.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.user import User
from app.routers.workflows.schemas import (
    InstanceCreate,
    StepAction,
    StepDef,
    TemplateCreate,
)
from app.routers.workflows.service import (
    approve_step,
    compute_step_sla,
    create_template,
    get_events,
    get_instance,
    get_steps,
    is_step_sla_breached,
    is_valid_instance_transition,
    is_valid_step_transition,
    list_instances,
    list_templates,
    note_step,
    reject_step,
    start_workflow,
)


def test_valid_step_transitions() -> None:
    assert is_valid_step_transition("pending", "in_progress")
    assert is_valid_step_transition("in_progress", "approved")
    assert is_valid_step_transition("in_progress", "rejected")
    assert is_valid_step_transition("in_progress", "escalated")
    assert is_valid_step_transition("escalated", "in_progress")


def test_invalid_step_transitions() -> None:
    assert not is_valid_step_transition("approved", "rejected")
    assert not is_valid_step_transition("rejected", "approved")
    assert not is_valid_step_transition("pending", "approved")  # doit passer par in_progress


def test_valid_instance_transitions() -> None:
    assert is_valid_instance_transition("in_progress", "approved")
    assert is_valid_instance_transition("in_progress", "rejected")
    assert is_valid_instance_transition("in_progress", "cancelled")


def test_invalid_instance_transitions() -> None:
    assert not is_valid_instance_transition("approved", "rejected")
    assert not is_valid_instance_transition("cancelled", "in_progress")


def test_compute_step_sla_with_hours() -> None:
    now = datetime(2026, 5, 30, 10, 0, tzinfo=UTC)
    due = compute_step_sla(24, now)
    assert due == now + timedelta(hours=24)


def test_compute_step_sla_none() -> None:
    now = datetime(2026, 5, 30, tzinfo=UTC)
    assert compute_step_sla(None, now) is None
    assert compute_step_sla(0, now) is None


def test_step_sla_breached() -> None:
    step = MagicMock()
    step.status = "in_progress"
    step.sla_due_at = datetime.now(UTC) - timedelta(hours=1)
    assert is_step_sla_breached(step) is True


def test_step_sla_not_breached() -> None:
    step = MagicMock()
    step.status = "in_progress"
    step.sla_due_at = datetime.now(UTC) + timedelta(hours=5)
    assert is_step_sla_breached(step) is False


def test_step_sla_terminal_status() -> None:
    for terminal in ("approved", "rejected", "skipped", "escalated"):
        step = MagicMock()
        step.status = terminal
        step.sla_due_at = datetime.now(UTC) - timedelta(hours=1)
        assert is_step_sla_breached(step) is False, terminal


# ── Fixtures DB ──────────────────────────────────────────────────────────────


def _two_step_template() -> TemplateCreate:
    return TemplateCreate(
        name="Validation devis",
        workflow_type="quote_approval",
        steps_definition=[
            StepDef(order=1, name="Manager", step_type="approval", actor_role="manager"),
            StepDef(order=2, name="Direction", step_type="approval", actor_role="admin"),
        ],
    )


async def _start(db, company, admin):
    tpl = await create_template(db, company.id, _two_step_template())
    inst = await start_workflow(db, company.id, InstanceCreate(template_id=tpl.id), admin.id)
    return tpl, inst


# ── Templates ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_and_list_templates(db_session: AsyncSession, seed_company: Company) -> None:
    tpl = await create_template(db_session, seed_company.id, _two_step_template())
    assert tpl.active is True
    assert len(tpl.steps_definition) == 2
    templates = await list_templates(db_session, seed_company.id)
    assert any(t.id == tpl.id for t in templates)


# ── Démarrage d'instance ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_start_workflow_creates_steps_and_event(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    company = Company(id=admin.company_id, name="x", slug="x")
    _tpl, inst = await _start(db_session, company, admin)

    assert inst.status == "in_progress"
    steps = await get_steps(db_session, company.id, inst.id)
    assert [s.step_order for s in steps] == [1, 2]
    # Le 1er step démarre actif, le 2nd en attente.
    assert steps[0].status == "in_progress"
    assert steps[1].status == "pending"
    # Un événement 'start' est journalisé.
    events = await get_events(db_session, company.id, inst.id)
    assert any(e.event_type == "start" for e in events)


@pytest.mark.asyncio
async def test_start_workflow_unknown_template_404(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    with pytest.raises(HTTPException) as exc:
        await start_workflow(
            db_session,
            admin.company_id,
            InstanceCreate(template_id=uuid.uuid4()),
            admin.id,
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_get_instance_cross_tenant_none(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    company = Company(id=admin.company_id, name="x", slug="x")
    _tpl, inst = await _start(db_session, company, admin)
    other = Company(
        id=uuid.uuid4(),
        name="Autre",
        slug=f"co-{uuid.uuid4().hex[:8]}",
        plan="pro",
        is_active=True,
    )
    db_session.add(other)
    await db_session.commit()
    assert await get_instance(db_session, other.id, inst.id) is None


@pytest.mark.asyncio
async def test_list_instances_status_filter(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    company = Company(id=admin.company_id, name="x", slug="x")
    await _start(db_session, company, admin)
    _, n = await list_instances(db_session, company.id, status="in_progress")
    assert n >= 1


# ── Actions sur steps ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_approve_advances_then_completes_instance(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    company = Company(id=admin.company_id, name="x", slug="x")
    _tpl, inst = await _start(db_session, company, admin)
    steps = await get_steps(db_session, company.id, inst.id)

    # Approuve le step 1 → le step 2 passe in_progress, l'instance reste in_progress.
    after1 = await approve_step(
        db_session, company.id, inst.id, steps[0].id, admin.id, StepAction(comment="ok")
    )
    assert after1.status == "in_progress"
    steps = await get_steps(db_session, company.id, inst.id)
    assert steps[1].status == "in_progress"

    # Approuve le step 2 (dernier) → l'instance est approved + completed_at.
    after2 = await approve_step(
        db_session, company.id, inst.id, steps[1].id, admin.id, StepAction()
    )
    assert after2.status == "approved"
    assert after2.completed_at is not None


@pytest.mark.asyncio
async def test_reject_marks_instance_rejected(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    company = Company(id=admin.company_id, name="x", slug="x")
    _tpl, inst = await _start(db_session, company, admin)
    steps = await get_steps(db_session, company.id, inst.id)
    after = await reject_step(
        db_session, company.id, inst.id, steps[0].id, admin.id, StepAction(comment="non")
    )
    assert after.status == "rejected"
    assert after.completed_at is not None


@pytest.mark.asyncio
async def test_note_does_not_change_step_status(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    company = Company(id=admin.company_id, name="x", slug="x")
    _tpl, inst = await _start(db_session, company, admin)
    steps = await get_steps(db_session, company.id, inst.id)
    before = steps[0].status
    await note_step(
        db_session, company.id, inst.id, steps[0].id, admin.id, StepAction(comment="info")
    )
    steps_after = await get_steps(db_session, company.id, inst.id)
    assert steps_after[0].status == before
    events = await get_events(db_session, company.id, inst.id)
    assert any(e.event_type == "note" for e in events)


@pytest.mark.asyncio
async def test_act_unknown_instance_404(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    with pytest.raises(HTTPException) as exc:
        await approve_step(
            db_session, admin.company_id, uuid.uuid4(), uuid.uuid4(), admin.id, StepAction()
        )
    assert exc.value.status_code == 404


# ── Tests d'intégration ENDPOINT (auth HTTP + contexte tenant + machine à états) ──
# Passent par le client HTTP (JWT + middleware + get_db_session) — couvrent la
# couche réseau/auth que les tests « service » ci-dessus n'exercent pas.

from httpx import AsyncClient  # noqa: E402


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _create_instance_http(client: AsyncClient, token: str) -> tuple[str, str]:
    """Crée un template (2 étapes d'approbation) + une instance ;
    renvoie (instance_id, id de la 1ʳᵉ étape — en in_progress)."""
    tpl = await client.post(
        "/api/v1/workflows/templates",
        headers=_auth(token),
        json={
            "name": "Validation devis",
            "workflow_type": "quote_approval",
            "steps_definition": [
                {
                    "order": 1,
                    "name": "Revue manager",
                    "step_type": "approval",
                    "actor_role": "manager",
                    "sla_hours": 24,
                },
                {
                    "order": 2,
                    "name": "Signature admin",
                    "step_type": "approval",
                    "actor_role": "admin",
                    "sla_hours": 4,
                },
            ],
        },
    )
    assert tpl.status_code == 201, tpl.text
    template_id = tpl.json()["id"]
    inst = await client.post(
        "/api/v1/workflows/instances",
        headers=_auth(token),
        json={"template_id": template_id},
    )
    assert inst.status_code == 201, inst.text
    data = inst.json()["data"]
    return data["id"], data["steps"][0]["id"]


async def test_workflows_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/workflows/instances")
    assert resp.status_code in (401, 403)


async def test_create_then_list_instance_http(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    instance_id, _step_id = await _create_instance_http(client, token)

    listed = await client.get("/api/v1/workflows/instances", headers=_auth(token))
    assert listed.status_code == 200, listed.text
    ids = [i["id"] for i in listed.json()["data"]]
    assert instance_id in ids


async def test_approve_step_then_reapprove_422_http(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    instance_id, step_id = await _create_instance_http(client, token)
    # 1ʳᵉ étape in_progress → approved : autorisé.
    approve = await client.post(
        f"/api/v1/workflows/instances/{instance_id}/steps/{step_id}/approve",
        headers=_auth(token),
        json={},
    )
    assert approve.status_code == 200, approve.text
    # Ré-approuver une étape déjà approuvée : transition interdite.
    again = await client.post(
        f"/api/v1/workflows/instances/{instance_id}/steps/{step_id}/approve",
        headers=_auth(token),
        json={},
    )
    assert again.status_code == 422, again.text
    assert again.json()["detail"].startswith("invalid_step_transition")


async def test_instance_tenant_isolation_http(
    client: AsyncClient, seed_admin: tuple[User, str], second_admin: tuple[Company, str]
) -> None:
    """Une instance de workflow de la société A n'est pas visible par B (Loi 1)."""
    _admin, token_a = seed_admin
    _company_b, token_b = second_admin
    instance_id, _step_id = await _create_instance_http(client, token_a)

    list_b = await client.get("/api/v1/workflows/instances", headers=_auth(token_b))
    assert list_b.status_code == 200
    ids_b = [i["id"] for i in list_b.json()["data"]]
    assert instance_id not in ids_b
