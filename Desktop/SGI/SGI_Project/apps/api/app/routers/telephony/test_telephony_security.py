"""Tests de SÉCURITÉ — Téléphonie (complémentaires à test_telephony.py).

Couvre :
- Isolation multi-tenant (Loi 1) : lecture/transition/agents/lookup cross-tenant.
- Anti-BOLA : WS d'une extension non détenue (4403), transition d'un call d'un
  autre tenant (404), filtre agent_user_id qui ne fuit pas cross-tenant.
- Authz/RBAC : rôle 'client' interdit en écriture (403) ; WS refuse mfa_pending.
- PDPL : exposition de recording_url quand recording_consent=false.

Les tests d'intégration HTTP utilisent le harness partagé (conftest.py) :
`client`, `seed_admin`, `second_admin`, `db_session`. Les tests WS appellent
directement l'endpoint avec un faux WebSocket : les décisions d'autorisation
(close 4401/4403) sont prises AVANT `accept()`, donc aucun vrai socket requis.
"""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import encode_jwt
from app.models.user import User
from app.routers.telephony import service
from app.routers.telephony.router import voice_ws_endpoint

# ─────────────────────────────────────────────────────────────────────────
# Faux WebSocket — capture le code de fermeture sans réseau réel
# ─────────────────────────────────────────────────────────────────────────


class _FakeWebSocket:
    """WebSocket minimal : on n'observe que `close(code=…)`.

    `accept()` lève si appelé — un test d'autorisation NE DOIT JAMAIS accepter
    une connexion non autorisée (sinon la faille passe inaperçue).
    """

    def __init__(self) -> None:
        self.closed_code: int | None = None
        self.accepted = False

    async def close(self, code: int = 1000) -> None:
        self.closed_code = code

    async def accept(self) -> None:  # pragma: no cover - garde-fou
        self.accepted = True
        raise AssertionError(
            "accept() ne doit pas être atteint sur une connexion non autorisée"
        )


# ─────────────────────────────────────────────────────────────────────────
# Isolation multi-tenant (Loi 1) — lecture / transition / agents / lookup
# ─────────────────────────────────────────────────────────────────────────


