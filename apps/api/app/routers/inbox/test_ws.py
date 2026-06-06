"""Tests WebSocket Omnichannel Inbox — helpers purs (sans DB ni Valkey).

Couvrent le nommage des channels (namespacés par tenant — Loi 1, anti-fuite) et
les clés de présence. Le montage de l'endpoint WS et le fan-out Valkey sont
testés en intégration (hors de ces helpers purs).
"""

from app.routers.inbox.ws import (
    agent_channel,
    presence_key,
    tenant_channel,
)


def test_tenant_channel_namespaced_by_company() -> None:
    cid = "11111111-1111-1111-1111-111111111111"
    assert tenant_channel(cid) == f"inbox:{cid}"


def test_agent_channel_namespaced_by_company_and_user() -> None:
    cid = "11111111-1111-1111-1111-111111111111"
    uid = "22222222-2222-2222-2222-222222222222"
    assert agent_channel(cid, uid) == f"inbox:{cid}:agent:{uid}"


def test_tenant_isolation_distinct_channels() -> None:
    """Deux tenants ne partagent jamais le même channel (Loi 1)."""
    a = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    b = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    assert tenant_channel(a) != tenant_channel(b)
    # Même user_id improbable, mais tenants différents → channels disjoints.
    uid = "33333333-3333-3333-3333-333333333333"
    assert agent_channel(a, uid) != agent_channel(b, uid)


def test_agent_channel_distinct_from_tenant_channel() -> None:
    """Le flux agent est strictement plus spécifique que le flux tenant."""
    cid = "11111111-1111-1111-1111-111111111111"
    uid = "22222222-2222-2222-2222-222222222222"
    assert agent_channel(cid, uid) != tenant_channel(cid)
    assert agent_channel(cid, uid).startswith(tenant_channel(cid))


def test_distinct_agents_distinct_channels() -> None:
    """Deux agents du même tenant ont des flux distincts (anti-fuite intra-tenant)."""
    cid = "11111111-1111-1111-1111-111111111111"
    u1 = "22222222-2222-2222-2222-222222222222"
    u2 = "44444444-4444-4444-4444-444444444444"
    assert agent_channel(cid, u1) != agent_channel(cid, u2)


def test_presence_key_namespaced_by_tenant() -> None:
    cid = "11111111-1111-1111-1111-111111111111"
    uid = "22222222-2222-2222-2222-222222222222"
    assert presence_key(cid, uid) == f"inbox:presence:{cid}:{uid}"
    other = "55555555-5555-5555-5555-555555555555"
    assert presence_key(other, uid) != presence_key(cid, uid)
