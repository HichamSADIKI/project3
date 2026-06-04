"""Tests module Scenarios — helpers purs + endpoints (multi-tenant, BOLA, stub)."""

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
from app.routers.scenarios import service

# ── Helpers purs ─────────────────────────────────────────────────────────────


class TestPureHelpers:
    def test_valid_avatar(self) -> None:
        assert service.is_valid_avatar("male") and service.is_valid_avatar("female")
        assert not service.is_valid_avatar("robot")

    def test_valid_voice_mode(self) -> None:
        assert service.is_valid_voice_mode("avatar") and service.is_valid_voice_mode("recorded")
        assert not service.is_valid_voice_mode("sung")

    def test_valid_listing_type(self) -> None:
        assert service.is_valid_listing_type("sale") and service.is_valid_listing_type("rent")
        assert not service.is_valid_listing_type("lease")

    def test_avatar_voice_label(self) -> None:
        assert "féminine" in service.avatar_voice_label("female")
        assert "masculine" in service.avatar_voice_label("male")
        assert service.avatar_voice_label(None) == "voix"

    def test_stub_video_url_deterministic(self) -> None:
        sid = uuid.UUID("00000000-0000-4000-8000-000000000001")
        out = service.stub_video_url(sid)
        assert out.startswith("https://") and out == service.stub_video_url(sid)
        assert sid.hex[:8] in out

    def test_ffmpeg_output_key(self) -> None:
        cid = uuid.UUID("00000000-0000-4000-8000-000000000002")
        sid = uuid.UUID("00000000-0000-4000-8000-000000000003")
        key = service.ffmpeg_output_key(cid, sid)
        assert key == f"scenarios/{cid}/videos/{sid.hex}.mp4"

    def test_build_ffmpeg_command_photos_only(self) -> None:
        cmd = service.build_ffmpeg_command(["/a.jpg", "/b.jpg"], None, "/out.mp4")
        assert cmd[0] == "ffmpeg"
        assert "/a.jpg" in cmd and "/b.jpg" in cmd and cmd[-1] == "/out.mp4"
        # 2 plans concaténés, encodage H.264, format vertical 1080x1920
        joined = " ".join(cmd)
        assert "concat=n=2:v=1:a=0[v]" in joined
        assert "libx264" in cmd and "1080:1920" in joined
        # pas d'audio → pas de map audio
        assert "-shortest" not in cmd

    def test_build_ffmpeg_command_with_audio(self) -> None:
        cmd = service.build_ffmpeg_command(["/a.jpg"], "/voice.webm", "/out.mp4")
        assert "/voice.webm" in cmd
        assert "-shortest" in cmd and "1:a" in " ".join(cmd)

    def test_build_ffmpeg_command_requires_image(self) -> None:
        import pytest as _pytest

        with _pytest.raises(ValueError, match="at_least_one_image"):
            service.build_ffmpeg_command([], None, "/out.mp4")


# ── Fixture de données ───────────────────────────────────────────────────────


async def _seed_sale_listing(db: AsyncSession, company_id: uuid.UUID) -> uuid.UUID:
    seller = Client(
        id=uuid.uuid4(), company_id=company_id, type="individual", first_name="S", last_name="T"
    )
    db.add(seller)
    await db.flush()
    mandate = await sales_service.create_mandate(db, company_id, seller_client_id=seller.id)
    listing = await sales_service.create_listing(
        db, company_id, mandate_id=mandate.id, list_price=Decimal("1000000"), title_en="Villa"
    )
    return listing.id


def _payload(listing_id: uuid.UUID) -> dict:
    return {
        "listing_type": "sale",
        "listing_id": str(listing_id),
        "title": "Reel villa",
        "voice_mode": "avatar",
        "avatar": "female",
        "script": "Découvrez cette villa.",
        "photo_refs": ["scenarios/x/photo/a.jpg", "scenarios/x/photo/b.jpg"],
    }


