"""Admin · Backups — autorise kind='restore' sur backup_runs.

Revision ID: 0056_backup_runs_kind_restore
Revises: 0055_agenda_events
Create Date: 2026-06-06

La restauration (vers une base de vérification jetable, jamais la live) journalise son
exécution comme un `backup_runs` à part (`kind='restore'`) pour rester distincte des
sauvegardes dans la liste et le résumé de santé. Le CHECK `ck_backup_runs_kind` (créé en
0048) n'autorisait que ('scheduled','manual') : on l'étend à ('scheduled','manual',
'restore'). Table PLATEFORME (cross-tenant, pas de company_id) — gardée par
require_platform_admin.
"""

from alembic import op

revision = "0056_backup_runs_kind_restore"
down_revision = "0055_agenda_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_backup_runs_kind", "backup_runs", type_="check")
    op.create_check_constraint(
        "ck_backup_runs_kind",
        "backup_runs",
        "kind IN ('scheduled','manual','restore')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_backup_runs_kind", "backup_runs", type_="check")
    op.create_check_constraint(
        "ck_backup_runs_kind",
        "backup_runs",
        "kind IN ('scheduled','manual')",
    )
