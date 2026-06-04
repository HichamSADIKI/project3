"""Tests module Social — helpers purs + endpoints (multi-tenant, BOLA)."""

from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.company import Company
from app.models.user import User
from app.routers.sales import service as sales_service
from app.routers.social import service

# ── Helpers purs ─────────────────────────────────────────────────────────────


class TestIsValidChannel:
    def test_known_channels(self) -> None:
        for ch in ("facebook", "instagram", "linkedin", "x", "whatsapp", "tiktok", "snapchat"):
            assert service.is_valid_channel(ch) is True

    def test_unknown_channel(self) -> None:
        assert service.is_valid_channel("myspace") is False
        assert service.is_valid_channel("") is False


class TestIsValidListingType:
    def test_valid(self) -> None:
        assert service.is_valid_listing_type("sale") is True
        assert service.is_valid_listing_type("rent") is True

    def test_invalid(self) -> None:
        assert service.is_valid_listing_type("lease") is False


class TestBuildShareUrl:
    def test_facebook_encodes_url(self) -> None:
        out = service.build_share_url("facebook", "https://x.ae/p/villa-1")
        assert "facebook.com/sharer" in out
        assert "https%3A%2F%2Fx.ae" in out

    def test_whatsapp(self) -> None:
        assert service.build_share_url("whatsapp", "https://x.ae/p/1").startswith("https://wa.me/")

    def test_instagram_falls_back_to_public_url(self) -> None:
        assert service.build_share_url("instagram", "https://x.ae/p/1") == "https://x.ae/p/1"


# ── Fixtures de données ──────────────────────────────────────────────────────


async def _seed_sale_listing(db: AsyncSession, company_id: uuid.UUID) -> uuid.UUID:
    seller = Client(
        id=uuid.uuid4(),
        company_id=company_id,
        type="individual",
        first_name="Seller",
        last_name="Test",
    )
    db.add(seller)
    await db.flush()
    mandate = await sales_service.create_mandate(db, company_id, seller_client_id=seller.id)
    listing = await sales_service.create_listing(
        db, company_id, mandate_id=mandate.id, list_price=Decimal("1500000"), title_en="Test Villa"
    )
    return listing.id


# ── Endpoints ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_channels_endpoint(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _, token = seed_admin
    res = await client.get("/api/v1/social/channels", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()["data"]
    assert "facebook" in data and "instagram" in data
    assert len(data) == 7


@pytest.mark.asyncio
async def test_publish_unknown_listing_404(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _, token = seed_admin
    res = await client.post(
        "/api/v1/social/posts",
        headers={"Authorization": f"Bearer {token}"},
        json={"listing_type": "sale", "listing_id": str(uuid.uuid4()), "channel": "facebook"},
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_publish_invalid_channel_400(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    db_session: AsyncSession,
    seed_company: Company,
) -> None:
    _, token = seed_admin
    listing_id = await _seed_sale_listing(db_session, seed_company.id)
    res = await client.post(
        "/api/v1/social/posts",
        headers={"Authorization": f"Bearer {token}"},
        json={"listing_type": "sale", "listing_id": str(listing_id), "channel": "myspace"},
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_publish_list_idempotent_and_unpublish(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    db_session: AsyncSession,
    seed_company: Company,
) -> None:
    _, token = seed_admin
    h = {"Authorization": f"Bearer {token}"}
    listing_id = await _seed_sale_listing(db_session, seed_company.id)

    # Publier facebook
    r1 = await client.post(
        "/api/v1/social/posts",
        headers=h,
        json={"listing_type": "sale", "listing_id": str(listing_id), "channel": "facebook"},
    )
    assert r1.status_code == 201
    fb_id = r1.json()["data"]["id"]

    # Idempotent : republier facebook renvoie le même post
    r2 = await client.post(
        "/api/v1/social/posts",
        headers=h,
        json={"listing_type": "sale", "listing_id": str(listing_id), "channel": "facebook"},
    )
    assert r2.status_code == 201
    assert r2.json()["data"]["id"] == fb_id

    # Publier instagram
    r3 = await client.post(
        "/api/v1/social/posts",
        headers=h,
        json={"listing_type": "sale", "listing_id": str(listing_id), "channel": "instagram"},
    )
    assert r3.status_code == 201

    # Liste : 2 canaux
    lst = await client.get(
        f"/api/v1/social/posts?listing_type=sale&listing_id={listing_id}", headers=h
    )
    assert lst.status_code == 200
    channels = {p["channel"] for p in lst.json()["data"]}
    assert channels == {"facebook", "instagram"}

    # Dépublier facebook
    rd = await client.delete(f"/api/v1/social/posts/{fb_id}", headers=h)
    assert rd.status_code == 204

    lst2 = await client.get(
        f"/api/v1/social/posts?listing_type=sale&listing_id={listing_id}", headers=h
    )
    assert {p["channel"] for p in lst2.json()["data"]} == {"instagram"}


@pytest.mark.asyncio
async def test_cross_tenant_publish_and_list(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
    db_session: AsyncSession,
    seed_company: Company,
) -> None:
    _, token1 = seed_admin
    _, token2 = second_admin
    listing_id = await _seed_sale_listing(db_session, seed_company.id)

    # Tenant 1 publie
    await client.post(
        "/api/v1/social/posts",
        headers={"Authorization": f"Bearer {token1}"},
        json={"listing_type": "sale", "listing_id": str(listing_id), "channel": "facebook"},
    )
    # Tenant 2 ne peut PAS publier sur l'annonce de tenant 1 (404, anti-BOLA)
    rcross = await client.post(
        "/api/v1/social/posts",
        headers={"Authorization": f"Bearer {token2}"},
        json={"listing_type": "sale", "listing_id": str(listing_id), "channel": "facebook"},
    )
    assert rcross.status_code == 404
    # Tenant 2 ne voit aucun post de tenant 1
    lst = await client.get(
        f"/api/v1/social/posts?listing_type=sale&listing_id={listing_id}",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert lst.json()["data"] == []
