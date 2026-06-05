"""Tests du sous-routeur infra-admin PLATEFORME (`/admin/platform/{servers,network}`).

Couvre :
- Frontière de sécurité : 401 anonyme, 403 pour un admin de société SANS le drapeau
  `is_platform_admin`, 200 pour `seed_platform_admin`.
- Helpers purs (`_availability_expr`, `_live_state_from_value`).
- Les DEUX chemins Prometheus, via monkeypatch de `instant_query` dans le namespace
  du routeur (`app.routers.admin.infra`) : succès (live_state + métriques) et
  `PrometheusUnavailableError` (dégradation propre, jamais de 500).

Périmètre cross-tenant (hors Loi 1) : pas de filtre company_id sur `infra_services`.
Le test d'isolation Loi 1 ne s'applique donc pas ici — la garde est
`require_platform_admin`, vérifiée ci-dessous (403 pour `seed_admin`).
"""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin import InfraService
from app.routers.admin import infra as infra_module
from app.routers.admin.infra import (
    _availability_expr,
    _live_state_from_value,
    map_prometheus_alert,
)
from app.routers.admin.prometheus import PrometheusUnavailableError

AUTH = "Authorization"


# ── Helpers purs (pas d'I/O) ──────────────────────────────────────────────────


def test_availability_expr_filters_by_job() -> None:
    assert _availability_expr("api") == 'up{job="api"}'


def test_availability_expr_strips_quotes() -> None:
    """Anti-injection PromQL basique : les guillemets INTERNES sont retirés du label.

    Le résultat n'a que les 2 guillemets qui encadrent la valeur du label `job`
    (aucun guillemet injecté ne survit → impossible de fermer le label prématurément).
    """
    expr = _availability_expr('api"} or up{job="x')
    assert expr == 'up{job="api} or up{job=x"}'
    assert expr.count('"') == 2


@pytest.mark.parametrize(
    ("value", "expected"),
    [(1.0, "up"), (1.5, "up"), (0.0, "down"), (0.4, "down"), (None, None)],
)
def test_live_state_from_value(value: float | None, expected: str | None) -> None:
    assert _live_state_from_value(value) == expected


# ── Frontière de sécurité ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_servers_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/admin/platform/servers")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_network_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/admin/platform/network")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_servers_forbidden_for_plain_admin(client: AsyncClient, seed_admin) -> None:
    """Admin de société SANS is_platform_admin → 403 (garde plateforme)."""
    _admin, token = seed_admin
    resp = await client.get("/api/v1/admin/platform/servers", headers={AUTH: f"Bearer {token}"})
    assert resp.status_code == 403
    assert resp.json()["detail"] == "platform_admin_required"


@pytest.mark.asyncio
async def test_network_forbidden_for_plain_admin(client: AsyncClient, seed_admin) -> None:
    _admin, token = seed_admin
    resp = await client.get("/api/v1/admin/platform/network", headers={AUTH: f"Bearer {token}"})
    assert resp.status_code == 403


# ── /servers — chemin Prometheus DISPONIBLE ───────────────────────────────────


