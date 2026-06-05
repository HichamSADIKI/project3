"""Tests unitaires — helpers purs des notifications (M6)."""

import pytest

from app.routers.notifications.service import (
    is_valid_channel,
    is_valid_status_transition,
)


class TestStatusTransition:
    @pytest.mark.parametrize("target", ["sent", "read"])
    def test_pending_can_advance(self, target: str) -> None:
        assert is_valid_status_transition("pending", target) is True

    def test_sent_to_read(self) -> None:
        assert is_valid_status_transition("sent", "read") is True

    def test_read_is_terminal(self) -> None:
        assert is_valid_status_transition("read", "sent") is False
        assert is_valid_status_transition("read", "pending") is False

    def test_no_backwards(self) -> None:
        assert is_valid_status_transition("sent", "pending") is False

    def test_unknown(self) -> None:
        assert is_valid_status_transition("bogus", "sent") is False


class TestChannel:
    @pytest.mark.parametrize("ch", ["in_app", "email", "whatsapp", "push"])
    def test_valid(self, ch: str) -> None:
        assert is_valid_channel(ch) is True

    @pytest.mark.parametrize("ch", ["sms", "", "fax"])
    def test_invalid(self, ch: str) -> None:
        assert is_valid_channel(ch) is False


class TestPlatform:
    @pytest.mark.parametrize("p", ["ios", "android", "web"])
    def test_valid(self, p: str) -> None:
        from app.routers.notifications.service import is_valid_platform

        assert is_valid_platform(p) is True

    @pytest.mark.parametrize("p", ["windows", "", "linux"])
    def test_invalid(self, p: str) -> None:
        from app.routers.notifications.service import is_valid_platform

        assert is_valid_platform(p) is False


# ─── Tests d'intégration — jetons d'appareils (push) ─────────────────────────
# Requièrent PostgreSQL — lancer via : docker compose exec api uv run pytest

import uuid

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import encode_jwt, hash_password
from app.models.company import Company
from app.models.user import User, UserRole, UserStatus


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


_TOKEN_A = "fcm-token-" + "a" * 40


async def test_register_device_requires_auth(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/notifications/devices", json={"token": _TOKEN_A, "platform": "android"}
    )
    assert resp.status_code == 401


async def test_register_invalid_platform_422(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    resp = await client.post(
        "/api/v1/notifications/devices",
        headers=_auth(token),
        json={"token": _TOKEN_A, "platform": "windows"},
    )
    assert resp.status_code == 422


async def test_register_then_list_device(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    reg = await client.post(
        "/api/v1/notifications/devices",
        headers=_auth(token),
        json={"token": _TOKEN_A, "platform": "ios"},
    )
    assert reg.status_code == 201, reg.text
    assert reg.json()["data"]["platform"] == "ios"

    listed = await client.get("/api/v1/notifications/devices", headers=_auth(token))
    assert listed.status_code == 200
    tokens = [d["token"] for d in listed.json()["data"]]
    assert _TOKEN_A in tokens


async def test_register_is_idempotent_upsert(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    for platform in ("android", "ios"):
        r = await client.post(
            "/api/v1/notifications/devices",
            headers=_auth(token),
            json={"token": _TOKEN_A, "platform": platform},
        )
        assert r.status_code == 201, r.text
    listed = await client.get("/api/v1/notifications/devices", headers=_auth(token))
    same = [d for d in listed.json()["data"] if d["token"] == _TOKEN_A]
    assert len(same) == 1  # pas de doublon
    assert same[0]["platform"] == "ios"  # dernière valeur


async def test_unregister_device(client: AsyncClient, seed_admin: tuple[User, str]) -> None:
    _admin, token = seed_admin
    await client.post(
        "/api/v1/notifications/devices",
        headers=_auth(token),
        json={"token": _TOKEN_A, "platform": "android"},
    )
    rm = await client.delete(
        "/api/v1/notifications/devices", headers=_auth(token), params={"token": _TOKEN_A}
    )
    assert rm.status_code == 204
    # Idempotence : un 2e delete renvoie 404 (plus actif).
    rm2 = await client.delete(
        "/api/v1/notifications/devices", headers=_auth(token), params={"token": _TOKEN_A}
    )
    assert rm2.status_code == 404
    listed = await client.get("/api/v1/notifications/devices", headers=_auth(token))
    assert all(d["token"] != _TOKEN_A for d in listed.json()["data"])


async def test_device_tenant_isolation(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
) -> None:
    """Le jeton enregistré par A est invisible/insupprimable par le tenant B (Loi 1)."""
    _admin, token_a = seed_admin
    _company_b, token_b = second_admin
    await client.post(
        "/api/v1/notifications/devices",
        headers=_auth(token_a),
        json={"token": _TOKEN_A, "platform": "android"},
    )
    # B ne voit rien
    list_b = await client.get("/api/v1/notifications/devices", headers=_auth(token_b))
    assert list_b.status_code == 200
    assert list_b.json()["data"] == []
    # B ne peut pas supprimer le jeton de A
    rm_b = await client.delete(
        "/api/v1/notifications/devices", headers=_auth(token_b), params={"token": _TOKEN_A}
    )
    assert rm_b.status_code == 404


async def _second_user_token(db: AsyncSession, company_id: uuid.UUID) -> str:
    user = User(
        id=uuid.uuid4(),
        company_id=company_id,
        email=f"user2-{uuid.uuid4().hex[:8]}@sgi.test",
        hashed_password=hash_password("Pass!234"),
        full_name="User Two",
        role=UserRole.AGENT.value,
        status=UserStatus.ACTIVE.value,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    return encode_jwt(
        {
            "sub": str(user.id),
            "company_id": str(company_id),
            "role": user.role,
            "status": user.status,
            "email": user.email,
        }
    )


async def test_other_user_same_tenant_cannot_delete(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    db_session: AsyncSession,
) -> None:
    """BOLA horizontal : un 2e utilisateur du MÊME tenant ne peut pas supprimer
    le jeton d'un autre utilisateur (delete scopé à user_id)."""
    admin, token = seed_admin
    await client.post(
        "/api/v1/notifications/devices",
        headers=_auth(token),
        json={"token": _TOKEN_A, "platform": "android"},
    )
    token2 = await _second_user_token(db_session, admin.company_id)
    rm = await client.delete(
        "/api/v1/notifications/devices", headers=_auth(token2), params={"token": _TOKEN_A}
    )
    assert rm.status_code == 404  # invisible pour l'autre user
    # Le jeton existe toujours pour le propriétaire.
    listed = await client.get("/api/v1/notifications/devices", headers=_auth(token))
    assert any(d["token"] == _TOKEN_A for d in listed.json()["data"])
