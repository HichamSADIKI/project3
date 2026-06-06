"""Admin console — socle administration application + supervision plateforme.

Revision ID: 0048_admin_console
Revises: 0047_accounting_ledger
Create Date: 2026-06-05

Deux périmètres de sécurité étanches :

- **App-admin** (tenant, Loi 1 : company_id + RLS + index) :
  - admin_alert_rules   : règles de seuils/alertes par société.
  - admin_alert_events  : alertes déclenchées (machine à états open→acked→resolved).

- **Infra-admin** (plateforme, CROSS-TENANT — exception Loi 1 documentée, gardée par
  `require_platform_admin`, jamais via le middleware tenant ; comme `users`/`audit_logs`,
  ces tables n'ont PAS de company_id et PAS de policy RLS) :
  - infra_services : registre des services supervisés/contrôlables (allowlist).
  - infra_actions  : journal des actions de contrôle (start/stop/restart/suspend).
  - backup_runs    : exécutions de sauvegarde (DB / MinIO) supervisées.

Ajoute aussi le drapeau super-admin plateforme `users.is_platform_admin`
(`users` est exemptée Loi 1 — pas de company_id à filtrer).
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0048_admin_console"
down_revision = "0047_accounting_ledger"
branch_labels = None
depends_on = None


def _rls(table: str) -> None:
    """Active la RLS Loi 1 (isolation par tenant) sur une table app-admin."""
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
    op.execute(f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def upgrade() -> None:
    # ── Drapeau super-admin plateforme (table users, exemptée Loi 1) ──────────
    op.add_column(
        "users",
        sa.Column(
            "is_platform_admin",
            sa.Boolean,
            nullable=False,
            server_default=sa.false(),
        ),
    )

    # ════════════════════════════════════════════════════════════════════════
    # PÉRIMÈTRE A — App-admin (tenant, Loi 1)
    # ════════════════════════════════════════════════════════════════════════

    # ── Règles d'alerte (seuils) ──────────────────────────────────────────────
    op.create_table(
        "admin_alert_rules",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("metric", sa.String(120), nullable=False),
        sa.Column("comparator", sa.String(4), nullable=False),  # gt | lt | gte | lte
        sa.Column("threshold", sa.DECIMAL(18, 4), nullable=False),
        sa.Column("window_seconds", sa.Integer, nullable=False, server_default="300"),
        sa.Column("severity", sa.String(20), nullable=False, server_default="warning"),
        sa.Column("channel", sa.String(40), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "comparator IN ('gt','lt','gte','lte')", name="ck_admin_alert_rules_comparator"
        ),
        sa.CheckConstraint(
            "severity IN ('info','warning','critical')", name="ck_admin_alert_rules_severity"
        ),
    )
    op.create_index("idx_admin_alert_rules_company", "admin_alert_rules", ["company_id"])
    op.create_index(
        "idx_admin_alert_rules_company_active",
        "admin_alert_rules",
        ["company_id", "is_active"],
    )
    _rls("admin_alert_rules")

    # ── Alertes déclenchées ───────────────────────────────────────────────────
    op.create_table(
        "admin_alert_events",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "rule_id",
            UUID(as_uuid=True),
            sa.ForeignKey("admin_alert_rules.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("observed_value", sa.DECIMAL(18, 4), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("acked_by", UUID(as_uuid=True), nullable=True),
        sa.Column("acked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('open','acked','resolved')", name="ck_admin_alert_events_status"
        ),
    )
    op.create_index("idx_admin_alert_events_company", "admin_alert_events", ["company_id"])
    op.create_index("idx_admin_alert_events_rule", "admin_alert_events", ["rule_id"])
    op.create_index(
        "idx_admin_alert_events_company_status",
        "admin_alert_events",
        ["company_id", "status"],
    )
    _rls("admin_alert_events")

    # ════════════════════════════════════════════════════════════════════════
    # PÉRIMÈTRE B — Infra-admin (PLATEFORME, cross-tenant)
    # PAS de company_id, PAS de RLS — exception Loi 1 (cf. docstring).
    # Accès strictement gardé par require_platform_admin côté API.
    # ════════════════════════════════════════════════════════════════════════

    # ── Registre des services supervisés / contrôlables ───────────────────────
    op.create_table(
        "infra_services",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("kind", sa.String(40), nullable=False),  # container | db | cache | queue | proxy
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("last_known_state", sa.String(40), nullable=True),  # running|stopped|...
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_controllable", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("name", name="uq_infra_services_name"),
    )

    # ── Journal des actions de contrôle (alimenté en Phase 3) ─────────────────
    op.create_table(
        "infra_actions",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column(
            "service_id",
            UUID(as_uuid=True),
            sa.ForeignKey("infra_services.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("action", sa.String(20), nullable=False),  # start|stop|restart|suspend|status
        sa.Column("requested_by", UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="requested"),
        sa.Column("detail", sa.String(1000), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "action IN ('start','stop','restart','suspend','status')",
            name="ck_infra_actions_action",
        ),
        sa.CheckConstraint(
            "status IN ('requested','running','done','failed')",
            name="ck_infra_actions_status",
        ),
    )
    op.create_index("idx_infra_actions_service", "infra_actions", ["service_id"])
    op.create_index("idx_infra_actions_created", "infra_actions", ["created_at"])

    # ── Exécutions de sauvegarde supervisées ──────────────────────────────────
    op.create_table(
        "backup_runs",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("target", sa.String(20), nullable=False),  # db | minio
        sa.Column("kind", sa.String(20), nullable=False, server_default="scheduled"),
        sa.Column("status", sa.String(20), nullable=False, server_default="running"),
        sa.Column("size_bytes", sa.BigInteger, nullable=True),
        sa.Column("location", sa.String(1000), nullable=True),
        sa.Column("error", sa.String(2000), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("target IN ('db','minio')", name="ck_backup_runs_target"),
        sa.CheckConstraint("kind IN ('scheduled','manual')", name="ck_backup_runs_kind"),
        sa.CheckConstraint(
            "status IN ('running','success','failed')", name="ck_backup_runs_status"
        ),
    )
    op.create_index("idx_backup_runs_target_created", "backup_runs", ["target", "created_at"])
    op.create_index("idx_backup_runs_status", "backup_runs", ["status"])


def downgrade() -> None:
    # Périmètre B (pas de policy RLS à supprimer).
    op.drop_table("backup_runs")
    op.drop_table("infra_actions")
    op.drop_table("infra_services")
    # Périmètre A (supprimer les policies RLS avant les tables).
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON admin_alert_events;")
    op.drop_table("admin_alert_events")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON admin_alert_rules;")
    op.drop_table("admin_alert_rules")
    # Drapeau super-admin.
    op.drop_column("users", "is_platform_admin")
