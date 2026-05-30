"""Tests Inspections — helpers purs + CRUD (inspection → sections → items → photos).

⚠️ Tests d'intégration (parties DB) : requièrent PostgreSQL via `DATABASE_URL`.
Lancer avec : `docker compose exec api uv run pytest app/routers/inspections/test_inspections.py`.
"""
from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.building import Building
from app.models.company import Company
from app.models.unit import Unit
from app.routers.inspections.schemas import (
    InspectionCreate,
    InspectionUpdate,
    ItemCreate,
    ItemUpdate,
    SectionCreate,
)
from app.routers.inspections.service import (
    add_photo,
    compute_overall_score,
    create_inspection,
    create_item,
    create_section,
    generate_reference,
    get_inspection,
    is_valid_transition,
    list_items,
    list_photos,
    list_sections,
    soft_delete_inspection,
    transition_inspection,
    update_inspection,
    update_item,
)

# ── Helpers purs (conservés) ─────────────────────────────────────────────────


def test_generate_reference() -> None:
    assert generate_reference(2026, 1) == "INS-2026-000001"
    assert generate_reference(2026, 100) == "INS-2026-000100"


def test_generate_reference_sortable() -> None:
    refs = [generate_reference(2026, n) for n in (3, 1, 2)]
    assert sorted(refs) == [generate_reference(2026, n) for n in (1, 2, 3)]


def test_valid_transitions() -> None:
    assert is_valid_transition("draft", "scheduled")
    assert is_valid_transition("in_progress", "completed")
    assert is_valid_transition("completed", "signed")
    assert is_valid_transition("completed", "in_progress")  # réouverture


def test_invalid_transitions() -> None:
    assert not is_valid_transition("signed", "in_progress")
    assert not is_valid_transition("draft", "completed")  # via in_progress
    assert not is_valid_transition("signed", "cancelled")


def test_compute_overall_score_normal() -> None:
    assert compute_overall_score([5, 4, 3]) == pytest.approx(4.0)
    assert compute_overall_score([0, 0]) == pytest.approx(0.0)


def test_compute_overall_score_empty() -> None:
    assert compute_overall_score([]) is None


# ── Fixtures DB ──────────────────────────────────────────────────────────────


async def _unit(db: AsyncSession, company: Company) -> uuid.UUID:
    building = Building(
        id=uuid.uuid4(), company_id=company.id,
        reference=f"BLD-{uuid.uuid4().hex[:10]}", building_type="residential_tower",
    )
    db.add(building)
    await db.commit()
    unit = Unit(
        id=uuid.uuid4(), company_id=company.id, building_id=building.id,
        unit_number=f"U-{uuid.uuid4().hex[:6]}", unit_type="apartment", status="vacant",
    )
    db.add(unit)
    await db.commit()
    return unit.id


async def _inspection(db, company, **overrides):
    unit_id = await _unit(db, company)
    data = InspectionCreate(
        unit_id=unit_id,
        inspection_type=overrides.pop("inspection_type", "check_in"),
        **overrides,
    )
    return await create_inspection(db, company.id, data)


# ── CRUD inspection ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_reference_and_draft(
    db_session: AsyncSession, seed_company: Company
) -> None:
    insp = await _inspection(db_session, seed_company)
    assert insp.reference.startswith("INS-")
    assert insp.status == "draft"


@pytest.mark.asyncio
async def test_get_cross_tenant_none(
    db_session: AsyncSession, seed_company: Company
) -> None:
    insp = await _inspection(db_session, seed_company)
    other = Company(
        id=uuid.uuid4(), name="Autre", slug=f"co-{uuid.uuid4().hex[:8]}",
        plan="pro", is_active=True,
    )
    db_session.add(other)
    await db_session.commit()
    assert await get_inspection(db_session, other.id, insp.id) is None


@pytest.mark.asyncio
async def test_update_inspection(
    db_session: AsyncSession, seed_company: Company
) -> None:
    insp = await _inspection(db_session, seed_company)
    updated = await update_inspection(
        db_session, seed_company.id, insp.id, InspectionUpdate(notes="RAS")
    )
    assert updated is not None and updated.notes == "RAS"


