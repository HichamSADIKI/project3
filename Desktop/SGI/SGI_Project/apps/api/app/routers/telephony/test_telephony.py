"""Tests Téléphonie.

- Helpers purs : machines à états, référence, durées, parsing AMI (sans DB).
- Intégration HTTP : CRUD appels, transitions, présence agent, screen pop,
  isolation multi-tenant (Loi 1).
"""

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient

from app.models.user import User
from app.routers.telephony import ami, service

# ─────────────────────────────────────────────────────────────────────────
# Helpers purs (aucune DB)
# ─────────────────────────────────────────────────────────────────────────


def test_call_transition_valid() -> None:
    assert service.is_valid_call_transition("ringing", "answered")
    assert service.is_valid_call_transition("answered", "completed")
    assert service.is_valid_call_transition("ringing", "missed")


def test_call_transition_invalid() -> None:
    assert not service.is_valid_call_transition("ringing", "completed")
    assert not service.is_valid_call_transition("completed", "answered")
    assert not service.is_valid_call_transition("missed", "ringing")
    assert not service.is_valid_call_transition("unknown", "answered")


def test_terminal_call_status() -> None:
    assert service.is_terminal_call_status("completed")
    assert service.is_terminal_call_status("missed")
    assert not service.is_terminal_call_status("ringing")
    assert not service.is_terminal_call_status("answered")


def test_agent_transition() -> None:
    assert service.is_valid_agent_transition("offline", "available")
    assert service.is_valid_agent_transition("available", "busy")
    assert service.is_valid_agent_transition("busy", "wrap_up")
    # Invalides
    assert not service.is_valid_agent_transition("available", "wrap_up")
    assert not service.is_valid_agent_transition("offline", "busy")
    assert not service.is_valid_agent_transition("available", "available")  # no-op


def test_generate_reference_format() -> None:
    assert service.generate_reference(2026, 42) == "CALL-2026-000042"
    assert service.generate_reference(2026, 1) == "CALL-2026-000001"
    # Triable lexicographiquement
    assert service.generate_reference(2026, 9) < service.generate_reference(2026, 10)


def test_compute_wait() -> None:
    start = datetime(2026, 6, 1, 10, 0, 0, tzinfo=UTC)
    answer = start + timedelta(seconds=12)
    assert service.compute_wait(start, answer) == 12
    assert service.compute_wait(start, None) is None
    assert service.compute_wait(None, answer) is None


def test_compute_duration() -> None:
    answer = datetime(2026, 6, 1, 10, 0, 0, tzinfo=UTC)
    end = answer + timedelta(seconds=95)
    assert service.compute_duration(answer, end) == 95
    assert service.compute_duration(None, end) is None
    # Horloge incohérente → clampé à 0, jamais négatif
    assert service.compute_duration(end, answer) == 0


def test_map_hangup_to_status() -> None:
    assert service.map_hangup_to_status(True, "inbound", None) == "completed"
    assert service.map_hangup_to_status(False, "inbound", "Normal") == "missed"
    assert service.map_hangup_to_status(False, "outbound", "Normal") == "no_answer"
    assert service.map_hangup_to_status(False, "inbound", "User busy") == "busy"
    assert service.map_hangup_to_status(False, "outbound", "Cancelled") == "cancelled"
    assert service.map_hangup_to_status(False, "inbound", "Congestion") == "failed"


def test_infer_call_direction() -> None:
    assert service.infer_call_direction("6005", {"6005", "6006"}) == "internal"
    assert service.infer_call_direction("971500000000", {"6005"}) == "inbound"
    assert service.infer_call_direction(None, {"6005"}) == "inbound"
    assert service.infer_call_direction("6005", set()) == "inbound"


def test_parse_ami_packet() -> None:
    raw = "Event: Newchannel\r\nChannel: PJSIP/6001-0000001\r\nCallerIDNum: 971500000000\r\n"
    pkt = ami.parse_ami_packet(raw)
    assert pkt["Event"] == "Newchannel"
    assert pkt["Channel"] == "PJSIP/6001-0000001"
    assert pkt["CallerIDNum"] == "971500000000"


def test_parse_ami_packet_ignores_garbage() -> None:
    pkt = ami.parse_ami_packet("Event: Hangup\nno-colon-line\n\n")
    assert pkt == {"Event": "Hangup"}


def test_extension_from_channel() -> None:
    assert ami._extension_from_channel("PJSIP/6001-00000003") == "6001"
    assert ami._extension_from_channel("") is None
    assert ami._extension_from_channel("invalid") is None