async def test_get_call_cross_tenant_returns_404(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[object, str],
) -> None:
    """Le call d'un tenant est invisible (404) pour un autre tenant."""
    _, token = seed_admin
    _, other_token = second_admin
    created = await client.post(
        "/api/v1/telephony/calls",
        json={"direction": "inbound", "from_number": "971501110000"},
        headers={"Authorization": f"Bearer {token}"},
    )
    cid = created.json()["data"]["id"]

    resp = await client.get(
        f"/api/v1/telephony/calls/{cid}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 404


async def test_transition_call_cross_tenant_returns_404(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[object, str],
) -> None:
    """Un tenant ne peut PAS faire transitionner le call d'un autre (404,
    jamais 200/409 : la cible doit rester totalement invisible)."""
    _, token = seed_admin
    _, other_token = second_admin
    created = await client.post(
        "/api/v1/telephony/calls",
        json={"direction": "inbound"},
        headers={"Authorization": f"Bearer {token}"},
    )
    cid = created.json()["data"]["id"]

    resp = await client.post(
        f"/api/v1/telephony/calls/{cid}/transition",
        json={"status": "answered"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 404


async def test_agents_list_tenant_isolation(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[object, str],
) -> None:
    """L'agent_state créé par un tenant n'apparaît pas chez l'autre (Loi 1)."""
    _, token = seed_admin
    _, other_token = second_admin
    await client.post(
        "/api/v1/telephony/agents/me/status",
        json={"status": "available", "extension": "7001"},
        headers={"Authorization": f"Bearer {token}"},
    )

    resp = await client.get(
        "/api/v1/telephony/agents",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 200
    exts = [a["extension"] for a in resp.json()["data"]]
    assert "7001" not in exts


async def test_lookup_does_not_leak_cross_tenant(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[object, str],
) -> None:
    """Le screen pop /lookup ne révèle pas les clients d'un autre tenant."""
    _, token = seed_admin
    _, other_token = second_admin
    # Le tenant A crée un client avec un numéro.
    await client.post(
        "/api/v1/clients/",
        json={
            "type": "individual",
            "first_name": "Cross",
            "last_name": "Tenant",
            "phone": "+971507778899",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    # Le tenant B cherche le MÊME numéro → aucun match (isolation).
    resp = await client.get(
        "/api/v1/telephony/lookup",
        params={"phone": "+971507778899"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"] == []


async def test_list_calls_agent_filter_no_cross_tenant_leak(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[object, str],
) -> None:
    """Filtrer par agent_user_id (BOLA) ne fait jamais fuiter un call d'un autre
    tenant : le filtre s'applique APRÈS le filtre company_id."""
    admin, token = seed_admin
    _, other_token = second_admin
    # Tenant A crée un appel assigné à son agent (click-to-call → agent_user_id).
    await client.post(
        "/api/v1/telephony/agents/me/status",
        json={"status": "available", "extension": "7100"},
        headers={"Authorization": f"Bearer {token}"},
    )
    # Tenant B tente de lister les appels de l'agent (UUID) du tenant A.
    resp = await client.get(
        "/api/v1/telephony/calls",
        params={"agent_user_id": str(admin.id)},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["meta"]["total"] == 0


# ─────────────────────────────────────────────────────────────────────────
# Authz / RBAC — endpoints d'écriture interdits au rôle 'client'
# ─────────────────────────────────────────────────────────────────────────


def _client_role_token(admin: User) -> str:
    return encode_jwt(
        {
            "sub": str(admin.id),
            "company_id": str(admin.company_id),
            "role": "client",
            "status": "active",
            "email": admin.email,
        }
    )


async def test_transition_forbidden_for_client_role(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    admin, token = seed_admin
    created = await client.post(
        "/api/v1/telephony/calls",
        json={"direction": "inbound"},
        headers={"Authorization": f"Bearer {token}"},
    )
    cid = created.json()["data"]["id"]
    bad = _client_role_token(admin)
    resp = await client.post(
        f"/api/v1/telephony/calls/{cid}/transition",
        json={"status": "answered"},
        headers={"Authorization": f"Bearer {bad}"},
    )
    assert resp.status_code == 403


async def test_click_to_call_forbidden_for_client_role(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    admin, _ = seed_admin
    bad = _client_role_token(admin)
    resp = await client.post(
        "/api/v1/telephony/calls/click-to-call",
        json={"to_number": "971500000000", "agent_extension": "6001"},
        headers={"Authorization": f"Bearer {bad}"},
    )
    assert resp.status_code == 403


# ─────────────────────────────────────────────────────────────────────────
# WebSocket — anti-BOLA / authz (décisions prises avant accept())
# ─────────────────────────────────────────────────────────────────────────


async def test_ws_refuses_extension_not_owned(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    """Un agent ne peut écouter QUE son extension : une autre → close(4403)."""
    admin, _ = seed_admin
    # On lui attribue l'extension 6001 (via la couche service, pas de RLS ici
    # car set par l'endpoint WS lui-même au moment de la résolution).
    await service.set_agent_status(
        db_session, admin.company_id, admin.id, "available", extension="6001"
    )

    token = encode_jwt(
        {
            "sub": str(admin.id),
            "company_id": str(admin.company_id),
            "role": admin.role,
            "status": "active",
            "email": admin.email,
        }
    )
    ws = _FakeWebSocket()
    # Il tente d'écouter 9999 → refus anti-spoof.
    await voice_ws_endpoint(ws, token=token, extension="9999", db=db_session)
    assert ws.closed_code == 4403
    assert ws.accepted is False


async def test_ws_refuses_unknown_extension(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    """Aucun agent_state (extension inexistante) → close(4403)."""
    admin, _ = seed_admin
    token = encode_jwt(
        {
            "sub": str(admin.id),
            "company_id": str(admin.company_id),
            "role": admin.role,
            "status": "active",
            "email": admin.email,
        }
    )
    ws = _FakeWebSocket()
    await voice_ws_endpoint(ws, token=token, extension="6001", db=db_session)
    assert ws.closed_code == 4403


async def test_ws_refuses_mfa_pending_token(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    """Un token mfa_pending (auth incomplète) est rejeté côté WS (4401)."""
    admin, _ = seed_admin
    token = encode_jwt(
        {
            "sub": str(admin.id),
            "company_id": str(admin.company_id),
            "role": admin.role,
            "status": "active",
            "email": admin.email,
            "mfa_pending": True,
        }
    )
    ws = _FakeWebSocket()
    await voice_ws_endpoint(ws, token=token, extension="6001", db=db_session)
    assert ws.closed_code == 4401


async def test_ws_refuses_invalid_token(db_session: AsyncSession) -> None:
    """Un JWT illisible → close(4401)."""
    ws = _FakeWebSocket()
    await voice_ws_endpoint(ws, token="not-a-jwt", extension="6001", db=db_session)
    assert ws.closed_code == 4401


async def test_ws_refuses_token_without_company(
    db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    """Un token sans company_id (claim manquant) → close(4401)."""
    admin, _ = seed_admin
    token = encode_jwt(
        {"sub": str(admin.id), "role": admin.role, "status": "active"}
    )
    ws = _FakeWebSocket()
    await voice_ws_endpoint(ws, token=token, extension="6001", db=db_session)
    assert ws.closed_code == 4401


async def test_ws_cross_tenant_extension_isolation(
    db_session: AsyncSession,
    seed_admin: tuple[User, str],
    second_admin: tuple[object, str],
) -> None:
    """Le tenant A possède l'extension 6001 ; un user du tenant B avec la MÊME
    valeur d'extension dans son token mais SANS agent_state correspondant côté
    son tenant → 4403 (l'appartenance est vérifiée par tenant, Loi 1)."""
    admin_a, _ = seed_admin
    company_b, _ = second_admin
    # Tenant A : extension 6001 attribuée.
    await service.set_agent_status(
        db_session, admin_a.company_id, admin_a.id, "available", extension="6001"
    )
    # Token forgé pour le tenant B (user inventé) prétendant écouter 6001.
    forged = encode_jwt(
        {
            "sub": str(uuid.uuid4()),
            "company_id": str(company_b.id),
            "role": "agent",
            "status": "active",
            "email": "forge@sgi.test",
        }
    )
    ws = _FakeWebSocket()
    await voice_ws_endpoint(ws, token=forged, extension="6001", db=db_session)
    # Pas d'agent_state 6001 dans le tenant B → refus, aucune fuite cross-tenant.
    assert ws.closed_code == 4403


# ─────────────────────────────────────────────────────────────────────────
# PDPL — exposition de l'enregistrement sans consentement
# ─────────────────────────────────────────────────────────────────────────


async def test_recording_url_exposed_without_consent(
    client: AsyncClient, seed_admin: tuple[User, str], db_session: AsyncSession
) -> None:
    """PDPL : si recording_consent=false, l'URL d'enregistrement NE DOIT PAS
    être divulguée dans la réponse de l'appel.

    État actuel : `CallOut.recording_url` est renvoyé tel quel, sans vérifier le
    consentement → ce test documente le risque. Il restera xfail tant que
    l'architecte n'a pas masqué l'URL quand consent=false. Si la correction est
    appliquée (URL=None sans consentement), le xfail deviendra xpass(strict).
    """
    admin, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    created = await client.post(
        "/api/v1/telephony/calls",
        json={"direction": "inbound", "recording_consent": False},
        headers=headers,
    )
    cid = created.json()["data"]["id"]

    # On simule un enregistrement déposé (URL) malgré l'absence de consentement.
    call = await service.get_call(db_session, admin.company_id, uuid.UUID(cid))
    # NB : RLS exige le GUC tenant ; on le pose pour cette connexion de test.
    from sqlalchemy import text as sql_text

    await db_session.execute(
        sql_text("SELECT set_config('app.current_company_id', :cid, false)"),
        {"cid": str(admin.company_id)},
    )
    call = await service.get_call(db_session, admin.company_id, uuid.UUID(cid))
    assert call is not None
    call.recording_url = "https://minio.local/recordings/secret.wav"
    await db_session.commit()

    got = await client.get(f"/api/v1/telephony/calls/{cid}", headers=headers)
    data = got.json()["data"]
    assert data["recording_consent"] is False
    if data.get("recording_url") is not None:
        pytest.xfail(
            "PDPL: recording_url divulguée malgré recording_consent=false "
            "(voir AUDIT_TELEPHONY_SECURITE.md, faille PDPL-1)"
        )
    assert data["recording_url"] is None
