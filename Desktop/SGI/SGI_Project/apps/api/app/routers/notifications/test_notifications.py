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


# ─── Tests d'intégration — centre de notifications (badge + tout-lu) ──────────


async def _seed_notif(
    db: AsyncSession, company_id: uuid.UUID, user_id: uuid.UUID, *, channel: str = "in_app"
):
    from app.routers.notifications.service import create_notification

    return await create_notification(
        db,
        company_id,
        notif_type="invoice_overdue",
        title="Relance facture",
        body="Facture impayée.",
        channel=channel,
        recipient_user_id=user_id,
    )


async def test_unread_count_and_mark_all_read(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    admin, token = seed_admin
    for _ in range(3):
        await _seed_notif(db_session, admin.company_id, admin.id)

    cnt = await client.get("/api/v1/notifications/unread-count", headers=_auth(token))
    assert cnt.status_code == 200
    assert cnt.json()["data"]["count"] == 3

    allread = await client.post("/api/v1/notifications/read-all", headers=_auth(token))
    assert allread.status_code == 200
    assert allread.json()["data"]["updated"] == 3

    cnt2 = await client.get("/api/v1/notifications/unread-count", headers=_auth(token))
    assert cnt2.json()["data"]["count"] == 0
    # Toutes les notifs sont désormais 'read'.
    listed = await client.get("/api/v1/notifications/", headers=_auth(token))
    assert all(n["status"] == "read" for n in listed.json()["data"])


async def test_unread_count_excludes_already_read(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    admin, token = seed_admin
    n1 = await _seed_notif(db_session, admin.company_id, admin.id)
    await _seed_notif(db_session, admin.company_id, admin.id)
    # Marque la 1ʳᵉ comme lue.
    r = await client.post(f"/api/v1/notifications/{n1.id}/read", headers=_auth(token))
    assert r.status_code == 200
    cnt = await client.get("/api/v1/notifications/unread-count", headers=_auth(token))
    assert cnt.json()["data"]["count"] == 1


async def test_unread_count_tenant_isolation(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    admin, token = seed_admin
    await _seed_notif(db_session, admin.company_id, admin.id)
    # Notif d'une AUTRE société (company_id différent) → ne doit pas compter (Loi 1).
    other_company = uuid.uuid4()
    await _seed_notif(db_session, other_company, admin.id)
    cnt = await client.get("/api/v1/notifications/unread-count", headers=_auth(token))
    assert cnt.json()["data"]["count"] == 1


async def test_read_all_requires_auth(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/notifications/read-all")
    assert resp.status_code in (401, 403)


# ── WebSocket temps réel : channels (purs) + hook de publication ──────────────

from app.routers.notifications.ws import publish_notification, user_channel  # noqa: E402


def test_user_channel_namespaced_by_tenant_and_user() -> None:
    cid = "11111111-1111-1111-1111-111111111111"
    uid = "22222222-2222-2222-2222-222222222222"
    assert user_channel(cid, uid) == f"notif:{cid}:{uid}"


def test_user_channel_tenant_isolation() -> None:
    """Deux tenants (même user_id improbable) → channels disjoints (Loi 1)."""
    a, b = "aaaaaaaa-...-a", "bbbbbbbb-...-b"
    uid = "33333333-3333-3333-3333-333333333333"
    assert user_channel(a, uid) != user_channel(b, uid)


def test_distinct_users_distinct_channels() -> None:
    cid = "11111111-1111-1111-1111-111111111111"
    assert user_channel(cid, "u1") != user_channel(cid, "u2")


async def test_publish_notification_is_best_effort() -> None:
    """Valkey indisponible (CI) → publish ne lève jamais (confort temps réel)."""
    await publish_notification(uuid.uuid4(), uuid.uuid4(), {"type": "ping"})


async def test_create_in_app_notification_publishes_ws(
    seed_admin: tuple[User, str], db_session: AsyncSession, monkeypatch
) -> None:
    """Une notif in-app destinée à un user déclenche un push WS personnel."""
    admin, _token = seed_admin
    calls: list[tuple[str, str, dict]] = []

    async def _fake_pub(cid, uid, event) -> None:  # type: ignore[no-untyped-def]
        calls.append((str(cid), str(uid), event))

    monkeypatch.setattr("app.routers.notifications.ws.publish_notification", _fake_pub)
    from app.routers.notifications.service import create_notification

    await create_notification(
        db_session,
        admin.company_id,
        notif_type="test",
        title="Bonjour",
        recipient_user_id=admin.id,
    )
    assert len(calls) == 1
    cid, uid, event = calls[0]
    assert cid == str(admin.company_id) and uid == str(admin.id)
    assert event["type"] == "notification.created"
    assert event["data"]["title"] == "Bonjour"


async def test_email_notification_does_not_publish_ws(
    seed_admin: tuple[User, str], db_session: AsyncSession, monkeypatch
) -> None:
    """Un canal non in-app (email) ne pousse PAS sur le WS personnel."""
    admin, _token = seed_admin
    calls: list[int] = []

    async def _fake_pub(cid, uid, event) -> None:  # type: ignore[no-untyped-def]
        calls.append(1)

    monkeypatch.setattr("app.routers.notifications.ws.publish_notification", _fake_pub)
    from app.routers.notifications.service import create_notification

    await create_notification(
        db_session,
        admin.company_id,
        notif_type="test",
        title="x",
        channel="email",
        recipient_user_id=admin.id,
    )
    assert calls == []


async def test_no_recipient_does_not_publish_ws(
    seed_admin: tuple[User, str], db_session: AsyncSession, monkeypatch
) -> None:
    """Notif in-app sans destinataire user (broadcast party) → pas de push perso."""
    admin, _token = seed_admin
    calls: list[int] = []

    async def _fake_pub(cid, uid, event) -> None:  # type: ignore[no-untyped-def]
        calls.append(1)

    monkeypatch.setattr("app.routers.notifications.ws.publish_notification", _fake_pub)
    from app.routers.notifications.service import create_notification

    await create_notification(db_session, admin.company_id, notif_type="t", title="x")
    assert calls == []


# ── Jeton WS court (ws-ticket) ───────────────────────────────────────────────


async def test_ws_ticket_requires_auth(client: AsyncClient) -> None:
    r = await client.get("/api/v1/notifications/ws-ticket")
    assert r.status_code in (401, 403)


async def test_ws_ticket_returns_token_with_user_claims(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    """Le ticket porte (sub, company_id) du demandeur → un user ne peut ouvrir
    QUE son propre flux WS (Loi 1 + BOLA)."""
    admin, token = seed_admin
    r = await client.get("/api/v1/notifications/ws-ticket", headers=_auth(token))
    assert r.status_code == 200, r.text
    ticket = r.json()["data"]["ticket"]
    from app.core.auth import decode_jwt

    payload = decode_jwt(ticket)
    assert payload["sub"] == str(admin.id)
    assert payload["company_id"] == str(admin.company_id)


# ── Push mobile : enfilement worker depuis create_notification ───────────────


async def test_create_in_app_enqueues_push(
    seed_admin: tuple[User, str], db_session: AsyncSession, monkeypatch
) -> None:
    """Une notif in-app destinée à un user enfile aussi un envoi push (worker)."""
    admin, _token = seed_admin
    calls: list[dict] = []

    from app.tasks import notifications as _notif_tasks

    monkeypatch.setattr(_notif_tasks.send_push, "delay", lambda **kw: calls.append(kw))

    async def _noop(*_a, **_k) -> None:  # neutralise le WS (Valkey)
        return None

    monkeypatch.setattr("app.routers.notifications.ws.publish_notification", _noop)

    from app.routers.notifications.service import create_notification

    await create_notification(
        db_session,
        admin.company_id,
        notif_type="t",
        title="Hi",
        body="B",
        recipient_user_id=admin.id,
    )
    assert len(calls) == 1
    assert calls[0]["user_id"] == str(admin.id)
    assert calls[0]["company_id"] == str(admin.company_id)
    assert calls[0]["title"] == "Hi"
