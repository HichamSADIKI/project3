"""Tests du sous-routeur infra-admin PLATEFORME « backups » (`/admin/platform/backups`).

Couvre :
- Frontière de sécurité : 401 anonyme, 403 pour un admin de société SANS le drapeau
  `is_platform_admin`, 200 pour `seed_platform_admin`.
- Helpers purs (`_age_hours`, `_is_healthy`).
- Liste paginée + filtres target/status ; résumé par cible avec calcul de santé.

Périmètre cross-tenant (hors Loi 1) : `backup_runs` n'a pas de company_id — la garde
est `require_platform_admin`. Le test d'isolation Loi 1 ne s'applique donc pas.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin import BackupRun
from app.routers.admin.backups import _STALE_AFTER_HOURS, _age_hours, _is_healthy

AUTH = "Authorization"


# ── Helpers purs (pas d'I/O) ──────────────────────────────────────────────────


def test_age_hours_none() -> None:
    assert _age_hours(None, now=datetime.now(UTC)) is None


def test_age_hours_computes() -> None:
    now = datetime.now(UTC)
    ref = now - timedelta(hours=5)
    age = _age_hours(ref, now=now)
    assert age is not None
    assert 4.9 < age < 5.1


def test_age_hours_naive_treated_as_utc() -> None:
    now = datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)
    naive = datetime(2026, 1, 1, 10, 0, 0)  # noqa: DTZ001 — test explicite du fallback UTC
    assert _age_hours(naive, now=now) == pytest.approx(2.0)


@pytest.mark.parametrize(
    ("status", "age", "expected"),
    [
        ("success", 1.0, True),
        ("success", _STALE_AFTER_HOURS + 1, False),
        ("failed", 1.0, False),
        ("running", 1.0, False),
        ("success", None, False),
        (None, None, False),
    ],
)
def test_is_healthy(status: str | None, age: float | None, expected: bool) -> None:
    assert _is_healthy(status, age) is expected


# ── Frontière de sécurité ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_backups_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/admin/platform/backups")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_backups_forbidden_for_plain_admin(client: AsyncClient, seed_admin) -> None:
    _admin, token = seed_admin
    resp = await client.get("/api/v1/admin/platform/backups", headers={AUTH: f"Bearer {token}"})
    assert resp.status_code == 403
    assert resp.json()["detail"] == "platform_admin_required"


@pytest.mark.asyncio
async def test_summary_forbidden_for_plain_admin(client: AsyncClient, seed_admin) -> None:
    _admin, token = seed_admin
    resp = await client.get(
        "/api/v1/admin/platform/backups/summary", headers={AUTH: f"Bearer {token}"}
    )
    assert resp.status_code == 403


# ── Liste ──────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_backups_and_filter(
    client: AsyncClient, db_session: AsyncSession, seed_platform_admin
) -> None:
    _admin, token = seed_platform_admin
    now = datetime.now(UTC)
    tag = uuid.uuid4().hex[:8]
    db_session.add_all(
        [
            BackupRun(
                id=uuid.uuid4(),
                target="db",
                kind="scheduled",
                status="success",
                size_bytes=1024,
                location=f"db-{tag}",
                finished_at=now,
            ),
            BackupRun(
                id=uuid.uuid4(),
                target="minio",
                kind="manual",
                status="failed",
                error="boom",
                location=f"minio-{tag}",
                finished_at=now,
            ),
        ]
    )
    await db_session.commit()

    # Liste complète
    resp = await client.get("/api/v1/admin/platform/backups", headers={AUTH: f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["meta"]["total"] >= 2

    # Filtre target=minio
    resp = await client.get(
        "/api/v1/admin/platform/backups?target=minio", headers={AUTH: f"Bearer {token}"}
    )
    assert resp.status_code == 200
    assert all(item["target"] == "minio" for item in resp.json()["data"])

    # Filtre status invalide → 422 (pattern)
    resp = await client.get(
        "/api/v1/admin/platform/backups?status=bogus", headers={AUTH: f"Bearer {token}"}
    )
    assert resp.status_code == 422


# ── Résumé ───────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_summary_health(
    client: AsyncClient, db_session: AsyncSession, seed_platform_admin
) -> None:
    """db = dernier run en succès récent → healthy ; minio = échec → non sain."""
    _admin, token = seed_platform_admin
    now = datetime.now(UTC)
    db_session.add_all(
        [
            BackupRun(
                id=uuid.uuid4(),
                target="db",
                kind="scheduled",
                status="success",
                size_bytes=2048,
                finished_at=now,
            ),
            BackupRun(
                id=uuid.uuid4(),
                target="minio",
                kind="scheduled",
                status="failed",
                error="x",
                finished_at=now,
            ),
        ]
    )
    await db_session.commit()

    resp = await client.get(
        "/api/v1/admin/platform/backups/summary", headers={AUTH: f"Bearer {token}"}
    )
    assert resp.status_code == 200
    data = {row["target"]: row for row in resp.json()["data"]}
    assert data["db"]["last_status"] == "success"
    assert data["db"]["healthy"] is True
    assert data["minio"]["last_status"] == "failed"
    assert data["minio"]["healthy"] is False
