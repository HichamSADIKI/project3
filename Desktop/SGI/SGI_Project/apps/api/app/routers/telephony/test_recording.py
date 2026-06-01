"""Tests Enregistrement (recording.py) — logique métier PDPL + scoping tenant.

MinIO est monkeypatché : on teste les gardes (consentement, tenant, présence,
dispo stockage) sans dépendre d'un MinIO réel.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient

from app.core import storage
from app.models.company import Company
from app.models.user import User
from app.routers.telephony import recording, service

# ─────────────────────────────────────────────────────────────────────────
# Pur
# ─────────────────────────────────────────────────────────────────────────


def test_build_recording_key_namespaced_by_tenant() -> None:
    cid = uuid.uuid4()
    call = uuid.uuid4()
    assert recording.build_recording_key(cid, call) == (
        f"telephony/{cid}/recordings/{call}.wav"
    )


def test_channel_id_from_filename() -> None:
    assert recording.channel_id_from_filename("sgi-abc123.wav") == "sgi-abc123"
    assert recording.channel_id_from_filename("1718000000.42.wav") == "1718000000.42"
    assert recording.channel_id_from_filename("notes.txt") is None
    assert recording.channel_id_from_filename(".wav") is None


def test_is_recording_expired() -> None:
    now = datetime(2026, 6, 1, 12, 0, 0, tzinfo=UTC)
    old = now - timedelta(days=400)
    recent = now - timedelta(days=10)
    assert recording.is_recording_expired(old, 365, now) is True
    assert recording.is_recording_expired(recent, 365, now) is False
    # ended_at None (appel non terminé) → jamais expiré
    assert recording.is_recording_expired(None, 365, now) is False
    # rétention désactivée (<=0) → jamais expiré
    assert recording.is_recording_expired(old, 0, now) is False


# ─────────────────────────────────────────────────────────────────────────
# attach_recording
# ─────────────────────────────────────────────────────────────────────────


async def test_find_call_by_channel_id_scoped_tenant(
    db_session, seed_company: Company
) -> None:
    call = await service.create_call(
        db_session, seed_company.id, direction="outbound",
        channel_id="sgi-chan-xyz", recording_consent=True,
    )
    found = await recording.find_call_by_channel_id(
        db_session, seed_company.id, "sgi-chan-xyz"
    )
    assert found is not None and found.id == call.id
    # Autre tenant → None (Loi 1)
    assert (
        await recording.find_call_by_channel_id(
            db_session, uuid.uuid4(), "sgi-chan-xyz"
        )
        is None
    )


async def test_attach_recording_sets_url_when_consent(
    db_session, seed_company: Company
) -> None:
    call = await service.create_call(
        db_session, seed_company.id, direction="inbound", recording_consent=True
    )
    updated = await recording.attach_recording(
        db_session, seed_company.id, call.id, object_key="k/x.wav"
    )
    assert updated is not None
    assert updated.recording_url == "k/x.wav"


async def test_attach_recording_refuses_without_consent(
    db_session, seed_company: Company
) -> None:
    call = await service.create_call(
        db_session, seed_company.id, direction="inbound", recording_consent=False
    )
    with pytest.raises(ValueError, match="recording_consent_missing"):
        await recording.attach_recording(
            db_session, seed_company.id, call.id, object_key="k/x.wav"
        )


async def test_attach_recording_cross_tenant_returns_none(
    db_session, seed_company: Company
) -> None:
    call = await service.create_call(
        db_session, seed_company.id, direction="inbound", recording_consent=True
    )
    other_company = uuid.uuid4()
    # Le call n'appartient pas à other_company → None (Loi 1).
    assert (
        await recording.attach_recording(
            db_session, other_company, call.id, object_key="k/x.wav"
        )
        is None
    )


# ─────────────────────────────────────────────────────────────────────────
# upload_recording (MinIO monkeypatché)
# ─────────────────────────────────────────────────────────────────────────


async def test_upload_recording_pushes_and_attaches(
    db_session, seed_company: Company, monkeypatch
) -> None:
    uploaded: dict = {}

    async def fake_upload(object_key, data, content_type):
        uploaded["key"] = object_key
        uploaded["len"] = len(data)
        return object_key

    monkeypatch.setattr(storage, "upload_bytes", fake_upload)
    call = await service.create_call(
        db_session, seed_company.id, direction="inbound", recording_consent=True
    )
    updated = await recording.upload_recording(
        db_session, seed_company.id, call.id, data=b"RIFFfake"
    )
    assert updated is not None
    assert updated.recording_url == recording.build_recording_key(
        seed_company.id, call.id
    )
    assert uploaded["len"] == 8


async def test_upload_recording_refuses_without_consent(
    db_session, seed_company: Company
) -> None:
    call = await service.create_call(
        db_session, seed_company.id, direction="inbound", recording_consent=False
    )
    with pytest.raises(ValueError, match="recording_consent_missing"):
        await recording.upload_recording(
            db_session, seed_company.id, call.id, data=b"x"
        )


# ─────────────────────────────────────────────────────────────────────────
# get_recording_url (gardes successifs)
# ─────────────────────────────────────────────────────────────────────────


async def test_get_recording_url_not_found(db_session, seed_company: Company) -> None:
    with pytest.raises(LookupError, match="call_not_found"):
        await recording.get_recording_url(db_session, seed_company.id, uuid.uuid4())


async def test_get_recording_url_refuses_without_consent(
    db_session, seed_company: Company
) -> None:
    call = await service.create_call(
        db_session, seed_company.id, direction="inbound", recording_consent=False
    )
    with pytest.raises(PermissionError, match="recording_consent_missing"):
        await recording.get_recording_url(db_session, seed_company.id, call.id)


async def test_get_recording_url_no_recording(
    db_session, seed_company: Company
) -> None:
    call = await service.create_call(
        db_session, seed_company.id, direction="inbound", recording_consent=True
    )
    with pytest.raises(LookupError, match="recording_not_found"):
        await recording.get_recording_url(db_session, seed_company.id, call.id)


async def test_get_recording_url_storage_unavailable(
    db_session, seed_company: Company, monkeypatch
) -> None:
    async def fake_presigned(key, expires):
        return None  # MinIO indisponible

    monkeypatch.setattr(storage, "presigned_url", fake_presigned)
    call = await service.create_call(
        db_session, seed_company.id, direction="inbound", recording_consent=True
    )
    await recording.attach_recording(
        db_session, seed_company.id, call.id, object_key="k/x.wav"
    )
    with pytest.raises(storage.StorageError):
        await recording.get_recording_url(db_session, seed_company.id, call.id)


async def test_get_recording_url_success(
    db_session, seed_company: Company, monkeypatch
) -> None:
    async def fake_presigned(key, expires):
        return f"https://minio.local/{key}?sig=abc"

    monkeypatch.setattr(storage, "presigned_url", fake_presigned)
    call = await service.create_call(
        db_session, seed_company.id, direction="inbound", recording_consent=True
    )
    await recording.attach_recording(
        db_session, seed_company.id, call.id, object_key="k/x.wav"
    )
    url = await recording.get_recording_url(db_session, seed_company.id, call.id)
    assert url.startswith("https://minio.local/k/x.wav")


# ─────────────────────────────────────────────────────────────────────────
# Endpoint HTTP GET /calls/{id}/recording
# ─────────────────────────────────────────────────────────────────────────


async def test_recording_endpoint_403_without_consent(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    created = await client.post(
        "/api/v1/telephony/calls",
        json={"direction": "inbound", "recording_consent": False},
        headers=headers,
    )
    cid = created.json()["data"]["id"]
    resp = await client.get(
        f"/api/v1/telephony/calls/{cid}/recording", headers=headers
    )
    assert resp.status_code == 403


async def test_recording_endpoint_404_when_no_recording(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    created = await client.post(
        "/api/v1/telephony/calls",
        json={"direction": "inbound", "recording_consent": True},
        headers=headers,
    )
    cid = created.json()["data"]["id"]
    # Consentement OK mais aucun enregistrement attaché → 404.
    resp = await client.get(
        f"/api/v1/telephony/calls/{cid}/recording", headers=headers
    )
    assert resp.status_code == 404