def test_normalize_ami_event_relevant() -> None:
    pkt = {
        "Event": "Newchannel",
        "Channel": "PJSIP/6001-00000003",
        "CallerIDNum": "971500000000",
        "Uniqueid": "abc",
    }
    ev = ami.normalize_ami_event(pkt)
    assert ev is not None
    assert ev["type"] == "call.ringing"
    assert ev["extension"] == "6001"
    assert ev["data"]["caller_number"] == "971500000000"


def test_normalize_ami_event_irrelevant() -> None:
    assert ami.normalize_ami_event({"Event": "RTCPSent"}) is None


# ─────────────────────────────────────────────────────────────────────────
# CDR via AMI (entrants/internes) — persistance idempotente + cycle de vie
# ─────────────────────────────────────────────────────────────────────────


def _ami_event(
    event: str,
    linkedid: str,
    *,
    ext: str = "6001",
    state: str | None = None,
    caller: str = "971500000000",
    cause: str | None = None,
) -> dict:
    pkt = {
        "Event": event,
        "Linkedid": linkedid,
        "Channel": f"PJSIP/{ext}-00000001",
        "CallerIDNum": caller,
    }
    if state:
        pkt["ChannelStateDesc"] = state
    if cause:
        pkt["Cause-txt"] = cause
    return ami.normalize_ami_event(pkt)


async def test_get_or_create_call_by_channel_idempotent(db_session, seed_company) -> None:
    cid = seed_company.id
    c1, created1 = await service.get_or_create_call_by_channel(
        db_session, cid, "chan-1", direction="inbound"
    )
    c2, created2 = await service.get_or_create_call_by_channel(db_session, cid, "chan-1")
    assert created1 is True and created2 is False
    assert c1.id == c2.id


async def test_ami_cdr_inbound_lifecycle(db_session, seed_company) -> None:
    cid = seed_company.id
    link = "link-inbound-aaa"
    c1 = await service.apply_ami_cdr(db_session, cid, _ami_event("Newchannel", link))
    assert c1.direction == "inbound" and c1.status == "ringing"
    assert c1.channel_id == link and c1.from_number == "971500000000"

    c2 = await service.apply_ami_cdr(
        db_session, cid, _ami_event("Newstate", link, state="Up")
    )
    assert c2.id == c1.id and c2.status == "answered" and c2.answered_at is not None

    c3 = await service.apply_ami_cdr(
        db_session, cid, _ami_event("Hangup", link, cause="Normal Clearing")
    )
    assert c3.status == "completed" and c3.ended_at is not None


async def test_ami_cdr_inbound_unanswered_is_missed(db_session, seed_company) -> None:
    cid = seed_company.id
    link = "link-inbound-bbb"
    await service.apply_ami_cdr(db_session, cid, _ami_event("Newchannel", link))
    c = await service.apply_ami_cdr(
        db_session, cid, _ami_event("Hangup", link, cause="Normal")
    )
    # Jamais décroché + entrant → manqué.
    assert c.status == "missed"


async def test_ami_cdr_idempotent_no_duplicate(db_session, seed_company) -> None:
    """Deux réplicas reçoivent le même Newchannel → une seule ligne."""
    cid = seed_company.id
    link = "link-dup-ccc"
    a = await service.apply_ami_cdr(db_session, cid, _ami_event("Newchannel", link))
    b = await service.apply_ami_cdr(db_session, cid, _ami_event("Newchannel", link))
    assert a.id == b.id
    _, total = await service.list_calls(db_session, cid)
    assert total == 1


async def test_ami_cdr_consent_fail_closed_by_default(
    db_session, seed_company, monkeypatch
) -> None:
    """PDPL : un CDR créé par l'AMI n'est pas présumé consenti par défaut."""
    from app.core.config import settings

    monkeypatch.setattr(settings, "TELEPHONY_ASSUME_RECORDING_CONSENT", False)
    c = await service.apply_ami_cdr(
        db_session, seed_company.id, _ami_event("Newchannel", "link-consent-off")
    )
    assert c.recording_consent is False

    monkeypatch.setattr(settings, "TELEPHONY_ASSUME_RECORDING_CONSENT", True)
    c2 = await service.apply_ami_cdr(
        db_session, seed_company.id, _ami_event("Newchannel", "link-consent-on")
    )
    assert c2.recording_consent is True


