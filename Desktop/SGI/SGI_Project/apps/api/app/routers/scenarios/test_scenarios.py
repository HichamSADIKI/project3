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
from app.routers.scenarios import service, tts


@pytest.fixture(autouse=True)
def _stub_generate_delay(monkeypatch: pytest.MonkeyPatch) -> None:
    """Neutralise l'enqueue Celery (pas de broker en test) : les endpoints
    create/generate laissent le scénario en `generating` — état vérifié par les
    tests. Le rendu FFmpeg réel est couvert par les helpers purs `build_ffmpeg_command`.
    """
    import app.tasks.scenarios as scenarios_task

    monkeypatch.setattr(scenarios_task.generate, "delay", lambda *a, **k: None)


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

    def test_owns_ref(self) -> None:
        cid = uuid.UUID("00000000-0000-4000-8000-000000000002")
        other = uuid.UUID("00000000-0000-4000-8000-0000000000ff")
        assert service.owns_ref(cid, f"scenarios/{cid}/photo/a.jpg")
        # ref d'un autre tenant → refusée (garde-fou Loi 1 stockage)
        assert not service.owns_ref(cid, f"scenarios/{other}/photo/a.jpg")
        # autre namespace de bucket (documents, fournisseurs…) → refusée
        assert not service.owns_ref(cid, f"fournisseurs/{other}/licence.jpg")

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


# ── TTS Azure (helpers purs + synthèse mockée) ───────────────────────────────