@pytest.mark.asyncio
async def test_soft_delete(
    db_session: AsyncSession, seed_company: Company
) -> None:
    insp = await _inspection(db_session, seed_company)
    assert await soft_delete_inspection(db_session, seed_company.id, insp.id) is True
    assert await get_inspection(db_session, seed_company.id, insp.id) is None


# ── Transitions ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_transition_invalid_422(
    db_session: AsyncSession, seed_company: Company
) -> None:
    insp = await _inspection(db_session, seed_company)
    with pytest.raises(HTTPException) as exc:
        await transition_inspection(db_session, seed_company.id, insp.id, "signed")
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_transition_completed_computes_overall_score(
    db_session: AsyncSession, seed_company: Company
) -> None:
    insp = await _inspection(db_session, seed_company)
    section = await create_section(
        db_session, seed_company.id, insp.id, SectionCreate(name="Salon")
    )
    await create_item(db_session, seed_company.id, section.id, ItemCreate(name="Murs", score=5))
    await create_item(db_session, seed_company.id, section.id, ItemCreate(name="Sol", score=3))

    await transition_inspection(db_session, seed_company.id, insp.id, "in_progress")
    completed = await transition_inspection(db_session, seed_company.id, insp.id, "completed")
    assert completed is not None
    assert completed.completed_at is not None
    assert completed.overall_score == pytest.approx(4.0)  # (5 + 3) / 2


@pytest.mark.asyncio
async def test_transition_signed_sets_signer(
    db_session: AsyncSession, seed_company: Company
) -> None:
    insp = await _inspection(db_session, seed_company)
    await transition_inspection(db_session, seed_company.id, insp.id, "in_progress")
    await transition_inspection(db_session, seed_company.id, insp.id, "completed")
    signed = await transition_inspection(
        db_session, seed_company.id, insp.id, "signed", signed_by="Inspecteur X"
    )
    assert signed is not None
    assert signed.signed_by == "Inspecteur X"
    assert signed.signed_at is not None


# ── Sections / Items / Photos ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_sections_create_and_list(
    db_session: AsyncSession, seed_company: Company
) -> None:
    insp = await _inspection(db_session, seed_company)
    await create_section(db_session, seed_company.id, insp.id, SectionCreate(name="Cuisine", section_order=1))
    await create_section(db_session, seed_company.id, insp.id, SectionCreate(name="Salon", section_order=0))
    sections = await list_sections(db_session, seed_company.id, insp.id)
    assert [s.name for s in sections] == ["Salon", "Cuisine"]  # triées par section_order


@pytest.mark.asyncio
async def test_items_create_list_update(
    db_session: AsyncSession, seed_company: Company
) -> None:
    insp = await _inspection(db_session, seed_company)
    section = await create_section(db_session, seed_company.id, insp.id, SectionCreate(name="S"))
    item = await create_item(
        db_session, seed_company.id, section.id, ItemCreate(name="Fenêtre", score=4)
    )
    items = await list_items(db_session, seed_company.id, section.id)
    assert len(items) == 1 and items[0].score == 4

    updated = await update_item(
        db_session, seed_company.id, item.id, ItemUpdate(score=2, comment="rayure")
    )
    assert updated is not None and updated.score == 2 and updated.comment == "rayure"

    assert await update_item(
        db_session, seed_company.id, uuid.uuid4(), ItemUpdate(score=1)
    ) is None


@pytest.mark.asyncio
async def test_photos_add_and_list(
    db_session: AsyncSession, seed_company: Company
) -> None:
    insp = await _inspection(db_session, seed_company)
    section = await create_section(db_session, seed_company.id, insp.id, SectionCreate(name="S"))
    item = await create_item(db_session, seed_company.id, section.id, ItemCreate(name="Porte"))
    await add_photo(db_session, seed_company.id, item.id, "inspections/p1.jpg", "avant")
    photos = await list_photos(db_session, seed_company.id, item.id)
    assert len(photos) == 1 and photos[0].file_key == "inspections/p1.jpg"
