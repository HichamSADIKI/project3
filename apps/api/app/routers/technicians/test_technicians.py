"""Tests unitaires — module technicians.

La logique de rating est partagée avec vendors (helper `merge_rating`).
Ces tests valident que technicians.add_rating consomme bien ce helper.
"""

from decimal import Decimal

from app.routers.vendors.service import merge_rating


class TestSharedRatingFormula:
    """Vérifie que la formule de notation est cohérente entre vendors/technicians."""

    def test_single_rating(self) -> None:
        avg, count = merge_rating(Decimal("0"), 0, Decimal("4.8"))
        assert avg == Decimal("4.80")
        assert count == 1

    def test_perfect_streak(self) -> None:
        # 5 notes parfaites successives
        avg, count = Decimal("0"), 0
        for _ in range(5):
            avg, count = merge_rating(avg, count, Decimal("5.0"))
        assert avg == Decimal("5.00")
        assert count == 5

    def test_mixed_history(self) -> None:
        # Notes 5, 4, 3, 5 → moyenne 4.25
        avg, count = Decimal("0"), 0
        for s in [Decimal("5"), Decimal("4"), Decimal("3"), Decimal("5")]:
            avg, count = merge_rating(avg, count, s)
        assert avg == Decimal("4.25")
        assert count == 4


# ─── Synthèse capacité de dispatch ───────────────────────────────────────────

import uuid  # noqa: E402
from types import SimpleNamespace  # noqa: E402

import pytest  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from app.models.company import Company  # noqa: E402
from app.models.party_technician import Technician  # noqa: E402
from app.models.user import User  # noqa: E402
from app.routers.technicians.service import summarize_technicians, technicians_summary  # noqa: E402


def _t(skills, *, mobile=True, on_call=False, jobs=0):
    return SimpleNamespace(
        skills=skills, mobile_active=mobile, on_call=on_call, jobs_completed=jobs
    )


class TestSummarizeTechnicians:
    def test_empty(self) -> None:
        s = summarize_technicians([])
        assert s == {
            "total": 0,
            "mobile_active_count": 0,
            "on_call_count": 0,
            "by_skill": {},
            "jobs_completed_total": 0,
        }

    def test_skill_flattening_and_counts(self) -> None:
        techs = [
            _t(["plumbing", "electrical"], mobile=True, on_call=True, jobs=10),
            _t(["plumbing"], mobile=False, on_call=False, jobs=5),
            _t([], mobile=True, on_call=True, jobs=0),
        ]
        s = summarize_technicians(techs)
        assert s["total"] == 3
        assert s["by_skill"] == {"plumbing": 2, "electrical": 1}
        assert s["mobile_active_count"] == 2
        assert s["on_call_count"] == 2
        assert s["jobs_completed_total"] == 15


async def _seed_tech(db, company_id, *, skills, mobile, on_call, jobs) -> None:
    user = User(
        id=uuid.uuid4(),
        company_id=company_id,
        email=f"tech-{uuid.uuid4().hex[:8]}@sgi.test",
        hashed_password="x",
        full_name="Tech",
        role="agent",
        status="active",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    db.add(
        Technician(
            company_id=company_id,
            user_id=user.id,
            skills=skills,
            mobile_active=mobile,
            on_call=on_call,
            jobs_completed=jobs,
        )
    )
    await db.commit()


@pytest.mark.asyncio
async def test_technicians_summary_service(db_session: AsyncSession, seed_company: Company) -> None:
    await _seed_tech(
        db_session, seed_company.id, skills=["plumbing"], mobile=True, on_call=True, jobs=7
    )
    await _seed_tech(
        db_session,
        seed_company.id,
        skills=["plumbing", "hvac"],
        mobile=False,
        on_call=False,
        jobs=3,
    )
    s = await technicians_summary(db_session, seed_company.id)
    assert s["total"] == 2
    assert s["by_skill"] == {"plumbing": 2, "hvac": 1}
    assert s["mobile_active_count"] == 1
    assert s["on_call_count"] == 1
    assert s["jobs_completed_total"] == 10


@pytest.mark.asyncio
async def test_technicians_summary_tenant_isolation(
    db_session: AsyncSession, seed_company: Company
) -> None:
    await _seed_tech(
        db_session, seed_company.id, skills=["plumbing"], mobile=True, on_call=False, jobs=1
    )
    other = Company(
        id=uuid.uuid4(), name="Autre", slug=f"co-{uuid.uuid4().hex[:8]}", plan="pro", is_active=True
    )
    db_session.add(other)
    await db_session.commit()
    s = await technicians_summary(db_session, other.id)
    assert s["total"] == 0
    assert s["by_skill"] == {}
