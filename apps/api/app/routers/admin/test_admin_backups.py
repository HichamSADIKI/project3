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

from app.core.config import settings
from app.models.admin import BackupRun
from app.routers.admin import backups as backups_module
from app.routers.admin.backups import (
    _STALE_AFTER_HOURS,
    _age_hours,
    _is_healthy,
    backup_trigger_enabled,
)
from app.tasks.backups import (
    _restore_guard,
    pg_restore_command,
    recreate_target_db_command,
    restore_enabled,
    restore_target_db,
)

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


# ── Déclenchement (Phase 3, dry-run d'abord) ───────────────────────────────────


def test_backup_trigger_enabled_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("BACKUP_TRIGGER_ENABLED", raising=False)
    assert backup_trigger_enabled() is False
    monkeypatch.setenv("BACKUP_TRIGGER_ENABLED", "true")
    assert backup_trigger_enabled() is True


@pytest.mark.asyncio
async def test_trigger_requires_platform_admin(client: AsyncClient, seed_admin) -> None:
    body = {"target": "db", "confirmation": "db"}
    assert (
        await client.post("/api/v1/admin/platform/backups/trigger", json=body)
    ).status_code == 401
    _a, token = seed_admin
    resp = await client.post(
        "/api/v1/admin/platform/backups/trigger", json=body, headers={AUTH: f"Bearer {token}"}
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_trigger_dry_run(client: AsyncClient, seed_platform_admin, monkeypatch) -> None:
    monkeypatch.setenv("BACKUP_TRIGGER_ENABLED", "false")
    _a, token = seed_platform_admin
    resp = await client.post(
        "/api/v1/admin/platform/backups/trigger",
        json={"target": "db", "confirmation": "db"},
        headers={AUTH: f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["status"] == "success"
    assert "dry_run" in (data["location"] or "")


@pytest.mark.asyncio
async def test_trigger_enqueues_when_enabled(
    client: AsyncClient, seed_platform_admin, monkeypatch
) -> None:
    monkeypatch.setenv("BACKUP_TRIGGER_ENABLED", "true")
    enqueued: list[str] = []

    class _FakeTask:
        @staticmethod
        def delay(run_id: str) -> None:
            enqueued.append(run_id)

    monkeypatch.setattr(backups_module, "run_backup", _FakeTask)
    _a, token = seed_platform_admin
    resp = await client.post(
        "/api/v1/admin/platform/backups/trigger",
        json={"target": "db", "confirmation": "db"},
        headers={AUTH: f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["status"] == "running"
    assert enqueued == [data["id"]]


@pytest.mark.asyncio
async def test_trigger_guards(client: AsyncClient, seed_platform_admin, monkeypatch) -> None:
    monkeypatch.setenv("BACKUP_TRIGGER_ENABLED", "false")
    _a, token = seed_platform_admin
    h = {AUTH: f"Bearer {token}"}
    # mauvaise confirmation → 400
    r = await client.post(
        "/api/v1/admin/platform/backups/trigger",
        json={"target": "db", "confirmation": "WRONG"},
        headers=h,
    )
    assert r.status_code == 400
    # cible non supportée (minio) → 422 (Literal)
    r = await client.post(
        "/api/v1/admin/platform/backups/trigger",
        json={"target": "minio", "confirmation": "minio"},
        headers=h,
    )
    assert r.status_code == 422


# ── Restauration (Phase 3, dans une base CIBLE jetable — jamais la live) ───────


def test_restore_enabled_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("RESTORE_ENABLED", raising=False)
    assert restore_enabled() is False
    monkeypatch.setenv("RESTORE_ENABLED", "true")
    assert restore_enabled() is True


def test_restore_target_db_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("RESTORE_TARGET_DB", raising=False)
    assert restore_target_db() == f"{settings.POSTGRES_DB}_restore_check"
    monkeypatch.setenv("RESTORE_TARGET_DB", "sgi_audit_copy")
    assert restore_target_db() == "sgi_audit_copy"


def test_pg_restore_command_structure() -> None:
    cmd = pg_restore_command("/backups/x.dump", "sgi_restore_check")
    assert "pg_restore" in cmd[0]
    assert "--clean" in cmd and "--if-exists" in cmd and "--no-owner" in cmd
    assert cmd[cmd.index("--dbname") + 1] == "sgi_restore_check"
    assert cmd[-1] == "/backups/x.dump"  # le fichier en dernier, pas via un shell


def test_recreate_target_db_command_drops_and_creates() -> None:
    cmd = recreate_target_db_command("sgi_restore_check")
    assert "psql" in cmd[0]
    # se connecte à la base de maintenance, pas à la cible
    assert cmd[cmd.index("--dbname") + 1] == "postgres"
    # Régression : DROP et CREATE DATABASE dans des `-c` SÉPARÉS (chacun sa transaction).
    # Un seul `-c "DROP …; CREATE …"` échoue « cannot run inside a transaction block ».
    c_values = [cmd[i + 1] for i, a in enumerate(cmd) if a == "-c"]
    assert len(c_values) == 2
    assert any(v.startswith('DROP DATABASE IF EXISTS "sgi_restore_check"') for v in c_values)
    assert any(v.startswith('CREATE DATABASE "sgi_restore_check"') for v in c_values)
    # aucun `-c` ne combine les deux commandes (le bug d'origine).
    assert not any("DROP" in v and "CREATE" in v for v in c_values)


def test_restore_guard_refuses_live_db(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RESTORE_ENABLED", "true")
    # cible == base live → refus net (défense en profondeur)
    assert _restore_guard(settings.POSTGRES_DB) == "refuse_overwrite_live_db"
    # nom invalide → refus
    assert _restore_guard("bad; DROP") == "invalid_target_db"
    # cible jetable valide → autorisé
    assert _restore_guard("sgi_restore_check") is None
    # flag off → refus quoi qu'il arrive
    monkeypatch.setenv("RESTORE_ENABLED", "false")
    assert _restore_guard("sgi_restore_check") == "restore_disabled"


async def _seed_restorable(db_session: AsyncSession) -> BackupRun:
    """Une sauvegarde DB réussie avec un dump → candidate à la restauration."""
    run = BackupRun(
        target="db",
        kind="manual",
        status="success",
        location="/backups/sgi-20260101-000000-abcdef12.dump",
        size_bytes=1024,
    )
    db_session.add(run)
    await db_session.commit()
    await db_session.refresh(run)
    return run


@pytest.mark.asyncio
async def test_restore_requires_platform_admin(client: AsyncClient, seed_admin) -> None:
    body = {"confirmation": "restore"}
    rid = uuid.uuid4()
    # anonyme → 401
    assert (
        await client.post(f"/api/v1/admin/platform/backups/{rid}/restore", json=body)
    ).status_code == 401
    # admin de société SANS is_platform_admin → 403
    _a, token = seed_admin
    resp = await client.post(
        f"/api/v1/admin/platform/backups/{rid}/restore",
        json=body,
        headers={AUTH: f"Bearer {token}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_restore_bad_confirmation(client: AsyncClient, seed_platform_admin) -> None:
    _a, token = seed_platform_admin
    resp = await client.post(
        f"/api/v1/admin/platform/backups/{uuid.uuid4()}/restore",
        json={"confirmation": "WRONG"},
        headers={AUTH: f"Bearer {token}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_restore_unknown_backup(client: AsyncClient, seed_platform_admin) -> None:
    _a, token = seed_platform_admin
    resp = await client.post(
        f"/api/v1/admin/platform/backups/{uuid.uuid4()}/restore",
        json={"confirmation": "restore"},
        headers={AUTH: f"Bearer {token}"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_restore_not_restorable(
    client: AsyncClient, db_session: AsyncSession, seed_platform_admin
) -> None:
    _a, token = seed_platform_admin
    # un run en échec n'est pas restaurable → 409
    bad = BackupRun(target="db", kind="manual", status="failed", error="boom")
    db_session.add(bad)
    await db_session.commit()
    await db_session.refresh(bad)
    resp = await client.post(
        f"/api/v1/admin/platform/backups/{bad.id}/restore",
        json={"confirmation": "restore"},
        headers={AUTH: f"Bearer {token}"},
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_restore_dry_run(
    client: AsyncClient, db_session: AsyncSession, seed_platform_admin, monkeypatch
) -> None:
    monkeypatch.setenv("RESTORE_ENABLED", "false")
    _a, token = seed_platform_admin
    src = await _seed_restorable(db_session)
    resp = await client.post(
        f"/api/v1/admin/platform/backups/{src.id}/restore",
        json={"confirmation": "restore"},
        headers={AUTH: f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["kind"] == "restore"
    assert data["status"] == "success"
    assert "dry_run" in (data["location"] or "")


@pytest.mark.asyncio
async def test_restore_enqueues_when_enabled(
    client: AsyncClient, db_session: AsyncSession, seed_platform_admin, monkeypatch
) -> None:
    monkeypatch.setenv("RESTORE_ENABLED", "true")
    enqueued: list[tuple[str, str]] = []

    class _FakeTask:
        @staticmethod
        def delay(run_id: str, dump_path: str) -> None:
            enqueued.append((run_id, dump_path))

    monkeypatch.setattr(backups_module, "execute_restore", _FakeTask)
    _a, token = seed_platform_admin
    src = await _seed_restorable(db_session)
    resp = await client.post(
        f"/api/v1/admin/platform/backups/{src.id}/restore",
        json={"confirmation": "restore"},
        headers={AUTH: f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["status"] == "running"
    assert enqueued == [(data["id"], src.location)]