class TestTts:
    def test_detect_language(self) -> None:
        assert tts.detect_language("مرحبا بكم في هذا العقار") == "ar"
        assert tts.detect_language("Découvrez cette villa à la mer") == "fr"
        assert tts.detect_language("Welcome to this amazing property") == "en"

    def test_voice_name(self) -> None:
        assert tts.voice_name("male", "ar") == "ar-AE-HamdanNeural"
        assert tts.voice_name("female", "ar") == "ar-AE-FatimaNeural"
        assert tts.voice_name("male", "en") == "en-US-GuyNeural"
        # genre inconnu → femme ; langue inconnue → arabe
        assert tts.voice_name("robot", "en") == "en-US-JennyNeural"
        assert tts.voice_name("male", "xx") == "ar-AE-HamdanNeural"

    def test_build_ssml_escapes(self) -> None:
        ssml = tts.build_ssml("A & B <x>", voice="ar-AE-FatimaNeural", lang="ar")
        assert "ar-AE-FatimaNeural" in ssml and "xml:lang='ar-AE'" in ssml
        assert "&amp;" in ssml and "&lt;x&gt;" in ssml and "<x>" not in ssml

    def test_synthesize_none_when_not_configured(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(tts.settings, "AZURE_SPEECH_KEY", "")
        monkeypatch.setattr(tts.settings, "AZURE_SPEECH_REGION", "")
        assert tts.synthesize("bonjour", gender="female") is None

    def test_synthesize_none_when_empty_text(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(tts.settings, "AZURE_SPEECH_KEY", "k")
        monkeypatch.setattr(tts.settings, "AZURE_SPEECH_REGION", "uaenorth")
        assert tts.synthesize("   ", gender="female") is None

    def test_synthesize_ok_and_error(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(tts.settings, "AZURE_SPEECH_KEY", "k")
        monkeypatch.setattr(tts.settings, "AZURE_SPEECH_REGION", "uaenorth")

        class _Resp:
            def __init__(self, code: int, content: bytes = b"") -> None:
                self.status_code = code
                self.content = content
                self.text = ""

        captured: dict[str, object] = {}

        def _fake_post(url: str, **kwargs: object) -> _Resp:
            captured["url"] = url
            return _Resp(200, b"MP3DATA")

        monkeypatch.setattr(tts.httpx, "post", _fake_post)
        out = tts.synthesize("Welcome to this villa", gender="male")
        assert out == b"MP3DATA"
        assert "uaenorth.tts.speech.microsoft.com" in str(captured["url"])

        monkeypatch.setattr(tts.httpx, "post", lambda *a, **k: _Resp(401, b""))
        assert tts.synthesize("hello", gender="male") is None


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


def _payload(company_id: uuid.UUID, listing_id: uuid.UUID) -> dict:
    # Refs MinIO au namespace du tenant (validées par owns_ref à la création).
    return {
        "listing_type": "sale",
        "listing_id": str(listing_id),
        "title": "Reel villa",
        "voice_mode": "avatar",
        "avatar": "female",
        "script": "Découvrez cette villa.",
        "photo_refs": [
            f"scenarios/{company_id}/photo/a.jpg",
            f"scenarios/{company_id}/photo/b.jpg",
        ],
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
        json=_payload(uuid.uuid4(), uuid.uuid4()),
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
    p = _payload(seed_company.id, lid)
    p["avatar"] = None
    assert (await client.post("/api/v1/scenarios/", headers=h, json=p)).status_code == 422
    # recorded sans audio_ref
    p = _payload(seed_company.id, lid)
    p["voice_mode"] = "recorded"
    p["avatar"] = None
    assert (await client.post("/api/v1/scenarios/", headers=h, json=p)).status_code == 422
    # sans photo
    p = _payload(seed_company.id, lid)
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
    res = await client.post("/api/v1/scenarios/", headers=h, json=_payload(seed_company.id, lid))
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
    h1 = {"Authorization": f"Bearer {token1}"}
    h2 = {"Authorization": f"Bearer {token2}"}
    lid = await _seed_sale_listing(db_session, seed_company.id)
    r1 = await client.post("/api/v1/scenarios/", headers=h1, json=_payload(seed_company.id, lid))
    assert r1.status_code == 201, r1.text
    sid = r1.json()["data"]["id"]
    # Tenant 2 ne peut pas créer sur l'annonce de tenant 1 (404)
    rcross = await client.post(
        "/api/v1/scenarios/", headers=h2, json=_payload(seed_company.id, lid)
    )
    assert rcross.status_code == 404
    # Tenant 2 ne voit aucun scénario de tenant 1
    lst = await client.get(f"/api/v1/scenarios/?listing_type=sale&listing_id={lid}", headers=h2)
    assert lst.json()["data"] == []
    # Anti-BOLA : tenant 2 ne peut ni lire, ni générer, ni supprimer le scénario
    # de tenant 1 — 404 (jamais 403), et le scénario reste intact pour tenant 1.
    assert (await client.get(f"/api/v1/scenarios/{sid}", headers=h2)).status_code == 404
    assert (await client.post(f"/api/v1/scenarios/{sid}/generate", headers=h2)).status_code == 404
    assert (await client.delete(f"/api/v1/scenarios/{sid}", headers=h2)).status_code == 404
    assert (await client.get(f"/api/v1/scenarios/{sid}", headers=h1)).status_code == 200


@pytest.mark.asyncio
async def test_create_rejects_foreign_ref(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    db_session: AsyncSession,
    seed_company: Company,
) -> None:
    """Red-Team Loi 1 (stockage) : référencer la clé MinIO d'un autre tenant dans
    photo_refs/audio_ref → 422 (le fichier d'autrui ne peut pas être encodé)."""
    _, token = seed_admin
    h = {"Authorization": f"Bearer {token}"}
    lid = await _seed_sale_listing(db_session, seed_company.id)
    other = uuid.uuid4()
    # photo_ref d'un autre tenant
    p = _payload(seed_company.id, lid)
    p["photo_refs"] = [f"scenarios/{other}/photo/stolen.jpg"]
    assert (await client.post("/api/v1/scenarios/", headers=h, json=p)).status_code == 422
    # audio_ref hors namespace tenant (autre bucket)
    p = _payload(seed_company.id, lid)
    p["voice_mode"] = "recorded"
    p["avatar"] = None
    p["audio_ref"] = f"fournisseurs/{other}/licence.webm"
    assert (await client.post("/api/v1/scenarios/", headers=h, json=p)).status_code == 422
