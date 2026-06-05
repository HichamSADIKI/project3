"""agenda_events

Table métier Agenda (RLS Loi 1 — company_id + policy + index) :
- agenda_events : RDV / visites / tâches / appels, rattachables à client/bien/agent.

Revision ID: 0054_agenda_events
Revises: 0053_infra_remediation_rules
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0054_agenda_events"
down_revision = "0053_infra_remediation_rules"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agenda_events",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("event_type", sa.String(20), nullable=False, server_default="appointment"),
        sa.Column("status", sa.String(20), nullable=False, server_default="scheduled"),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("all_day", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column(
            "client_id",
            UUID(as_uuid=True),
            sa.ForeignKey("clients.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "property_id",
            UUID(as_uuid=True),
            sa.ForeignKey("properties.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "assigned_user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_agenda_events_company", "agenda_events", ["company_id"])
    op.create_index("idx_agenda_events_company_start", "agenda_events", ["company_id", "start_at"])

    op.execute("ALTER TABLE agenda_events ENABLE ROW LEVEL SECURITY;")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON agenda_events
        USING (company_id = current_setting('app.current_company_id')::UUID);
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON agenda_events;")
    op.drop_table("agenda_events")
