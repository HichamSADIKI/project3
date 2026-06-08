"""Tâches Celery — Admin Console · exécution des sauvegardes (déclenchement, Phase 3).

Queue : exports (tâche longue). Le déclenchement réel est gardé EN AMONT par le flag
`BACKUP_TRIGGER_ENABLED` (routeur) : sans lui, l'endpoint reste en dry-run et n'enqueue
pas. NON destructif (créer une sauvegarde ne touche pas aux données).

⚠️ L'exécution réelle nécessite le binaire `pg_dump` dans l'image worker
(`postgresql-client`). S'il est absent, la tâche échoue proprement (status='failed',
error renseignée) — aucune donnée affectée. La restauration (destructive) est hors scope.
"""

import logging
import os
import re
import shutil
import subprocess
import uuid
from datetime import UTC, datetime
from pathlib import Path

from celery import shared_task
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import sync_session_maker
from app.models.admin import BackupRun

logger = logging.getLogger(__name__)


def backup_dir() -> str:
    """Répertoire cible des sauvegardes (env `BACKUP_DIR`, défaut /backups)."""
    return os.getenv("BACKUP_DIR", "/backups").strip() or "/backups"


def pg_dump_command(target_file: str) -> list[str]:
    """Commande pg_dump (format custom, sans owner). Helper PUR (testable).

    Pas de shell, arguments en liste (anti-injection). Le mot de passe passe par
    l'environnement (PGPASSWORD), jamais en argument.
    """
    exe = shutil.which("pg_dump") or "pg_dump"
    return [
        exe,
        "--no-owner",
        "--format=custom",
        "--host",
        settings.POSTGRES_HOST,
        "--port",
        str(settings.POSTGRES_PORT),
        "--username",
        settings.POSTGRES_USER,
        "--dbname",
        settings.POSTGRES_DB,
        "--file",
        target_file,
    ]


def restore_enabled() -> bool:
    """Exécution réelle de la restauration activée ? Défaut false → dry-run. Helper pur.

    Défini ici (et non dans le routeur, contrairement à `backup_trigger_enabled`) pour
    que le worker l'utilise en défense en profondeur sans import circulaire.
    """
    return os.getenv("RESTORE_ENABLED", "false").strip().lower() == "true"


def restore_target_db() -> str:
    """Base CIBLE de restauration — JETABLE, JAMAIS la base live.

    Défaut `<POSTGRES_DB>_restore_check`. Surchargeable via `RESTORE_TARGET_DB`. La
    restauration recrée cette base et y rejoue le dump : la base de production n'est
    jamais modifiée (vérifier qu'un dump est restaurable = usage n°1 d'une sauvegarde).
    """
    explicit = os.getenv("RESTORE_TARGET_DB", "").strip()
    return explicit or f"{settings.POSTGRES_DB}_restore_check"


def recreate_target_db_command(target_db: str) -> list[str]:
    """psql (base de maintenance 'postgres') : DROP puis CREATE de la base CIBLE.

    Helper PUR (testable). Uniquement la base cible jetable — jamais la live (garde
    en amont dans `_restore_guard`). `target_db` est validé `^[A-Za-z0-9_]+$`.

    DROP/CREATE DATABASE ne peuvent PAS tourner dans une transaction → DEUX `-c`
    séparés (un seul `-c "DROP …; CREATE …"` échoue : « cannot run inside a
    transaction block »). Chaque `-c` est exécuté dans sa propre transaction.
    """
    exe = shutil.which("psql") or "psql"
    return [
        exe,
        "--host",
        settings.POSTGRES_HOST,
        "--port",
        str(settings.POSTGRES_PORT),
        "--username",
        settings.POSTGRES_USER,
        "--dbname",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        f'DROP DATABASE IF EXISTS "{target_db}";',
        "-c",
        f'CREATE DATABASE "{target_db}";',
    ]


def pg_restore_command(dump_file: str, target_db: str) -> list[str]:
    """Commande pg_restore vers `target_db`. Helper PUR (testable). Pas de shell."""
    exe = shutil.which("pg_restore") or "pg_restore"
    return [
        exe,
        "--no-owner",
        "--clean",
        "--if-exists",
        "--host",
        settings.POSTGRES_HOST,
        "--port",
        str(settings.POSTGRES_PORT),
        "--username",
        settings.POSTGRES_USER,
        "--dbname",
        target_db,
        dump_file,
    ]


