"""Tests module Vente (sales) — helpers purs + service/HTTP multi-tenant.

⚠️ Tests d'intégration (parties DB/HTTP) : requièrent PostgreSQL via `DATABASE_URL`.
Lancer avec : `docker compose exec api uv run pytest app/routers/sales/test_sales.py`.
"""

from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.company import Company
from app.models.property import Property
from app.models.user import User
from app.routers.sales import service

# ═════════════════════════════════════════════════════════════════════════
# Helpers purs (SANS DB)
# ═════════════════════════════════════════════════════════════════════════


def test_generate_reference() -> None:
    assert service.generate_reference(2026, 42) == "SALE-2026-000042"
    assert service.generate_reference(2026, 1) == "SALE-2026-000001"
    # triable lexicographiquement
    assert service.generate_reference(2026, 5) < service.generate_reference(2026, 50)


class TestComputeCommission:
    def test_normal_rate(self) -> None:
        # 1 000 000 × 2 % = 20 000
        assert service.compute_commission(Decimal("1000000"), Decimal("2")) == Decimal("20000.00")

    def test_fractional_rate(self) -> None:
        # 1 000 000 × 2.5 % = 25 000
        assert service.compute_commission(Decimal("1000000"), Decimal("2.5")) == Decimal("25000.00")

    def test_zero_rate(self) -> None:
        assert service.compute_commission(Decimal("1000000"), Decimal("0")) == Decimal("0.00")

    def test_rounds_half_up(self) -> None:
        # 333333 × 3 % = 9999.99 ; 100001 × 1.5 % = 1500.015 → 1500.02 (HALF_UP)
        assert service.compute_commission(Decimal("100001"), Decimal("1.5")) == Decimal("1500.02")

    def test_result_quantized_two_decimals(self) -> None:
        result = service.compute_commission(Decimal("777777"), Decimal("2.33"))
        assert result.as_tuple().exponent == -2


class TestMandateTransition:
    def test_valid(self) -> None:
        for target in ("sold", "expired", "cancelled"):
            assert service.is_valid_mandate_transition("active", target)

    def test_same_state_invalid(self) -> None:
        assert not service.is_valid_mandate_transition("active", "active")

    def test_terminal_states_have_no_exit(self) -> None:
        for terminal in ("sold", "expired", "cancelled"):
            assert not service.is_valid_mandate_transition(terminal, "active")

    def test_unknown_state(self) -> None:
        assert not service.is_valid_mandate_transition("zzz", "sold")


class TestListingTransition:
    def test_draft(self) -> None:
        assert service.is_valid_listing_transition("draft", "published")
        assert service.is_valid_listing_transition("draft", "withdrawn")
        assert not service.is_valid_listing_transition("draft", "sold")

    def test_published(self) -> None:
        for target in ("under_offer", "withdrawn", "sold"):
            assert service.is_valid_listing_transition("published", target)

    def test_under_offer(self) -> None:
        for target in ("sold", "published", "withdrawn"):
            assert service.is_valid_listing_transition("under_offer", target)

    def test_withdrawn_can_republish(self) -> None:
        assert service.is_valid_listing_transition("withdrawn", "published")
        assert not service.is_valid_listing_transition("withdrawn", "sold")

    def test_sold_is_terminal(self) -> None:
        assert not service.is_valid_listing_transition("sold", "published")
        assert not service.is_valid_listing_transition("sold", "withdrawn")

    def test_same_state_invalid(self) -> None:
        assert not service.is_valid_listing_transition("draft", "draft")


class TestOfferTransition:
    def test_valid(self) -> None:
        for target in ("accepted", "rejected", "withdrawn"):
            assert service.is_valid_offer_transition("submitted", target)

    def test_terminal_states(self) -> None:
        for terminal in ("accepted", "rejected", "withdrawn"):
            assert not service.is_valid_offer_transition(terminal, "submitted")

    def test_same_state_invalid(self) -> None:
        assert not service.is_valid_offer_transition("submitted", "submitted")


class TestTransactionTransition:
    def test_valid(self) -> None:
        assert service.is_valid_transaction_transition("pending", "completed")
        assert service.is_valid_transaction_transition("pending", "cancelled")

    def test_terminal_states(self) -> None:
        assert not service.is_valid_transaction_transition("completed", "pending")
        assert not service.is_valid_transaction_transition("cancelled", "pending")

    def test_same_state_invalid(self) -> None:
        assert not service.is_valid_transaction_transition("pending", "pending")


# ═════════════════════════════════════════════════════════════════════════
# Service (DB)
# ═════════════════════════════════════════════════════════════════════════


async def _seed_client(db: AsyncSession, company_id: uuid.UUID) -> uuid.UUID:
    client = Client(
        id=uuid.uuid4(),
        company_id=company_id,
        type="individual",
        first_name="Vendeur",
        last_name="Test",
    )
    db.add(client)
    await db.commit()
    return client.id


