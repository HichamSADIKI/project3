"""Tests unitaires — helpers métier purs du module vendors."""

from datetime import date
from decimal import Decimal

import pytest

from app.routers.vendors.service import (
    cancellation_rate,
    is_eligible_for_marketplace,
    merge_rating,
)

# ─── merge_rating ──────────────────────────────────────────────────────────


class TestMergeRating:
    def test_first_rating_becomes_average(self) -> None:
        avg, count = merge_rating(Decimal("0"), 0, Decimal("4.5"))
        assert avg == Decimal("4.50")
        assert count == 1

    def test_second_rating_updates_average_correctly(self) -> None:
        avg, count = merge_rating(Decimal("4.0"), 1, Decimal("5.0"))
        assert avg == Decimal("4.50")
        assert count == 2

    def test_low_rating_pulls_average_down(self) -> None:
        # 10 notes à 5.0 puis une à 1.0 → 51/11 = 4.6363... → 4.64
        avg, count = merge_rating(Decimal("5.00"), 10, Decimal("1.0"))
        assert avg == Decimal("4.64")
        assert count == 11

    def test_rounding_to_two_decimals(self) -> None:
        avg, _ = merge_rating(Decimal("3.33"), 3, Decimal("5.0"))
        # (3.33*3 + 5) / 4 = 14.99 / 4 = 3.7475 → 3.75
        assert avg == Decimal("3.75")


# ─── cancellation_rate ─────────────────────────────────────────────────────


class TestCancellationRate:
    def test_zero_when_no_jobs(self) -> None:
        assert cancellation_rate(0, 0) == Decimal("0.00")

    def test_zero_when_no_cancellations(self) -> None:
        assert cancellation_rate(20, 0) == Decimal("0.00")

    def test_full_when_only_cancellations(self) -> None:
        assert cancellation_rate(0, 5) == Decimal("100.00")

    def test_realistic_mix(self) -> None:
        # 18 réussies + 2 annulées → 10 %
        assert cancellation_rate(18, 2) == Decimal("10.00")


# ─── is_eligible_for_marketplace ───────────────────────────────────────────


class TestMarketplaceEligibility:
    today = date(2026, 5, 28)

    def test_inactive_vendor_not_eligible(self) -> None:
        assert (
            is_eligible_for_marketplace(False, Decimal("4.5"), 10, date(2027, 1, 1), self.today)
            is False
        )

    def test_expired_licence_not_eligible(self) -> None:
        assert (
            is_eligible_for_marketplace(True, Decimal("4.5"), 10, date(2026, 5, 27), self.today)
            is False
        )

    def test_no_ratings_yet_is_eligible(self) -> None:
        # Nouveau prestataire (rating_count=0) doit pouvoir entrer
        assert (
            is_eligible_for_marketplace(True, Decimal("0"), 0, date(2027, 1, 1), self.today) is True
        )

    def test_rating_above_threshold_eligible(self) -> None:
        assert (
            is_eligible_for_marketplace(True, Decimal("3.5"), 10, date(2027, 1, 1), self.today)
            is True
        )

    def test_rating_below_threshold_not_eligible(self) -> None:
        assert (
            is_eligible_for_marketplace(True, Decimal("3.49"), 10, date(2027, 1, 1), self.today)
            is False
        )

    def test_licence_none_is_allowed(self) -> None:
        # Licence non renseignée → on ne bloque pas (validation faite ailleurs)
        assert is_eligible_for_marketplace(True, Decimal("4.0"), 5, None, self.today) is True

    def test_pending_verification_not_eligible(self) -> None:
        # Profil non validé par un admin → jamais éligible, même bien noté.
        assert (
            is_eligible_for_marketplace(
                True, Decimal("4.8"), 10, date(2027, 1, 1), self.today, "pending"
            )
            is False
        )

    def test_rejected_verification_not_eligible(self) -> None:
        assert (
            is_eligible_for_marketplace(
                True, Decimal("4.8"), 10, date(2027, 1, 1), self.today, "rejected"
            )
            is False
        )

    def test_verified_default_is_eligible(self) -> None:
        # Le défaut 'verified' garde la rétro-compatibilité des fiches anciennes.
        assert (
            is_eligible_for_marketplace(True, Decimal("4.8"), 10, date(2027, 1, 1), self.today)
            is True
        )


