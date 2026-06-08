"""Tests du superviseur de sécurité plateforme (`/admin/platform/security/overview`).

Couvre : helpers PURS (`prefix_of`, `aggregate_by_prefix`), garde plateforme
(401 anonyme, 403 admin de société, 200 super-admin), et l'agrégation réelle après
avoir semé des `AuditLog` sécu + de la gouvernance Studio (lecture seule, cross-tenant).
"""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.studio import StudioIntegrationRequest, StudioModule, StudioOrchestratorJob
from app.routers.admin.security import (
    _SECURITY_PREFIXES,
    aggregate_by_prefix,
    daily_series,
    day_keys,
    prefix_of,
)

AUTH = "Authorization"
BASE = "/api/v1/admin/platform/security"


# ── Helpers purs ────────────────────────────────────────────────────────────────


def test_prefix_of() -> None:
    assert prefix_of("self_defense:locked", _SECURITY_PREFIXES) == "self_defense:"
    assert prefix_of("honeytoken:access", _SECURITY_PREFIXES) == "honeytoken:"
    assert prefix_of("studio:build_dry_run", _SECURITY_PREFIXES) == "studio:"
    assert prefix_of("auth:login", _SECURITY_PREFIXES) is None


def test_aggregate_by_prefix() -> None:
    rows = [
        ("self_defense:locked", 2, 5),
        ("self_defense:code_fail", 1, 3),
        ("honeytoken:access", 0, 4),
        ("other:x", 9, 9),  # ignoré
    ]
    out = {b["prefix"]: b for b in aggregate_by_prefix(rows, _SECURITY_PREFIXES)}
    assert out["self_defense:"]["count_24h"] == 3
    assert out["self_defense:"]["count_7d"] == 8
    assert out["honeytoken:"]["count_24h"] == 0
    assert out["honeytoken:"]["count_7d"] == 4
    assert out["studio:"]["count_7d"] == 0  # bucket à zéro présent
    assert len(out) == len(_SECURITY_PREFIXES)


def test_day_keys() -> None:
    from datetime import date

    keys = day_keys(date(2026, 6, 8), 7)
    assert keys == [
        "2026-06-02",
        "2026-06-03",
        "2026-06-04",
        "2026-06-05",
        "2026-06-06",
        "2026-06-07",
        "2026-06-08",
    ]


def test_daily_series() -> None:
    keys = ["2026-06-07", "2026-06-08"]
    rows = [
        ("self_defense:locked", "2026-06-08", 2),
        ("self_defense:code_fail", "2026-06-08", 1),
        ("honeytoken:access", "2026-06-07", 4),
        ("other:x", "2026-06-08", 9),  # ignoré
    ]
    out = {s["prefix"]: s for s in daily_series(rows, _SECURITY_PREFIXES, keys)}
    assert out["self_defense:"]["counts"] == [0, 3]  # 2+1 le 08
    assert out["honeytoken:"]["counts"] == [4, 0]
    assert out["studio:"]["counts"] == [0, 0]


# ── Garde plateforme ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_overview_requires_auth(client: AsyncClient) -> None:
    assert (await client.get(f"{BASE}/overview")).status_code == 401


@pytest.mark.asyncio
async def test_overview_forbidden_for_plain_admin(client: AsyncClient, seed_admin) -> None:
    _admin, token = seed_admin
    resp = await client.get(f"{BASE}/overview", headers={AUTH: f"Bearer {token}"})
    assert resp.status_code == 403
    assert resp.json()["detail"] == "platform_admin_required"


# ── Agrégation réelle ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_overview_aggregates(
    client: AsyncClient, db_session: AsyncSession, seed_platform_admin
) -> None:
    _admin, token = seed_platform_admin
    cid = uuid.uuid4()
    # Événements sécu (created_at = now par défaut → comptés en 24h).
    for action in ("self_defense:locked", "honeytoken:access", "studio:build_dry_run"):
        db_session.add(
            AuditLog(company_id=cid, action=action, resource=action.split(":")[0], changes={})
        )
    # Gouvernance Studio : un module + une demande d'intégration pending + un job failed.
    module = StudioModule(
        key=f"studio.sec_{uuid.uuid4().hex[:8]}",
        title_ar="a",
        title_en="S",
        title_fr="S",
        flavor="code",
        mode="manual",
        state="draft",
    )
    db_session.add(module)
    await db_session.commit()
    await db_session.refresh(module)
    from datetime import UTC, datetime, timedelta

    db_session.add(
        StudioIntegrationRequest(
            module_id=module.id,
            requested_by=uuid.uuid4(),
            reason="x",
            status="pending",
            expires_at=datetime.now(UTC) + timedelta(hours=1),
        )
    )
    db_session.add(StudioOrchestratorJob(module_id=module.id, status="failed", phase="radar"))
    await db_session.commit()

    resp = await client.get(f"{BASE}/overview", headers={AUTH: f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()["data"]

    buckets = {b["prefix"]: b for b in data["events"]}
    assert buckets["self_defense:"]["count_24h"] >= 1
    assert buckets["honeytoken:"]["count_24h"] >= 1
    assert buckets["studio:"]["count_24h"] >= 1
    assert any(e["action"] == "honeytoken:access" for e in data["recent"])
    assert data["studio"]["integration_pending"] >= 1
    assert data["studio"]["jobs_failed"] >= 1
    assert data["studio"]["modules_total"] >= 1
    assert "draft" in data["studio"]["modules_by_state"]
    # Série temporelle : 7 jours, un bucket par préfixe, total cohérent.
    ts = data["timeseries"]
    assert len(ts["days"]) == 7
    sd = next(s for s in ts["series"] if s["prefix"] == "self_defense:")
    assert len(sd["counts"]) == 7
    assert sum(sd["counts"]) >= 1
