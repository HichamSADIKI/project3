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
    control_enabled,
    map_prometheus_alert,
    project_seconds_to_threshold,
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


# ── /servers/{id}/actions — control-plane dry-run (D1) ──────────────────────────


def test_control_enabled_default_false(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("INFRA_CONTROL_ENABLED", raising=False)
    assert control_enabled() is False
    monkeypatch.setenv("INFRA_CONTROL_ENABLED", "true")
    assert control_enabled() is True
    monkeypatch.setenv("INFRA_CONTROL_ENABLED", "false")
    assert control_enabled() is False


async def _seed_service(db: AsyncSession, *, controllable: bool) -> InfraService:
    svc = InfraService(
        id=uuid.uuid4(),
        name=f"svc-{uuid.uuid4().hex[:8]}",
        kind="container",
        is_controllable=controllable,
    )
    db.add(svc)
    await db.commit()
    await db.refresh(svc)
    return svc


@pytest.mark.asyncio
async def test_action_requires_platform_admin(
    client: AsyncClient, db_session: AsyncSession, seed_admin
) -> None:
    svc = await _seed_service(db_session, controllable=True)
    body = {"action": "restart", "confirmation": svc.name}
    # anonyme → 401
    assert (
        await client.post(f"/api/v1/admin/platform/servers/{svc.id}/actions", json=body)
    ).status_code == 401
    # admin de société sans is_platform_admin → 403
    _a, token = seed_admin
    resp = await client.post(
        f"/api/v1/admin/platform/servers/{svc.id}/actions",
        json=body,
        headers={AUTH: f"Bearer {token}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_action_dry_run_records(
    client: AsyncClient, db_session: AsyncSession, seed_platform_admin, monkeypatch
) -> None:
    monkeypatch.setenv("INFRA_CONTROL_ENABLED", "false")
    _a, token = seed_platform_admin
    h = {AUTH: f"Bearer {token}"}
    svc = await _seed_service(db_session, controllable=True)

    resp = await client.post(
        f"/api/v1/admin/platform/servers/{svc.id}/actions",
        json={"action": "restart", "confirmation": svc.name},
        headers=h,
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["action"] == "restart"
    assert data["status"] == "done"
    assert "dry_run" in data["detail"]

    # Historique : l'action apparaît.
    hist = await client.get(f"/api/v1/admin/platform/actions?service_id={svc.id}", headers=h)
    assert hist.status_code == 200
    assert hist.json()["meta"]["total"] >= 1


@pytest.mark.asyncio
async def test_action_guards(
    client: AsyncClient, db_session: AsyncSession, seed_platform_admin, monkeypatch
) -> None:
    monkeypatch.setenv("INFRA_CONTROL_ENABLED", "false")
    _a, token = seed_platform_admin
    h = {AUTH: f"Bearer {token}"}

    # service non contrôlable → 409
    locked = await _seed_service(db_session, controllable=False)
    r = await client.post(
        f"/api/v1/admin/platform/servers/{locked.id}/actions",
        json={"action": "stop", "confirmation": locked.name},
        headers=h,
    )
    assert r.status_code == 409

    # mauvaise confirmation → 400
    svc = await _seed_service(db_session, controllable=True)
    r = await client.post(
        f"/api/v1/admin/platform/servers/{svc.id}/actions",
        json={"action": "stop", "confirmation": "WRONG"},
        headers=h,
    )
    assert r.status_code == 400

    # action invalide → 422
    r = await client.post(
        f"/api/v1/admin/platform/servers/{svc.id}/actions",
        json={"action": "nuke", "confirmation": svc.name},
        headers=h,
    )
    assert r.status_code == 422

    # service inexistant → 404
    r = await client.post(
        f"/api/v1/admin/platform/servers/{uuid.uuid4()}/actions",
        json={"action": "stop", "confirmation": "x"},
        headers=h,
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_action_enqueues_when_enabled(
    client: AsyncClient, db_session: AsyncSession, seed_platform_admin, monkeypatch
) -> None:
    """Flag activé (D2) → action 'requested' + délégation au worker (delay appelé).

    L'API n'exécute jamais : on vérifie qu'elle enqueue. `execute_infra_action` est
    monkeypatché pour ne pas dépendre du broker en test.
    """
    monkeypatch.setenv("INFRA_CONTROL_ENABLED", "true")
    enqueued: list[str] = []

    class _FakeTask:
        @staticmethod
        def delay(action_id: str) -> None:
            enqueued.append(action_id)

    monkeypatch.setattr(infra_module, "execute_infra_action", _FakeTask)

    _a, token = seed_platform_admin
    h = {AUTH: f"Bearer {token}"}
    svc = await _seed_service(db_session, controllable=True)
    resp = await client.post(
        f"/api/v1/admin/platform/servers/{svc.id}/actions",
        json={"action": "restart", "confirmation": svc.name},
        headers=h,
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["status"] == "requested"
    assert enqueued == [data["id"]]


# ── /trend — prédiction de tendance (B3) ───────────────────────────────────────


def test_project_increasing_reaches_threshold() -> None:
    # 10 → 30 sur 600 s (pente 1/30 par s) ; pour atteindre 90 depuis 30 : ~1800 s.
    points = [(0.0, 10.0), (300.0, 20.0), (600.0, 30.0)]
    eta = project_seconds_to_threshold(points, 90.0)
    assert eta is not None
    assert 1700 < eta < 1900


def test_project_flat_or_decreasing_is_none() -> None:
    assert project_seconds_to_threshold([(0.0, 50.0), (300.0, 50.0)], 90.0) is None
    assert project_seconds_to_threshold([(0.0, 80.0), (300.0, 60.0)], 90.0) is None


def test_project_already_over_or_too_few_is_none() -> None:
    assert project_seconds_to_threshold([(0.0, 95.0), (300.0, 96.0)], 90.0) is None
    assert project_seconds_to_threshold([(0.0, 10.0)], 90.0) is None


@pytest.mark.asyncio
async def test_trend_requires_platform_admin(client: AsyncClient, seed_admin) -> None:
    assert (await client.get("/api/v1/admin/platform/trend")).status_code == 401
    _a, token = seed_admin
    resp = await client.get("/api/v1/admin/platform/trend", headers={AUTH: f"Bearer {token}"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_trend_projects(client: AsyncClient, seed_platform_admin, monkeypatch) -> None:
    _a, token = seed_platform_admin

    async def fake_range(
        expr: str, *, start: float, end: float, step: float = 300.0, timeout: float = 5.0
    ) -> list[tuple[float, float]]:
        return [(0.0, 50.0), (300.0, 60.0), (600.0, 70.0)]  # tendance haussière

    monkeypatch.setattr(infra_module, "range_query", fake_range)
    resp = await client.get("/api/v1/admin/platform/trend", headers={AUTH: f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["meta"]["available"] is True
    assert len(body["data"]) >= 1
    item = body["data"][0]
    assert item["current"] == 70.0
    assert item["trending"] is True
    assert item["eta_seconds"] > 0


@pytest.mark.asyncio
async def test_trend_unavailable_degrades(
    client: AsyncClient, seed_platform_admin, monkeypatch
) -> None:
    _a, token = seed_platform_admin

    async def boom(
        expr: str, *, start: float, end: float, step: float = 300.0, timeout: float = 5.0
    ) -> list[tuple[float, float]]:
        raise PrometheusUnavailableError("unreachable")

    monkeypatch.setattr(infra_module, "range_query", boom)
    resp = await client.get("/api/v1/admin/platform/trend", headers={AUTH: f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["meta"]["available"] is False
    assert body["data"] == []
