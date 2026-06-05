"""Tests purs de la tâche de sauvegarde (`app.tasks.backups`).

L'exécution réelle (pg_dump) n'est pas testée en CI (binaire absent, gardée par flag).
On valide la construction de commande (pas de shell, mot de passe hors argv) + le
répertoire cible.
"""

import pytest

from app.tasks.backups import backup_dir, pg_dump_command


def test_pg_dump_command_is_safe_arglist() -> None:
    cmd = pg_dump_command("/backups/x.dump")
    # Liste d'arguments (pas de shell) + format custom + fichier cible.
    assert cmd[0].endswith("pg_dump")
    assert "--format=custom" in cmd
    assert "--file" in cmd and "/backups/x.dump" in cmd
    # Le mot de passe ne doit JAMAIS apparaître dans la ligne de commande.
    assert all("password" not in part.lower() for part in cmd)


def test_backup_dir_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("BACKUP_DIR", raising=False)
    assert backup_dir() == "/backups"
    monkeypatch.setenv("BACKUP_DIR", "/var/backups/sgi")
    assert backup_dir() == "/var/backups/sgi"
    monkeypatch.setenv("BACKUP_DIR", "   ")
    assert backup_dir() == "/backups"