async def test_set_agent_status_extension_conflict_raises(db_session, seed_admin) -> None:
    """Deux agents du même tenant ne peuvent pas réclamer la même extension → 409."""
    import uuid as _u

    from app.core.auth import hash_password
    from app.models.user import User as _User
    from app.models.user import UserRole, UserStatus

    admin, _ = seed_admin
    cid = admin.company_id
    await service.set_agent_status(db_session, cid, admin.id, "available", extension="6007")

    u2 = _User(
        id=_u.uuid4(), company_id=cid, email=f"a2-{_u.uuid4().hex[:6]}@t.test",
        hashed_password=hash_password("x"), full_name="U2",
        role=UserRole.ADMIN.value, status=UserStatus.ACTIVE.value, is_active=True,
    )
    db_session.add(u2)
    await db_session.commit()
    with pytest.raises(ValueError, match="extension_taken"):
        await service.set_agent_status(db_session, cid, u2.id, "available", extension="6007")


async def test_ami_cdr_internal_when_caller_is_known_extension(
    db_session, seed_admin
) -> None:
    """Appelant = extension connue du tenant → direction `internal`."""
    admin, _ = seed_admin
    cid = admin.company_id
    await service.set_agent_status(
        db_session, cid, admin.id, "available", extension="6005"
    )
    ev = _ami_event("Newchannel", "link-internal-1", ext="6006", caller="6005")
    c = await service.apply_ami_cdr(db_session, cid, ev)
    assert c.direction == "internal" and c.from_number == "6005"


async def test_ami_cdr_inbound_when_caller_is_external(db_session, seed_company) -> None:
    """Appelant externe (numéro UAE) → direction `inbound`."""
    ev = _ami_event("Newchannel", "link-ext-1", ext="6001", caller="971501234567")
    c = await service.apply_ami_cdr(db_session, seed_company.id, ev)
    assert c.direction == "inbound"


async def test_ami_cdr_reuses_outbound_rest_row(db_session, seed_company) -> None:
    """Sortant click-to-call : le CDR REST (channel_id=Linkedid) est réutilisé."""
    cid = seed_company.id
    link = "sgi-deadbeef"
    rest = await service.create_call(
        db_session, cid, direction="outbound", channel_id=link, agent_extension="6001"
    )
    updated = await service.apply_ami_cdr(
        db_session, cid, _ami_event("Newstate", link, state="Up")
    )
    assert updated.id == rest.id
    assert updated.direction == "outbound"  # direction préservée
    assert updated.status == "answered"


# ─────────────────────────────────────────────────────────────────────────
# Intégration HTTP
# ─────────────────────────────────────────────────────────────────────────


