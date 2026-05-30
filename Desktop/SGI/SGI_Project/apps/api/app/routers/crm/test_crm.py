"""Tests CRM — scoring (pur), pipeline (transitions), CRUD leads, activités, KPIs.

⚠️ Tests d'intégration (parties DB) : requièrent PostgreSQL via `DATABASE_URL`.
Lancer avec : `docker compose exec api uv run pytest app/routers/crm/test_crm.py`.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.company import Company
from app.models.user import User
from app.routers.crm.schemas import (
    ActivityCreate,
    LeadCreate,
    LeadStatusUpdate,
    LeadUpdate,
)
from app.routers.crm.service import (
    VALID_TRANSITIONS,
    add_activity,
    calculate_score,
    create_lead,
    generate_reference,
    get_lead,
    get_pipeline_kpis,
    list_activities,
    list_leads,
    update_lead,
    update_lead_status,
)

# asyncio_mode=auto : les coroutines de test sont collectées sans marqueur ;
# pas de pytestmark module-level pour ne pas marquer les tests purs (sync).


# ── Référence (pur) ──────────────────────────────────────────────────────────


def test_generate_reference_format() -> None:
    assert generate_reference(2026, 1) == "CRM-2026-000001"
    assert generate_reference(2026, 1847) == "CRM-2026-001847"


def test_generate_reference_sortable() -> None:
    refs = [generate_reference(2026, n) for n in (3, 1, 2, 100)]
    assert sorted(refs) == [generate_reference(2026, n) for n in (1, 2, 3, 100)]


# ── Lead scoring (pur, règles CLAUDE.md) ─────────────────────────────────────


class TestCalculateScore:
    def test_baseline_zero(self) -> None:
        assert calculate_score(None, False, None, 0.0, None) == 0

    def test_budget_golden_visa_threshold(self) -> None:
        assert calculate_score(Decimal("2000000"), False, None, 0.0, None) == 25

    def test_budget_mid_tier(self) -> None:
        assert calculate_score(Decimal("500000"), False, None, 0.0, None) == 15

    def test_budget_below_tiers(self) -> None:
        assert calculate_score(Decimal("499999"), False, None, 0.0, None) == 0

    def test_budget_tier_not_cumulative(self) -> None:
        # ≥2M donne +25 seulement (elif), pas 25+15.
        assert calculate_score(Decimal("3000000"), False, None, 0.0, None) == 25

    def test_golden_visa_eligible(self) -> None:
        assert calculate_score(None, True, None, 0.0, None) == 20

    def test_property_type_specified(self) -> None:
        assert calculate_score(None, False, "apartment", 0.0, None) == 15

    def test_response_rate_scaled(self) -> None:
        assert calculate_score(None, False, None, 1.0, None) == 20
        assert calculate_score(None, False, None, 0.5, None) == 10

    def test_recent_contact_bonus(self) -> None:
        recent = datetime.now(UTC) - timedelta(days=1)
        assert calculate_score(None, False, None, 0.0, recent) == 10

    def test_old_contact_no_bonus(self) -> None:
        old = datetime.now(UTC) - timedelta(days=30)
        assert calculate_score(None, False, None, 0.0, old) == 0

    def test_naive_datetime_assumed_utc(self) -> None:
        recent_naive = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=1)
        assert calculate_score(None, False, None, 0.0, recent_naive) == 10

    def test_combined_high_score(self) -> None:
        recent = datetime.now(UTC) - timedelta(hours=2)
        # 25 + 20 + 15 + 20 + 10 = 90
        assert calculate_score(Decimal("2500000"), True, "villa", 1.0, recent) == 90


# ── Pipeline transitions (constante) ─────────────────────────────────────────


class TestPipelineConstant:
    def test_won_and_lost_terminal(self) -> None:
        assert VALID_TRANSITIONS["won"] == []
        assert VALID_TRANSITIONS["lost"] == []

    def test_canonical_path(self) -> None:
        assert "contacted" in VALID_TRANSITIONS["new"]
        assert "qualified" in VALID_TRANSITIONS["contacted"]
        assert "won" in VALID_TRANSITIONS["negotiation"]


# ── Fixtures DB ──────────────────────────────────────────────────────────────


async def _make_client(db: AsyncSession, company_id: uuid.UUID) -> Client:
    c = Client(
        id=uuid.uuid4(), company_id=company_id, type="individual",
        first_name="Prospect", last_name="Test",
    )
    db.add(c)
    await db.commit()
    return c


async def _lead(db, admin: User, **overrides):
    """Crée un lead via le service (company_id en str, user_id requis)."""
    cid = str(admin.company_id)
    client = await _make_client(db, admin.company_id)
    data = LeadCreate(
        client_id=client.id,
        budget=overrides.pop("budget", Decimal("2000000")),
        property_type=overrides.pop("property_type", "apartment"),
        golden_visa_eligible=overrides.pop("golden_visa_eligible", True),
        **overrides,
    )
    return await create_lead(db, cid, data, admin.id)


# ── CRUD ─────────────────────────────────────────────────────────────────────


async def test_create_lead_initial_score_and_defaults(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    lead = await _lead(db_session, admin)
    assert lead.status == "new"
    assert lead.reference.startswith("CRM-")
    assert lead.contact_attempts == 0
    # budget 2M + golden visa + property_type, sans contact → 25+20+15 = 60
    assert lead.score == 60


async def test_get_lead_cross_tenant_none(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    lead = await _lead(db_session, admin)
    other = Company(
        id=uuid.uuid4(), name="Autre", slug=f"co-{uuid.uuid4().hex[:8]}",
        plan="pro", is_active=True,
    )
    db_session.add(other)
    await db_session.commit()
    assert await get_lead(db_session, str(other.id), lead.id) is None


async def test_list_leads_filter_and_isolation(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    cid = str(admin.company_id)
    await _lead(db_session, admin)
    await _lead(db_session, admin, budget=Decimal("600000"), golden_visa_eligible=False)

    all_leads, total = await list_leads(db_session, cid)
    assert total == 2
    # Tri par score décroissant : le lead le mieux noté en premier.
    assert all_leads[0].score >= all_leads[1].score

    _, n_new = await list_leads(db_session, cid, status="new")
    assert n_new == 2


async def test_update_lead_recomputes_score(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    lead = await _lead(db_session, admin, budget=Decimal("100000"),
                       golden_visa_eligible=False, property_type=None)
    assert lead.score == 0
    updated = await update_lead(
        db_session, str(admin.company_id), lead.id,
        LeadUpdate(budget=Decimal("2000000"), golden_visa_eligible=True),
    )
    assert updated is not None
    assert updated.score == 45  # 25 (budget) + 20 (golden visa)


# ── Transitions de statut ────────────────────────────────────────────────────


async def test_status_valid_transition(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    lead = await _lead(db_session, admin)
    updated = await update_lead_status(
        db_session, str(admin.company_id), lead.id,
        LeadStatusUpdate(status="contacted"), admin.id,
    )
    assert updated is not None and updated.status == "contacted"
    # Une activité status_change est journalisée.
    acts = await list_activities(db_session, str(admin.company_id), lead.id)
    assert any(a.type == "status_change" for a in acts)


async def test_status_invalid_transition_raises_422(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    lead = await _lead(db_session, admin)
    with pytest.raises(HTTPException) as exc:
        await update_lead_status(
            db_session, str(admin.company_id), lead.id,
            LeadStatusUpdate(status="won"), admin.id,  # new → won interdit
        )
    assert exc.value.status_code == 422


async def test_status_lost_requires_reason(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    lead = await _lead(db_session, admin)
    with pytest.raises(HTTPException) as exc:
        await update_lead_status(
            db_session, str(admin.company_id), lead.id,
            LeadStatusUpdate(status="lost"), admin.id,  # sans reason
        )
    assert exc.value.status_code == 422


async def test_status_won_logs_golden_visa_activity(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    cid = str(admin.company_id)
    lead = await _lead(db_session, admin)
    # Chemin valide jusqu'à negotiation puis won (montant ≥ 2M → note Golden Visa).
    for target in ("contacted", "qualified", "proposal_sent", "negotiation"):
        await update_lead_status(db_session, cid, lead.id, LeadStatusUpdate(status=target), admin.id)
    won = await update_lead_status(
        db_session, cid, lead.id,
        LeadStatusUpdate(status="won", won_amount=Decimal("2500000")), admin.id,
    )
    assert won is not None and won.status == "won"
    acts = await list_activities(db_session, cid, lead.id)
    assert any(a.type == "note" and "Golden Visa" in (a.content or "") for a in acts)


# ── Activités ────────────────────────────────────────────────────────────────


async def test_add_activity_call_increments_contacts(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    cid = str(admin.company_id)
    lead = await _lead(db_session, admin)
    await add_activity(
        db_session, cid, ActivityCreate(lead_id=lead.id, type="call"), admin.id
    )
    refreshed = await get_lead(db_session, cid, lead.id)
    assert refreshed is not None
    assert refreshed.contact_attempts == 1
    assert refreshed.last_contact_at is not None


async def test_add_activity_note_does_not_increment(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    cid = str(admin.company_id)
    lead = await _lead(db_session, admin)
    await add_activity(
        db_session, cid, ActivityCreate(lead_id=lead.id, type="note", content="rdv"), admin.id
    )
    refreshed = await get_lead(db_session, cid, lead.id)
    assert refreshed is not None and refreshed.contact_attempts == 0


async def test_add_activity_unknown_lead_404(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    with pytest.raises(HTTPException) as exc:
        await add_activity(
            db_session, str(admin.company_id),
            ActivityCreate(lead_id=uuid.uuid4(), type="call"), admin.id,
        )
    assert exc.value.status_code == 404


# ── KPIs pipeline ────────────────────────────────────────────────────────────


async def test_pipeline_kpis_all_statuses(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    cid = str(admin.company_id)
    await _lead(db_session, admin)
    await _lead(db_session, admin)

    kpis = await get_pipeline_kpis(db_session, cid)
    # Tous les statuts présents, même à 0.
    assert set(kpis.keys()) == set(VALID_TRANSITIONS.keys())
    assert kpis["new"] == 2
    assert kpis["won"] == 0