async def _seed_property(db: AsyncSession, company_id: uuid.UUID) -> uuid.UUID:
    prop = Property(
        id=uuid.uuid4(),
        company_id=company_id,
        reference=f"PROP-{uuid.uuid4().hex[:10]}",
        type="apartment",
        price=Decimal("1500000"),
        status="available",
    )
    db.add(prop)
    await db.commit()
    return prop.id


@pytest.mark.asyncio
async def test_create_mandate_reference_and_status(
    db_session: AsyncSession, seed_company: Company
) -> None:
    cid = seed_company.id
    seller = await _seed_client(db_session, cid)
    m = await service.create_mandate(
        db_session, cid, seller_client_id=seller, commission_rate=Decimal("2.5")
    )
    assert m.reference.startswith("SALE-")
    assert m.status == "active"
    assert m.commission_rate == Decimal("2.50")


@pytest.mark.asyncio
async def test_mandate_cross_tenant_none(db_session: AsyncSession, seed_company: Company) -> None:
    cid = seed_company.id
    seller = await _seed_client(db_session, cid)
    m = await service.create_mandate(db_session, cid, seller_client_id=seller)
    assert await service.get_mandate(db_session, uuid.uuid4(), m.id) is None


@pytest.mark.asyncio
async def test_full_pipeline_service(db_session: AsyncSession, seed_company: Company) -> None:
    cid = seed_company.id
    seller = await _seed_client(db_session, cid)
    buyer = await _seed_client(db_session, cid)

    m = await service.create_mandate(
        db_session, cid, seller_client_id=seller, commission_rate=Decimal("2")
    )
    listing = await service.create_listing(
        db_session, cid, mandate_id=m.id, list_price=Decimal("1000000")
    )
    assert listing.status == "draft"
    offer = await service.create_offer(
        db_session, cid, listing_id=listing.id, buyer_client_id=buyer, amount=Decimal("950000")
    )
    # offre acceptée
    accepted = await service.transition_offer(db_session, cid, offer.id, "accepted")
    assert accepted is not None and accepted.status == "accepted"
    assert accepted.decided_at is not None

    tx = await service.create_transaction_from_offer(
        db_session, cid, offer=accepted, listing=listing, mandate=m
    )
    # commission = 950 000 × 2 % = 19 000
    assert tx.final_price == Decimal("950000")
    assert tx.commission_amount == Decimal("19000.00")
    assert tx.status == "pending"

    done = await service.transition_transaction(db_session, cid, tx.id, "completed")
    assert done is not None and done.status == "completed" and done.closed_at is not None


@pytest.mark.asyncio
async def test_invalid_transition_raises(db_session: AsyncSession, seed_company: Company) -> None:
    cid = seed_company.id
    seller = await _seed_client(db_session, cid)
    m = await service.create_mandate(db_session, cid, seller_client_id=seller)
    with pytest.raises(ValueError, match="invalid_transition"):
        await service.transition_mandate(db_session, cid, m.id, "active")


@pytest.mark.asyncio
async def test_listing_published_sets_published_at(
    db_session: AsyncSession, seed_company: Company
) -> None:
    cid = seed_company.id
    seller = await _seed_client(db_session, cid)
    m = await service.create_mandate(db_session, cid, seller_client_id=seller)
    listing = await service.create_listing(
        db_session, cid, mandate_id=m.id, list_price=Decimal("500000")
    )
    pub = await service.transition_listing(db_session, cid, listing.id, "published")
    assert pub is not None and pub.published_at is not None


# ═════════════════════════════════════════════════════════════════════════
# HTTP (intégration)
# ═════════════════════════════════════════════════════════════════════════


