"""Phase ERP — Workflow Engine (Phase 5).

Revision ID: 0016_workflow_engine
Revises: 0015_conversations
Create Date: 2026-05-30

Crée :
- workflow_templates  (modèles réutilisables, steps en JSONB)
- workflow_instances  (occurrences sur objets métier)
- workflow_steps      (étapes concrètes avec SLA)
- workflow_events     (journal immuable)
RLS activé sur les 4 tables (Loi 1).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = "0016_workflow_engine"
down_revision = "0015_conversations"
branch_labels = None
depends_on = None


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
    op.execute(f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def upgrade() -> None:
    # ── workflow_templates ───────────────────────────────────────────────
    op.create_table(
        "workflow_templates",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("workflow_type", sa.String(50), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("steps_definition", JSONB, nullable=False, server_default="[]"),
        sa.Column("active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        "ck_wf_template_type", "workflow_templates",
        "workflow_type IN ('quote_approval','sla_escalation','contract_approval','custom')",
    )
    op.create_index("idx_wf_templates_company_type", "workflow_templates",
                    ["company_id", "workflow_type"])
    _rls("workflow_templates")

    # ── workflow_instances ────────────────────────────────────────────────
    op.create_table(
        "workflow_instances",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("template_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("workflow_templates.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("maintenance_ticket_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("maintenance_tickets.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("maintenance_quote_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("maintenance_quotes.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("contract_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("contracts.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="in_progress"),
        sa.Column("started_by", sa.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        "ck_wf_instance_status", "workflow_instances",
        "status IN ('in_progress','approved','rejected','cancelled')",
    )
    op.create_index("idx_wf_instances_company_status", "workflow_instances",
                    ["company_id", "status"])
    op.create_index("idx_wf_instances_template", "workflow_instances", ["template_id"])
    _rls("workflow_instances")

    # ── workflow_steps ────────────────────────────────────────────────────
    op.create_table(
        "workflow_steps",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("instance_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("workflow_instances.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_order", sa.Integer, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("step_type", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("actor_user_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("actor_role", sa.String(30), nullable=True),
        sa.Column("sla_due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_check_constraint(
        "ck_wf_step_type", "workflow_steps",
        "step_type IN ('approval','notification','auto','escalation')",
    )
    op.create_check_constraint(
        "ck_wf_step_status", "workflow_steps",
        "status IN ('pending','in_progress','approved','rejected','skipped','escalated')",
    )
    op.create_index("idx_wf_steps_instance", "workflow_steps", ["instance_id", "step_order"])
    op.create_index("idx_wf_steps_sla", "workflow_steps", ["sla_due_at"])
    op.create_index("idx_wf_steps_actor", "workflow_steps", ["actor_user_id"])
    _rls("workflow_steps")

    # ── workflow_events ───────────────────────────────────────────────────
    op.create_table(
        "workflow_events",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("instance_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("workflow_instances.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("workflow_steps.id", ondelete="SET NULL"), nullable=True),
        sa.Column("actor_user_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("event_type", sa.String(20), nullable=False),
        sa.Column("comment", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )
    op.create_check_constraint(
        "ck_wf_event_type", "workflow_events",
        "event_type IN ('approve','reject','note','escalate','start','complete','cancel')",
    )
    op.create_index("idx_wf_events_instance", "workflow_events",
                    ["instance_id", "created_at"])
    _rls("workflow_events")


def downgrade() -> None:
    for t in ("workflow_events", "workflow_steps",
              "workflow_instances", "workflow_templates"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {t};")
        op.drop_table(t)