@pytest.mark.asyncio
async def test_servers_with_prometheus_up(
    client: AsyncClient,
    db_session: AsyncSession,
    seed_platform_admin,
    monkeypatch,
) -> None:
    """Service présent + Prometheus répond `up=1` → live_state='up', flag true."""
    _admin, token = seed_platform_admin
    svc = InfraService(
        id=uuid.uuid4(),
        name=f"svc-{uuid.uuid4().hex[:8]}",
        kind="container",
        description="API container",
        is_controllable=False,
    )
    db_session.add(svc)
    await db_session.commit()

    async def fake_query(expr: str, *, timeout: float = 3.0) -> float | None:
        return 1.0

    monkeypatch.setattr(infra_module, "instant_query", fake_query)

    resp = await client.get("/api/v1/admin/platform/servers", headers={AUTH: f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["meta"]["prometheus_available"] is True
    assert body["meta"]["total"] >= 1
    target = next(item for item in body["data"] if item["name"] == svc.name)
    assert target["live_state"] == "up"


@pytest.mark.asyncio
async def test_servers_with_prometheus_down(
    client: AsyncClient,
    db_session: AsyncSession,
    seed_platform_admin,
    monkeypatch,
) -> None:
    """Prometheus répond `up=0` → live_state='down' (flag reste true)."""
    _admin, token = seed_platform_admin
    svc = InfraService(
        id=uuid.uuid4(),
        name=f"svc-{uuid.uuid4().hex[:8]}",
        kind="db",
        is_controllable=False,
    )
    db_session.add(svc)
    await db_session.commit()

    async def fake_query(expr: str, *, timeout: float = 3.0) -> float | None:
        return 0.0

    monkeypatch.setattr(infra_module, "instant_query", fake_query)

    resp = await client.get("/api/v1/admin/platform/servers", headers={AUTH: f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["meta"]["prometheus_available"] is True
    target = next(item for item in body["data"] if item["name"] == svc.name)
    assert target["live_state"] == "down"


# ── /servers — chemin Prometheus INDISPONIBLE (dégradation) ───────────────────


@pytest.mark.asyncio
async def test_servers_prometheus_unavailable_degrades(
    client: AsyncClient,
    db_session: AsyncSession,
    seed_platform_admin,
    monkeypatch,
) -> None:
    """Prometheus injoignable → 200, live_state=null, prometheus_available=false."""
    _admin, token = seed_platform_admin
    svc = InfraService(
        id=uuid.uuid4(),
        name=f"svc-{uuid.uuid4().hex[:8]}",
        kind="cache",
        is_controllable=False,
    )
    db_session.add(svc)
    await db_session.commit()

    async def boom(expr: str, *, timeout: float = 3.0) -> float | None:
        raise PrometheusUnavailableError("prometheus_not_configured")

    monkeypatch.setattr(infra_module, "instant_query", boom)

    resp = await client.get("/api/v1/admin/platform/servers", headers={AUTH: f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["meta"]["prometheus_available"] is False
    target = next(item for item in body["data"] if item["name"] == svc.name)
    assert target["live_state"] is None


# ── /network — les deux chemins ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_network_with_prometheus(
    client: AsyncClient, seed_platform_admin, monkeypatch
) -> None:
    """Prometheus disponible → métriques renseignées, available=true."""
    _admin, token = seed_platform_admin

    async def fake_query(expr: str, *, timeout: float = 3.0) -> float | None:
        return 42.0

    monkeypatch.setattr(infra_module, "instant_query", fake_query)

    resp = await client.get("/api/v1/admin/platform/network", headers={AUTH: f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["meta"]["available"] is True
    assert body["data"]["rx_bytes_per_sec"] == 42.0
    assert body["data"]["tx_bytes_per_sec"] == 42.0
    assert body["data"]["active_connections"] == 42.0


@pytest.mark.asyncio
async def test_network_prometheus_unavailable_degrades(
    client: AsyncClient, seed_platform_admin, monkeypatch
) -> None:
    """Prometheus injoignable → 200, data null, available=false (jamais 500)."""
    _admin, token = seed_platform_admin

    async def boom(expr: str, *, timeout: float = 3.0) -> float | None:
        raise PrometheusUnavailableError("unreachable")

    monkeypatch.setattr(infra_module, "instant_query", boom)

    resp = await client.get("/api/v1/admin/platform/network", headers={AUTH: f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["meta"]["available"] is False
    assert body["data"]["rx_bytes_per_sec"] is None
    assert body["data"]["active_connections"] is None


# ── /alerts — alertes infra Prometheus (B2) ────────────────────────────────────


def test_map_prometheus_alert() -> None:
    """Mapping pur d'une alerte brute Prometheus → forme compacte."""
    out = map_prometheus_alert(
        {
            "labels": {"alertname": "HighCPU", "severity": "critical"},
            "annotations": {"summary": "CPU > 90%"},
            "state": "firing",
            "activeAt": "2026-06-05T10:00:00Z",
        }
    )
    assert out.name == "HighCPU"
    assert out.severity == "critical"
    assert out.state == "firing"
    assert out.summary == "CPU > 90%"


def test_map_prometheus_alert_defaults() -> None:
    """Alerte sans labels/annotations → name 'unknown', champs None (pas de crash)."""
    out = map_prometheus_alert({})
    assert out.name == "unknown"
    assert out.severity is None and out.state is None


@pytest.mark.asyncio
async def test_alerts_requires_platform_admin(client: AsyncClient, seed_admin) -> None:
    assert (await client.get("/api/v1/admin/platform/alerts")).status_code == 401
    _admin, token = seed_admin
    resp = await client.get("/api/v1/admin/platform/alerts", headers={AUTH: f"Bearer {token}"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_alerts_firing_sorted(client: AsyncClient, seed_platform_admin, monkeypatch) -> None:
    """Alertes remontées + triées (firing avant pending, critical avant warning)."""
    _admin, token = seed_platform_admin

    async def fake_alerts(*, timeout: float = 3.0) -> list[dict]:
        return [
            {"labels": {"alertname": "Pend", "severity": "warning"}, "state": "pending"},
            {"labels": {"alertname": "Crit", "severity": "critical"}, "state": "firing"},
            {"labels": {"alertname": "Warn", "severity": "warning"}, "state": "firing"},
        ]

    monkeypatch.setattr(infra_module, "active_alerts", fake_alerts)
    resp = await client.get("/api/v1/admin/platform/alerts", headers={AUTH: f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["meta"]["available"] is True
    assert body["meta"]["total"] == 3
    # firing+critical d'abord, pending en dernier.
    assert body["data"][0]["name"] == "Crit"
    assert body["data"][-1]["name"] == "Pend"


@pytest.mark.asyncio
async def test_alerts_unavailable_degrades(
    client: AsyncClient, seed_platform_admin, monkeypatch
) -> None:
    _admin, token = seed_platform_admin

    async def boom(*, timeout: float = 3.0) -> list[dict]:
        raise PrometheusUnavailableError("unreachable")

    monkeypatch.setattr(infra_module, "active_alerts", boom)
    resp = await client.get("/api/v1/admin/platform/alerts", headers={AUTH: f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["meta"]["available"] is False
    assert body["data"] == []
