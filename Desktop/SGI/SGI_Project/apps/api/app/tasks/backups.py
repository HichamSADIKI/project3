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