async def test_health_is_public(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/sales/health")
    assert resp.status_code == 200
    assert resp.json()["module"] == "sales"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _create_client_http(db_session: AsyncSession, company_id: uuid.UUID) -> uuid.UUID:
    return await _seed_client(db_session, company_id)


@pytest.mark.asyncio
async def test_http_full_pipeline_and_commission(
    client: AsyncClient,
    db_session: AsyncSession,
    seed_admin: tuple[User, str],
) -> None:
    admin, token = seed_admin
    cid = admin.company_id
    seller = await _seed_client(db_session, cid)
    buyer = await _seed_client(db_session, cid)
    prop = await _seed_property(db_session, cid)

    # mandat
    r = await client.post(
        "/api/v1/sales/mandates",
        headers=_auth(token),
        json={
            "seller_client_id": str(seller),
            "property_id": str(prop),
            "commission_rate": "2",
        },
    )
    assert r.status_code == 201, r.text
    mandate_id = r.json()["data"]["id"]

    # annonce
    r = await client.post(
        "/api/v1/sales/listings",
        headers=_auth(token),
        json={"mandate_id": mandate_id, "list_price": "1000000", "title_en": "Nice villa"},
    )
    assert r.status_code == 201, r.text
    listing_id = r.json()["data"]["id"]

    # offre
    r = await client.post(
        "/api/v1/sales/offers",
        headers=_auth(token),
        json={"listing_id": listing_id, "buyer_client_id": str(buyer), "amount": "900000"},
    )
    assert r.status_code == 201, r.text
    offer_id = r.json()["data"]["id"]

    # accepter l'offre
    r = await client.post(
        f"/api/v1/sales/offers/{offer_id}/transition",
        headers=_auth(token),
        json={"status": "accepted"},
    )
    assert r.status_code == 200, r.text

    # transaction → commission = 900 000 × 2 % = 18 000
    r = await client.post(
        "/api/v1/sales/transactions",
        headers=_auth(token),
        json={"offer_id": offer_id},
    )
    assert r.status_code == 201, r.text
    body = r.json()["data"]
    assert body["final_price"] == "900000.00"
    expected = service.compute_commission(Decimal("900000"), Decimal("2"))
    assert Decimal(body["commission_amount"]) == expected == Decimal("18000.00")

    # garde anti-double-comptabilisation : 2e transaction sur la même offre → 409
    r = await client.post(
        "/api/v1/sales/transactions",
        headers=_auth(token),
        json={"offer_id": offer_id},
    )
    assert r.status_code == 409, r.text
    assert r.json()["detail"] == "transaction_already_exists"

    # liste enveloppée {success,data,meta}
    r = await client.get("/api/v1/sales/transactions", headers=_auth(token))
    assert r.status_code == 200
    payload = r.json()
    assert payload["success"] is True
    assert payload["meta"]["total"] >= 1


@pytest.mark.asyncio
async def test_http_tenant_isolation(
    client: AsyncClient,
    db_session: AsyncSession,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
) -> None:
    admin, token = seed_admin
    _other_company, other_token = second_admin
    cid = admin.company_id
    seller = await _seed_client(db_session, cid)

    r = await client.post(
        "/api/v1/sales/mandates",
        headers=_auth(token),
        json={"seller_client_id": str(seller)},
    )
    assert r.status_code == 201
    mandate_id = r.json()["data"]["id"]

    # Loi 1 : invisible pour l'autre tenant → 404 anti-BOLA.
    r = await client.get(f"/api/v1/sales/mandates/{mandate_id}", headers=_auth(other_token))
    assert r.status_code == 404

    # la liste de l'autre tenant ne contient pas ce mandat.
    r = await client.get("/api/v1/sales/mandates", headers=_auth(other_token))
    assert r.status_code == 200
    ids = [m["id"] for m in r.json()["data"]]
    assert mandate_id not in ids


@pytest.mark.asyncio
async def test_http_404_anti_bola(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    r = await client.get(f"/api/v1/sales/mandates/{uuid.uuid4()}", headers=_auth(token))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_http_409_invalid_transition(
    client: AsyncClient,
    db_session: AsyncSession,
    seed_admin: tuple[User, str],
) -> None:
    admin, token = seed_admin
    cid = admin.company_id
    seller = await _seed_client(db_session, cid)
    r = await client.post(
        "/api/v1/sales/mandates",
        headers=_auth(token),
        json={"seller_client_id": str(seller)},
    )
    mandate_id = r.json()["data"]["id"]
    # active → active : invalide → 409
    r = await client.post(
        f"/api/v1/sales/mandates/{mandate_id}/transition",
        headers=_auth(token),
        json={"status": "cancelled"},
    )
    assert r.status_code == 200
    # cancelled est terminal → toute transition échoue 409
    r = await client.post(
        f"/api/v1/sales/mandates/{mandate_id}/transition",
        headers=_auth(token),
        json={"status": "sold"},
    )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_http_transaction_requires_accepted_offer(
    client: AsyncClient,
    db_session: AsyncSession,
    seed_admin: tuple[User, str],
) -> None:
    admin, token = seed_admin
    cid = admin.company_id
    seller = await _seed_client(db_session, cid)
    buyer = await _seed_client(db_session, cid)

    r = await client.post(
        "/api/v1/sales/mandates", headers=_auth(token), json={"seller_client_id": str(seller)}
    )
    mandate_id = r.json()["data"]["id"]
    r = await client.post(
        "/api/v1/sales/listings",
        headers=_auth(token),
        json={"mandate_id": mandate_id, "list_price": "800000"},
    )
    listing_id = r.json()["data"]["id"]
    r = await client.post(
        "/api/v1/sales/offers",
        headers=_auth(token),
        json={"listing_id": listing_id, "buyer_client_id": str(buyer), "amount": "750000"},
    )
    offer_id = r.json()["data"]["id"]

    # offre encore 'submitted' → 409
    r = await client.post(
        "/api/v1/sales/transactions", headers=_auth(token), json={"offer_id": offer_id}
    )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_http_create_mandate_rejects_foreign_client(
    client: AsyncClient,
    db_session: AsyncSession,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
) -> None:
    _admin, token = seed_admin
    other_company, _other_token = second_admin
    # client appartenant à l'AUTRE tenant
    foreign_client = await _seed_client(db_session, other_company.id)
    r = await client.post(
        "/api/v1/sales/mandates",
        headers=_auth(token),
        json={"seller_client_id": str(foreign_client)},
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "client_not_in_company"
