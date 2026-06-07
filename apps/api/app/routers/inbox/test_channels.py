"""Tests — Inbox channel configs (routage tenant des canaux externes).

Couvre :
- CRUD tenant-scopé (`POST/GET/DELETE /inbox/channels`) + rôles.
- Unicité globale du `phone_number_id` (conflit cross-tenant → 409).
- Isolation Loi 1 (liste/suppression cross-tenant invisibles) + Red-Team.
- Résolution via la fonction SECURITY DEFINER `inbox_resolve_company`.
- Webhook WhatsApp e2e résolu par la table (pas par l'env).

Requiert PostgreSQL + la migration 0045 (`docker compose … alembic upgrade head`
puis pytest). RLS non forcée en test (rôle privilégié) : l'unicité globale et le
scoping company_id explicite sont validés au niveau requête/contrainte.
"""

from __future__ import annotations

import uuid

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.user import User
from app.routers.inbox import service, webhook


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _never_processed(external_message_id: str) -> bool:
    """Court-circuite la dédup Valkey (pas de broker en test)."""
    return False


def _wa_payload(phone_number_id: str, msg_id: str, sender: str = "971500000001") -> dict:
    return {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {"phone_number_id": phone_number_id},
                            "contacts": [{"wa_id": sender, "profile": {"name": "Noor"}}],
                            "messages": [
                                {
                                    "id": msg_id,
                                    "from": sender,
                                    "timestamp": "1717322400",
                                    "type": "text",
                                    "text": {"body": "Marhaba"},
                                }
                            ],
                        }
                    }
                ]
            }
        ]
    }


# ── CRUD tenant-scopé ─────────────────────────────────────────────────────