async def test_health_is_public(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/telephony/health")
    assert resp.status_code == 200
    assert resp.json()["module"] == "telephony"


async def test_create_then_get_call(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    created = await client.post(
        "/api/v1/telephony/calls",
        json={"direction": "inbound", "from_number": "971501112233"},
        headers=headers,
    )
    assert created.status_code == 201
    data = created.json()["data"]
    assert data["reference"].startswith("CALL-")
    assert data["status"] == "ringing"
    cid = data["id"]

    got = await client.get(f"/api/v1/telephony/calls/{cid}", headers=headers)
    assert got.status_code == 200
    assert got.json()["data"]["from_number"] == "971501112233"


async def test_list_calls_tenant_isolation(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[object, str],
) -> None:
    _, token = seed_admin
    _, other_token = second_admin
    await client.post(
        "/api/v1/telephony/calls",
        json={"direction": "inbound", "from_number": "971509998877"},
        headers={"Authorization": f"Bearer {token}"},
    )
    # Le 2ᵉ tenant ne voit pas l'appel du 1er (Loi 1).
    resp = await client.get(
        "/api/v1/telephony/calls",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["meta"]["total"] == 0


async def test_call_transition_lifecycle(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    created = await client.post(
        "/api/v1/telephony/calls",
        json={"direction": "inbound", "from_number": "971500000001"},
        headers=headers,
    )
    cid = created.json()["data"]["id"]

    answered = await client.post(
        f"/api/v1/telephony/calls/{cid}/transition",
        json={"status": "answered"},
        headers=headers,
    )
    assert answered.status_code == 200
    assert answered.json()["data"]["answered_at"] is not None

    completed = await client.post(
        f"/api/v1/telephony/calls/{cid}/transition",
        json={"status": "completed"},
        headers=headers,
    )
    assert completed.status_code == 200
    body = completed.json()["data"]
    assert body["status"] == "completed"
    assert body["ended_at"] is not None
    assert body["duration_seconds"] is not None


async def test_call_transition_invalid_returns_409(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    created = await client.post(
        "/api/v1/telephony/calls",
        json={"direction": "inbound"},
        headers=headers,
    )
    cid = created.json()["data"]["id"]
    # ringing → completed direct est interdit.
    resp = await client.post(
        f"/api/v1/telephony/calls/{cid}/transition",
        json={"status": "completed"},
        headers=headers,
    )
    assert resp.status_code == 409


async def test_agent_status_set_and_transition(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    # Création (available) + extension
    r1 = await client.post(
        "/api/v1/telephony/agents/me/status",
        json={"status": "available", "extension": "6001"},
        headers=headers,
    )
    assert r1.status_code == 200
    assert r1.json()["data"]["extension"] == "6001"

    # available → busy : valide
    r2 = await client.post(
        "/api/v1/telephony/agents/me/status",
        json={"status": "busy"},
        headers=headers,
    )
    assert r2.status_code == 200
    assert r2.json()["data"]["status"] == "busy"


async def test_agent_invalid_transition_returns_409(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    await client.post(
        "/api/v1/telephony/agents/me/status",
        json={"status": "available", "extension": "6002"},
        headers=headers,
    )
    # available → wrap_up : interdit
    resp = await client.post(
        "/api/v1/telephony/agents/me/status",
        json={"status": "wrap_up"},
        headers=headers,
    )
    assert resp.status_code == 409


async def test_phone_lookup_screen_pop(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    # On crée un client avec un numéro UAE.
    await client.post(
        "/api/v1/clients/",
        json={
            "type": "individual",
            "first_name": "Layla",
            "last_name": "Al Maktoum",
            "phone": "+971501234567",
        },
        headers=headers,
    )
    # Appel entrant depuis une variante de format → doit matcher sur le suffixe.
    resp = await client.get(
        "/api/v1/telephony/lookup",
        params={"phone": "00971501234567"},
        headers=headers,
    )
    assert resp.status_code == 200
    matches = resp.json()["data"]
    assert len(matches) >= 1
    assert "Layla" in matches[0]["display_name"]


async def test_lookup_requires_auth(client: AsyncClient) -> None:
    # Depuis le durcissement H-2, /lookup porte un garde de rôle
    # (admin/manager/agent) : une requête sans token est refusée par ce garde
    # (403) avant même le contrôle de contexte tenant (401). 403 = plus sûr.
    resp = await client.get("/api/v1/telephony/lookup", params={"phone": "971501234567"})
    assert resp.status_code == 403


async def test_click_to_call_requires_extension(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    """Sans extension agent (pas d'agent_state, pas de champ) → 400."""
    _, token = seed_admin
    resp = await client.post(
        "/api/v1/telephony/calls/click-to-call",
        json={"to_number": "971501112233"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


async def test_click_to_call_503_when_ami_unavailable(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    """Extension fournie mais AMI down (cas test) → CDR créé puis 503."""
    _, token = seed_admin
    resp = await client.post(
        "/api/v1/telephony/calls/click-to-call",
        json={"to_number": "971501112233", "agent_extension": "6001"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 503


async def test_click_to_call_persists_channel_id(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    """Même si l'Originate échoue (AMI down → 503), le CDR outbound est créé
    AVANT avec un channel_id → linkage pour le worker d'upload (#6)."""
    _, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    await client.post(
        "/api/v1/telephony/calls/click-to-call",
        json={"to_number": "6002", "agent_extension": "6001"},
        headers=headers,
    )
    listing = await client.get(
        "/api/v1/telephony/calls", params={"direction": "outbound"}, headers=headers
    )
    rows = listing.json()["data"]
    assert rows, "un CDR outbound doit exister malgré l'échec AMI"
    assert all(r["direction"] == "outbound" for r in rows)


async def test_my_agent_state_404_before_set(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _, token = seed_admin
    resp = await client.get(
        "/api/v1/telephony/agents/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


async def test_agents_list_returns_set_states(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _, token = seed_admin
    headers = {"Authorization": f"Bearer {token}"}
    await client.post(
        "/api/v1/telephony/agents/me/status",
        json={"status": "available", "extension": "6009"},
        headers=headers,
    )
    resp = await client.get("/api/v1/telephony/agents", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert any(a["extension"] == "6009" for a in data)
    # Filtre par statut
    resp2 = await client.get(
        "/api/v1/telephony/agents", params={"status": "busy"}, headers=headers
    )
    assert all(a["status"] == "busy" for a in resp2.json()["data"])


async def test_create_call_forbidden_for_client_role(
    client: AsyncClient, seed_admin: tuple[User, str], db_session
) -> None:
    """Un utilisateur de rôle 'client' ne peut pas créer d'appel."""
    from app.core.auth import encode_jwt

    admin, _ = seed_admin
    bad_token = encode_jwt(
        {
            "sub": str(admin.id),
            "company_id": str(admin.company_id),
            "role": "client",
            "status": "active",
            "email": admin.email,
        }
    )
    resp = await client.post(
        "/api/v1/telephony/calls",
        json={"direction": "inbound"},
        headers={"Authorization": f"Bearer {bad_token}"},
    )
    assert resp.status_code == 403
