"""Index notifications(company_id, type) — perf déduplication Celery.

Revision ID: 0028_notifications_type_index
Revises: 0027_refresh_tokens
Create Date: 2026-06-02

Les tâches Celery `check_pdc_due`, `check_maintenance_sla` et `notify_mentions`
dédupliquent leurs notifications par `(company_id, type)` (+ un id dans le JSONB
`payload`). Sans index sur `type`, ces requêtes faisaient un Seq Scan filtré,
coûteux à mesure que `notifications` grossit. On ajoute l'index composite
`(company_id, type)` (préfixe company_id → compatible RLS / multi-tenant).
"""

from alembic import op


revision = "0028_notifications_type_index"
down_revision = "0027_refresh_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "idx_notifications_company_type",
        "notifications",
        ["company_id", "type"],
    )


def downgrade() -> None:
    op.drop_index("idx_notifications_company_type", table_name="notifications")
