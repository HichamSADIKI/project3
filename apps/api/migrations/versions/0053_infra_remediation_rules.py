"""Admin · Auto-remédiation — mapping alerte Prometheus → action de contrôle.

Revision ID: 0053_infra_remediation_rules
Revises: 0052_finance_vat_per_transaction
Create Date: 2026-06-05

Table PLATEFORME (cross-tenant, PAS de company_id, PAS de RLS — exception Loi 1 gardée
par require_platform_admin) : une règle mappe le nom d'une alerte Prometheus *firing*
vers une action D2 (restart/stop/start/pause) sur un `infra_services`. Évaluée par le
beat `app.tasks.infra_control.auto_remediate` (dry-run tant que AUTO_REMEDIATION_ENABLED
est faux). Reste dans le périmètre infra-admin — aucune donnée tenant.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0053_infra_remediation_rules"
down_revision = "0052_finance_vat_per_transaction"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "infra_remediation_rules",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("alert_name", sa.String(160), nullable=False),
        sa.Column(
            "service_id",
            UUID(as_uuid=True),
            sa.ForeignKey("infra_services.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("action", sa.String(20), nullable=False),  # restart|stop|start|suspend (→pause)
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "action IN ('restart','stop','start','suspend')",
            name="ck_infra_remediation_rules_action",
        ),
    )
    op.create_index("idx_infra_remediation_rules_alert", "infra_remediation_rules", ["alert_name"])
    op.create_index(
        "idx_infra_remediation_rules_service", "infra_remediation_rules", ["service_id"]
    )


def downgrade() -> None:
    op.drop_table("infra_remediation_rules")