def _restore_guard(target_db: str) -> str | None:
    """Code d'erreur si la restauration doit être refusée, sinon None. Défense en profondeur."""
    if not restore_enabled():
        return "restore_disabled"
    if target_db == settings.POSTGRES_DB:
        return "refuse_overwrite_live_db"
    if not re.fullmatch(r"[A-Za-z0-9_]+", target_db):
        return "invalid_target_db"
    return None


def _finish(db: Session, run: BackupRun, status: str, **fields: object) -> dict[str, object]:
    run.status = status
    for key, value in fields.items():
        setattr(run, key, value)
    run.finished_at = datetime.now(UTC)
    db.commit()
    return {"status": status, "backup_run_id": str(run.id)}


@shared_task(bind=True, max_retries=1)
def run_backup(self, backup_run_id: str) -> dict[str, object]:  # noqa: ANN001
    """Exécute une sauvegarde déjà enregistrée (`backup_runs`, status='running')."""
    with sync_session_maker() as db:
        run = db.execute(
            select(BackupRun).where(BackupRun.id == uuid.UUID(backup_run_id))
        ).scalar_one_or_none()
        if run is None or run.status != "running":
            return {"status": "skipped", "backup_run_id": backup_run_id}
        if run.target != "db":
            return _finish(db, run, "failed", error="unsupported_target")

        now = datetime.now(UTC)
        run.started_at = run.started_at or now
        db.commit()
        path = Path(backup_dir()) / f"sgi-{now.strftime('%Y%m%d-%H%M%S')}-{run.id.hex[:8]}.dump"
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            env = {**os.environ, "PGPASSWORD": settings.POSTGRES_PASSWORD}
            subprocess.run(  # noqa: S603  args en liste, pas de shell
                pg_dump_command(str(path)),
                check=True,
                capture_output=True,
                env=env,
                timeout=600,
            )
            size = path.stat().st_size
        except Exception as exc:  # noqa: BLE001  ne jamais planter le worker
            logger.exception("run_backup a échoué")
            return _finish(db, run, "failed", error=str(exc)[:2000])
        return _finish(db, run, "success", location=str(path), size_bytes=size)


@shared_task(bind=True, max_retries=0)
def execute_restore(self, restore_run_id: str, dump_path: str) -> dict[str, object]:  # noqa: ANN001
    """Restaure `dump_path` DANS LA BASE CIBLE JETABLE — jamais la base live.

    Gardé EN AMONT par `RESTORE_ENABLED` (routeur). Défense en profondeur ici :
    refuse si le flag est off, si la cible == base live, si le nom de cible est
    invalide, ou si le dump est absent. Recrée la base cible puis y rejoue le dump
    via pg_restore. La base de production n'est JAMAIS touchée ; la promotion vers
    live reste un acte ops manuel (hors scope).

    ⚠️ Nécessite `pg_restore`/`psql` (postgresql-client) dans l'image worker. Absent
    → status='failed', error renseignée, aucune base affectée.
    """
    with sync_session_maker() as db:
        run = db.execute(
            select(BackupRun).where(BackupRun.id == uuid.UUID(restore_run_id))
        ).scalar_one_or_none()
        if run is None or run.status != "running":
            return {"status": "skipped", "restore_run_id": restore_run_id}

        target = restore_target_db()
        guard = _restore_guard(target)
        if guard is not None:
            return _finish(db, run, "failed", error=guard)
        if not Path(dump_path).is_file():
            return _finish(db, run, "failed", error="dump_not_found")

        run.started_at = run.started_at or datetime.now(UTC)
        db.commit()
        env = {**os.environ, "PGPASSWORD": settings.POSTGRES_PASSWORD}
        try:
            subprocess.run(  # noqa: S603  args en liste, pas de shell
                recreate_target_db_command(target),
                check=True,
                capture_output=True,
                env=env,
                timeout=120,
            )
            subprocess.run(  # noqa: S603  args en liste, pas de shell
                pg_restore_command(dump_path, target),
                check=True,
                capture_output=True,
                env=env,
                timeout=900,
            )
        except Exception as exc:  # noqa: BLE001  ne jamais planter le worker
            logger.exception("execute_restore a échoué")
            return _finish(db, run, "failed", error=str(exc)[:2000])
        return _finish(db, run, "success", location=f"restored→{target} ← {dump_path}")