async def test_enroll_list_delete_channel(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    pid = f"PNID-{uuid.uuid4().hex[:8]}"

    r = await client.post(
        "/api/v1/inbox/channels",
        headers=_auth(token),
        json={
            "phone_number_id": pid,
            "label": "Ligne support",
            "display_phone_number": "+971500000001",
        },
    )
    assert r.status_code == 201, r.text
    cfg = r.json()["data"]
    assert cfg["phone_number_id"] == pid
    assert cfg["channel"] == "whatsapp"
    assert cfg["is_active"] is True
    config_id = cfg["id"]

    # Liste : le canal apparaît.
    r = await client.get("/api/v1/inbox/channels", headers=_auth(token))
    assert r.status_code == 200, r.text
    assert pid in [c["phone_number_id"] for c in r.json()["data"]]

    # Suppression (soft) → 200 ; puis absent de la liste.
    r = await client.delete(f"/api/v1/inbox/channels/{config_id}", headers=_auth(token))
    assert r.status_code == 200, r.text
    r = await client.get("/api/v1/inbox/channels", headers=_auth(token))
    assert pid not in [c["phone_number_id"] for c in r.json()["data"]]


async def test_enroll_is_idempotent_same_tenant(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    pid = f"PNID-{uuid.uuid4().hex[:8]}"
    r1 = await client.post(
        "/api/v1/inbox/channels", headers=_auth(token), json={"phone_number_id": pid}
    )
    assert r1.status_code == 201, r1.text
    # Ré-enrôlement par le même tenant → réactivation, pas d'erreur.
    r2 = await client.post(
        "/api/v1/inbox/channels",
        headers=_auth(token),
        json={"phone_number_id": pid, "label": "MAJ"},
    )
    assert r2.status_code == 201, r2.text
    assert r2.json()["data"]["id"] == r1.json()["data"]["id"]
    assert r2.json()["data"]["label"] == "MAJ"


async def test_delete_unknown_channel_404(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    r = await client.delete(f"/api/v1/inbox/channels/{uuid.uuid4()}", headers=_auth(token))
    assert r.status_code == 404, r.text


# ── Unicité globale + isolation Loi 1 ─────────────────────────────────────


async def test_enroll_conflict_cross_tenant_409(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
) -> None:
    """Un phone_number_id ne route que vers UN tenant : conflit cross-tenant → 409."""
    _admin, token_a = seed_admin
    _company_b, token_b = second_admin
    pid = f"PNID-{uuid.uuid4().hex[:8]}"

    r = await client.post(
        "/api/v1/inbox/channels", headers=_auth(token_a), json={"phone_number_id": pid}
    )
    assert r.status_code == 201, r.text

    # Tenant B tente le même phone_number_id → 409 (sans révéler à qui il est).
    r = await client.post(
        "/api/v1/inbox/channels", headers=_auth(token_b), json={"phone_number_id": pid}
    )
    assert r.status_code == 409, r.text
    assert r.json()["detail"] == "phone_number_id_taken"


async def test_channel_isolation_law1(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
) -> None:
    """Loi 1 : le canal de A est invisible/insupprimable pour B."""
    _admin, token_a = seed_admin
    _company_b, token_b = second_admin
    pid = f"PNID-{uuid.uuid4().hex[:8]}"
    r = await client.post(
        "/api/v1/inbox/channels", headers=_auth(token_a), json={"phone_number_id": pid}
    )
    config_id = r.json()["data"]["id"]

    # B ne voit pas le canal de A.
    r = await client.get("/api/v1/inbox/channels", headers=_auth(token_b))
    assert pid not in [c["phone_number_id"] for c in r.json()["data"]]

    # B ne peut pas le supprimer → 404 (anti-BOLA).
    r = await client.delete(f"/api/v1/inbox/channels/{config_id}", headers=_auth(token_b))
    assert r.status_code == 404, r.text


# ── Résolution SECURITY DEFINER ───────────────────────────────────────────


async def test_resolve_company_by_channel(db_session: AsyncSession, seed_company: Company) -> None:
    pid = f"PNID-{uuid.uuid4().hex[:8]}"
    await service.enroll_channel(
        db_session, seed_company.id, channel="whatsapp", phone_number_id=pid
    )
    resolved = await service.resolve_company_by_channel(db_session, "whatsapp", pid)
    assert resolved == seed_company.id
    # Inconnu / vide → None.
    assert await service.resolve_company_by_channel(db_session, "whatsapp", "NOPE") is None
    assert await service.resolve_company_by_channel(db_session, "whatsapp", None) is None


async def test_resolve_ignores_soft_deleted(
    db_session: AsyncSession, seed_company: Company
) -> None:
    pid = f"PNID-{uuid.uuid4().hex[:8]}"
    cfg = await service.enroll_channel(
        db_session, seed_company.id, channel="whatsapp", phone_number_id=pid
    )
    assert await service.delete_channel(db_session, seed_company.id, cfg.id) is True
    # Désenrôlé → la fonction ne doit plus le résoudre.
    assert await service.resolve_company_by_channel(db_session, "whatsapp", pid) is None


# ── Webhook e2e résolu par la table (pas l'env) ───────────────────────────


async def test_webhook_resolves_via_table(
    client: AsyncClient,
    db_session: AsyncSession,
    seed_company: Company,
    monkeypatch,
) -> None:
    """Le webhook ingère pour le bon tenant via inbox_channel_configs (sans env)."""
    monkeypatch.delenv("WHATSAPP_PHONE_NUMBER_MAP", raising=False)
    monkeypatch.delenv("WHATSAPP_APP_SECRET", raising=False)
    monkeypatch.setattr(webhook, "_already_processed", _never_processed)

    pid = f"PNID-{uuid.uuid4().hex[:8]}"
    await service.enroll_channel(
        db_session, seed_company.id, channel="whatsapp", phone_number_id=pid
    )

    payload = _wa_payload(pid, msg_id=f"wamid.{uuid.uuid4().hex[:10]}")
    r = await client.post("/api/v1/inbox/webhook/whatsapp", json=payload)
    assert r.status_code == 200, r.text
    assert r.json()["data"]["ingested"] == 1

    rows, total = await service.list_conversations(db_session, seed_company.id)
    assert total >= 1
    assert any(c.channel == "whatsapp" for c in rows)
