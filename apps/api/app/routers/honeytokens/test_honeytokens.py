"""Tests — honeytokens (déception sécurité).

Couches (croissantes au fil des vagues) :
- **Helpers purs** : jeton signé (`generate_token`/`parse_token`) + `redact`.
- **F3 CRUD tenant-scopé** + **F4 trip** (alerte critique) — via le service, DB réelle.
- *(F7)* endpoints admin + trip via HTTP, isolation Loi 1 déterministe.

⚠️ L'intégration exige PostgreSQL : `docker compose exec api uv run pytest
app/routers/honeytokens/test_honeytokens.py`.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin import AlertEvent, AlertRule
from app.models.company import Company
from app.routers.honeytokens import service

# ─────────────────────────────────────────────────────────────────────────
# F2 — helpers purs (aucune DB)
# ─────────────────────────────────────────────────────────────────────────


def test_token_roundtrip_recovers_company() -> None:
    cid = uuid.uuid4()
    tok = service.generate_token(cid)
    assert service.parse_token(tok) == cid
    assert len(tok) <= 128  # tient dans la colonne


def test_token_is_urlsafe() -> None:
    tok = service.generate_token(uuid.uuid4())
    assert all(c.isalnum() or c in "-_." for c in tok)


def test_token_unique_per_call() -> None:
    cid = uuid.uuid4()
    assert len({service.generate_token(cid) for _ in range(500)}) == 500  # nonce aléatoire


def test_parse_rejects_tampered_signature() -> None:
    tok = service.generate_token(uuid.uuid4())
    forged = tok[:-1] + ("A" if tok[-1] != "A" else "B")  # 1 car de signature modifié
    assert service.parse_token(forged) is None


def test_parse_rejects_forged_company() -> None:
    # Tentative de forger un token pour une autre société sans la clé HMAC.
    payload = service._b64(uuid.uuid4().bytes)
    fake = f"{payload}.{'x' * 32}.{'y' * 43}"
    assert service.parse_token(fake) is None


def test_parse_rejects_garbage() -> None:
    for bad in ("", None, "nodots", "a.b", "a.b.c.d"):
        assert service.parse_token(bad) is None  # type: ignore[arg-type]


def test_redact_masks_the_secret() -> None:
    tok = service.generate_token(uuid.uuid4())
    red = service.redact(tok)
    assert red.startswith(tok[:4]) and tok not in red
    assert service.redact("") == "∅"
    assert service.redact(None) == "∅"


# ─────────────────────────────────────────────────────────────────────────
# Fixtures intégration
# ─────────────────────────────────────────────────────────────────────────


async def _make_company(db: AsyncSession) -> Company:
    company = Company(
        id=uuid.uuid4(),
        name="HT Co",
        slug=f"ht-{uuid.uuid4().hex[:8]}",
        plan="pro",
        is_active=True,
    )
    db.add(company)
    await db.commit()
    await db.refresh(company)
    return company


# ─────────────────────────────────────────────────────────────────────────
# F3 — CRUD tenant-scopé
# ─────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_then_list(db_session: AsyncSession) -> None:
    co = await _make_company(db_session)
    ht = await service.create_honeytoken(db_session, co.id, kind="api_key", label="Fake DEWA key")
    assert service.parse_token(ht.token) == co.id  # token signé pour CETTE société
    rows = await service.list_honeytokens(db_session, co.id)
    assert [r.id for r in rows] == [ht.id]


@pytest.mark.asyncio
async def test_list_is_company_scoped(db_session: AsyncSession) -> None:
    a, b = await _make_company(db_session), await _make_company(db_session)
    await service.create_honeytoken(db_session, a.id, kind="url", label="A")
    await service.create_honeytoken(db_session, b.id, kind="url", label="B")
    assert all(r.company_id == a.id for r in await service.list_honeytokens(db_session, a.id))
    assert len(await service.list_honeytokens(db_session, b.id)) == 1


@pytest.mark.asyncio
async def test_delete_soft_removes_from_list(db_session: AsyncSession) -> None:
    co = await _make_company(db_session)
    ht = await service.create_honeytoken(db_session, co.id, kind="secret", label="X")
    assert await service.delete_honeytoken(db_session, co.id, ht.id) is True
    assert await service.list_honeytokens(db_session, co.id) == []
    # Suppression idempotente / inconnue → False.
    assert await service.delete_honeytoken(db_session, co.id, ht.id) is False
    assert await service.delete_honeytoken(db_session, co.id, uuid.uuid4()) is False


# ─────────────────────────────────────────────────────────────────────────
# F4 — trip : alerte critique + neutralité
# ─────────────────────────────────────────────────────────────────────────


async def _critical_events(db: AsyncSession, company_id: uuid.UUID) -> list[AlertEvent]:
    return list(
        (
            await db.execute(
                select(AlertEvent)
                .join(AlertRule, AlertRule.id == AlertEvent.rule_id)
                .where(
                    AlertEvent.company_id == company_id,
                    AlertRule.metric == "honeytoken_access",
                )
            )
        )
        .scalars()
        .all()
    )


@pytest.mark.asyncio
async def test_trip_valid_creates_critical_alert(db_session: AsyncSession) -> None:
    co = await _make_company(db_session)
    ht = await service.create_honeytoken(db_session, co.id, kind="api_key", label="trap")

    assert await service.trip_honeytoken(db_session, ht.token, ip="1.2.3.4") is True

    await db_session.refresh(ht)
    assert ht.trigger_count == 1 and ht.last_triggered_at is not None
    events = await _critical_events(db_session, co.id)
    assert len(events) == 1 and events[0].status == "open"
    # La règle déclenchée est bien de sévérité critique.
    rule = (
        await db_session.execute(select(AlertRule).where(AlertRule.id == events[0].rule_id))
    ).scalar_one()
    assert rule.severity == "critical"


@pytest.mark.asyncio
async def test_trip_forged_or_unknown_is_neutral(db_session: AsyncSession) -> None:
    co = await _make_company(db_session)
    # Token bien formé mais signature forgée → False, aucune alerte.
    payload = service._b64(co.id.bytes)
    forged = f"{payload}.{'x' * 32}.{'y' * 43}"
    assert await service.trip_honeytoken(db_session, forged) is False
    # Token valide signé mais inexistant en base → False (neutre).
    ghost = service.generate_token(co.id)
    assert await service.trip_honeytoken(db_session, ghost) is False
    assert await _critical_events(db_session, co.id) == []


@pytest.mark.asyncio
async def test_trip_deactivated_does_not_alert(db_session: AsyncSession) -> None:
    co = await _make_company(db_session)
    ht = await service.create_honeytoken(db_session, co.id, kind="url", label="old")
    await service.delete_honeytoken(db_session, co.id, ht.id)  # soft-delete → inactif
    assert await service.trip_honeytoken(db_session, ht.token) is False
    assert await _critical_events(db_session, co.id) == []


# ─────────────────────────────────────────────────────────────────────────
# F5 — router admin (HTTP, authentifié)
# ─────────────────────────────────────────────────────────────────────────


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_admin_crud_roundtrip(client, seed_admin: tuple) -> None:  # noqa: ANN001
    admin, token = seed_admin
    r = await client.post(
        "/api/v1/admin/honeytokens",
        headers=_auth(token),
        json={"kind": "api_key", "label": "Faux secret DEWA"},
    )
    assert r.status_code == 201, r.text
    body = r.json()["data"]
    assert service.parse_token(body["token"]) == admin.company_id  # token signé pour le tenant
    hid = body["id"]

    lst = await client.get("/api/v1/admin/honeytokens", headers=_auth(token))
    assert any(x["id"] == hid for x in lst.json()["data"])

    d = await client.delete(f"/api/v1/admin/honeytokens/{hid}", headers=_auth(token))
    assert d.status_code == 200
    lst2 = await client.get("/api/v1/admin/honeytokens", headers=_auth(token))
    assert all(x["id"] != hid for x in lst2.json()["data"])
    # Suppression d'un id inconnu → 404.
    assert (
        await client.delete(f"/api/v1/admin/honeytokens/{hid}", headers=_auth(token))
    ).status_code == 404


@pytest.mark.asyncio
async def test_admin_requires_auth(client) -> None:  # noqa: ANN001
    assert (await client.get("/api/v1/admin/honeytokens")).status_code == 401
    assert (
        await client.post("/api/v1/admin/honeytokens", json={"kind": "url", "label": "x"})
    ).status_code == 401


@pytest.mark.asyncio
async def test_admin_create_validates_input(client, seed_admin: tuple) -> None:  # noqa: ANN001
    _admin, token = seed_admin
    bad_kind = await client.post(
        "/api/v1/admin/honeytokens", headers=_auth(token), json={"kind": "tiktok", "label": "x"}
    )
    assert bad_kind.status_code == 422
    empty_label = await client.post(
        "/api/v1/admin/honeytokens", headers=_auth(token), json={"kind": "url", "label": ""}
    )
    assert empty_label.status_code == 422


# ─────────────────────────────────────────────────────────────────────────
# F6 — endpoint trip (HTTP, sans auth) — réponse neutre + alerte en fond
# ─────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_trip_http_fires_alert_and_is_neutral(
    client, db_session: AsyncSession, seed_admin: tuple
) -> None:  # noqa: ANN001
    admin, _token = seed_admin
    ht = await service.create_honeytoken(db_session, admin.company_id, kind="url", label="trap")

    res = await client.get(f"/api/v1/honeytokens/trip/{ht.token}")
    assert res.status_code == 404  # réponse neutre

    events = await _critical_events(db_session, admin.company_id)
    assert len(events) >= 1


@pytest.mark.asyncio
async def test_trip_http_unknown_token_is_neutral_404(client) -> None:  # noqa: ANN001
    # Token garbage → même 404 qu'une URL inexistante (aucun oracle).
    assert (await client.get("/api/v1/honeytokens/trip/not.a.token")).status_code == 404
    assert (await client.get("/api/v1/honeytokens/trip/x")).status_code == 404


# ── Loi 1 — Red-Team cross-tenant déterministe (≠404 = no-go) ─────────────


@pytest.mark.asyncio
async def test_admin_cross_tenant_isolation(client, seed_admin: tuple, second_admin: tuple) -> None:  # noqa: ANN001
    """La société B ne voit ni ne supprime JAMAIS le leurre de la société A."""
    _admin_a, token_a = seed_admin
    _company_b, token_b = second_admin

    a_id = (
        await client.post(
            "/api/v1/admin/honeytokens",
            headers=_auth(token_a),
            json={"kind": "url", "label": "Secret de A"},
        )
    ).json()["data"]["id"]

    # B ne voit pas le leurre de A.
    lst_b = await client.get("/api/v1/admin/honeytokens", headers=_auth(token_b))
    assert all(x["id"] != a_id for x in lst_b.json()["data"])

    # B ne peut pas supprimer le leurre de A → 404 (BOLA bloqué).
    assert (
        await client.delete(f"/api/v1/admin/honeytokens/{a_id}", headers=_auth(token_b))
    ).status_code == 404

    # A le voit toujours (B n'a rien pu altérer).
    lst_a = await client.get("/api/v1/admin/honeytokens", headers=_auth(token_a))
    assert any(x["id"] == a_id for x in lst_a.json()["data"])