# ── Endpoints ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_avatars_endpoint(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _, token = seed_admin
    res = await client.get(
        "/api/v1/scenarios/avatars", headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    keys = {a["key"] for a in res.json()["data"]}
    assert keys == {"male", "female"}


@pytest.mark.asyncio
async def test_create_unknown_listing_404(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _, token = seed_admin
    res = await client.post(
        "/api/v1/scenarios/",
        headers={"Authorization": f"Bearer {token}"},
        json=_payload(uuid.uuid4()),
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_create_validation_errors(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    db_session: AsyncSession,
    seed_company: Company,
) -> None:
    _, token = seed_admin
    h = {"Authorization": f"Bearer {token}"}
    lid = await _seed_sale_listing(db_session, seed_company.id)
    # avatar mode sans avatar
    p = _payload(lid)
    p["avatar"] = None
    assert (await client.post("/api/v1/scenarios/", headers=h, json=p)).status_code == 422
    # recorded sans audio_ref
    p = _payload(lid)
    p["voice_mode"] = "recorded"
    p["avatar"] = None
    assert (await client.post("/api/v1/scenarios/", headers=h, json=p)).status_code == 422
    # sans photo
    p = _payload(lid)
    p["photo_refs"] = []
    assert (await client.post("/api/v1/scenarios/", headers=h, json=p)).status_code == 422


@pytest.mark.asyncio
async def test_create_async_lifecycle(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    db_session: AsyncSession,
    seed_company: Company,
) -> None:
    _, token = seed_admin
    h = {"Authorization": f"Bearer {token}"}
    lid = await _seed_sale_listing(db_session, seed_company.id)

    # create → génération FFmpeg en tâche de fond → statut 'generating'
    res = await client.post("/api/v1/scenarios/", headers=h, json=_payload(lid))
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["status"] == "generating"
    assert data["video_url"] is None
    assert data["avatar"] == "female"
    sid = data["id"]

    # list / get
    lst = await client.get(f"/api/v1/scenarios/?listing_type=sale&listing_id={lid}", headers=h)
    assert lst.status_code == 200 and len(lst.json()["data"]) == 1
    one = await client.get(f"/api/v1/scenarios/{sid}", headers=h)
    assert one.status_code == 200 and one.json()["data"]["status"] == "generating"

    # generate (relance) → re-enqueue, repasse en 'generating'
    gen = await client.post(f"/api/v1/scenarios/{sid}/generate", headers=h)
    assert gen.status_code == 200 and gen.json()["data"]["status"] == "generating"

    # delete → 204 puis 404
    assert (await client.delete(f"/api/v1/scenarios/{sid}", headers=h)).status_code == 204
    assert (await client.get(f"/api/v1/scenarios/{sid}", headers=h)).status_code == 404


@pytest.mark.asyncio
async def test_stub_generation_helper(db_session: AsyncSession, seed_company: Company) -> None:
    """`run_stub_generation` (utilisé par les tests social) fabrique un ready."""
    lid = await _seed_sale_listing(db_session, seed_company.id)
    sc = await service.create_scenario(
        db_session,
        seed_company.id,
        listing_type="sale",
        listing_id=lid,
        voice_mode="avatar",
        photo_refs=["k.jpg"],
        avatar="male",
    )
    done = await service.run_stub_generation(db_session, seed_company.id, sc.id)
    assert done is not None and done.status == "ready" and done.video_url


@pytest.mark.asyncio
async def test_cross_tenant_isolation(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
    db_session: AsyncSession,
    seed_company: Company,
) -> None:
    _, token1 = seed_admin
    _, token2 = second_admin
    lid = await _seed_sale_listing(db_session, seed_company.id)
    await client.post(
        "/api/v1/scenarios/", headers={"Authorization": f"Bearer {token1}"}, json=_payload(lid)
    )
    # Tenant 2 ne peut pas créer sur l'annonce de tenant 1 (404)
    rcross = await client.post(
        "/api/v1/scenarios/", headers={"Authorization": f"Bearer {token2}"}, json=_payload(lid)
    )
    assert rcross.status_code == 404
    # Tenant 2 ne voit aucun scénario de tenant 1
    lst = await client.get(
        f"/api/v1/scenarios/?listing_type=sale&listing_id={lid}",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert lst.json()["data"] == []