# ─── extract_trade_licence (OCR best-effort) ───────────────────────────────


class TestTradeLicenceExtraction:
    @pytest.mark.asyncio
    async def test_unsupported_mime_returns_empty(self) -> None:
        from app.core.gemini import extract_trade_licence

        out = await extract_trade_licence(b"plain text", "text/plain")
        assert out["engine"] == "unsupported_mime"
        assert out["trade_licence_number"] is None
        assert out["confidence"] == 0.0

    @pytest.mark.asyncio
    async def test_empty_document_returns_empty(self) -> None:
        from app.core.gemini import extract_trade_licence

        out = await extract_trade_licence(b"", "application/pdf")
        assert out["engine"] == "unsupported_mime"


# ─── Synthèse annuaire fournisseurs ──────────────────────────────────────────

import uuid  # noqa: E402
from types import SimpleNamespace  # noqa: E402

from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from app.models.client import Client  # noqa: E402
from app.models.company import Company  # noqa: E402
from app.models.party_vendor import Vendor  # noqa: E402
from app.routers.vendors.service import summarize_vendors, vendors_summary  # noqa: E402


def _v(vendor_type: str, verification: str, active: bool):
    return SimpleNamespace(
        vendor_type=vendor_type, verification_status=verification, is_active=active
    )


class TestSummarizeVendors:
    def test_empty(self) -> None:
        s = summarize_vendors([])
        assert s == {
            "by_type": {},
            "by_verification": {},
            "active_count": 0,
            "verified_count": 0,
            "total": 0,
        }

    def test_counts(self) -> None:
        vendors = [
            _v("plumbing", "verified", True),
            _v("plumbing", "pending", True),
            _v("electrical", "verified", False),
            _v("electrical", "rejected", True),
        ]
        s = summarize_vendors(vendors)
        assert s["total"] == 4
        assert s["by_type"] == {"plumbing": 2, "electrical": 2}
        assert s["by_verification"] == {"verified": 2, "pending": 1, "rejected": 1}
        assert s["active_count"] == 3
        assert s["verified_count"] == 2


async def _seed_vendor(
    db, company_id, *, vendor_type: str, verification: str, active: bool
) -> None:
    client = Client(id=uuid.uuid4(), company_id=company_id, type="company", company_name="Vend Co")
    db.add(client)
    await db.flush()
    db.add(
        Vendor(
            company_id=company_id,
            party_id=client.id,
            vendor_type=vendor_type,
            categories=[vendor_type],
            verification_status=verification,
            is_active=active,
        )
    )
    await db.commit()


@pytest.mark.asyncio
async def test_vendors_summary_service(db_session: AsyncSession, seed_company: Company) -> None:
    await _seed_vendor(
        db_session, seed_company.id, vendor_type="plumbing", verification="verified", active=True
    )
    await _seed_vendor(
        db_session, seed_company.id, vendor_type="electrical", verification="pending", active=False
    )
    s = await vendors_summary(db_session, seed_company.id)
    assert s["total"] == 2
    assert s["by_type"] == {"plumbing": 1, "electrical": 1}
    assert s["active_count"] == 1
    assert s["verified_count"] == 1


@pytest.mark.asyncio
async def test_vendors_summary_tenant_isolation(
    db_session: AsyncSession, seed_company: Company
) -> None:
    await _seed_vendor(
        db_session, seed_company.id, vendor_type="plumbing", verification="verified", active=True
    )
    other = Company(
        id=uuid.uuid4(), name="Autre", slug=f"co-{uuid.uuid4().hex[:8]}", plan="pro", is_active=True
    )
    db_session.add(other)
    await db_session.commit()
    s = await vendors_summary(db_session, other.id)
    assert s["total"] == 0
    assert s["by_type"] == {}
