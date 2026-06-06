"""Ticketing SLA — tickets de service client + timeline d'événements.

Revision ID: 0032_service_tickets
Revises: 0031_omnichannel_inbox
Create Date: 2026-06-02

Service desk (distinct des tickets de MAINTENANCE immobilière, migration 0013) :
demandes de service client avec priorité, SLA, escalade, statut Kanban.

Tables (RLS Loi 1) :
- service_tickets        : le ticket (priorité, SLA, statut, agent assigné)
- service_ticket_events  : timeline (création, statut, assignation, commentaire, escalade)
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0032_service_tickets"
down_revision = "0031_omnichannel_inbox"
branch_labels = None
depends_on = None

_PRIORITIES = "'low','medium','high','urgent'"
_STATUSES = "'open','in_progress','pending','resolved','closed'"
_EVENTS = "'created','status_changed','assigned','commented','escalated'"


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
    op.execute(f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def upgrade() -> None:
    op.create_table(
        "service_tickets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("reference", sa.String(20), nullable=False),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("priority", sa.String(10), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("requester_client_id", UUID(as_uuid=True),
                  sa.ForeignKey("clients.id", ondelete="SET NULL"), nullable=True),
        sa.Column("assigned_agent_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("sla_due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("first_response_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("escalation_level", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint("ck_service_tickets_priority", "service_tickets",
                               f"priority IN ({_PRIORITIES})")
    op.create_check_constraint("ck_service_tickets_status", "service_tickets",
                               f"status IN ({_STATUSES})")
    op.create_index("idx_service_tickets_company", "service_tickets", ["company_id"])
    op.create_index("idx_service_tickets_company_status", "service_tickets",
                    ["company_id", "status"])
    op.create_index("idx_service_tickets_company_agent", "service_tickets",
                    ["company_id", "assigned_agent_id"])
    op.create_index("idx_service_tickets_company_priority", "service_tickets",
                    ["company_id", "priority"])
    op.create_index("idx_service_tickets_sla", "service_tickets",
                    ["company_id", "sla_due_at"])
    op.create_index("uq_service_tickets_reference", "service_tickets",
                    ["company_id", "reference"], unique=True)
    _rls("service_tickets")

    op.create_table(
        "service_ticket_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("ticket_id", UUID(as_uuid=True),
                  sa.ForeignKey("service_tickets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(20), nullable=False),
        sa.Column("actor_user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("body", sa.Text, nullable=True),
        sa.Column("payload", JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_check_constraint("ck_service_ticket_events_type", "service_ticket_events",
                               f"event_type IN ({_EVENTS})")
    op.create_index("idx_service_ticket_events_company", "service_ticket_events", ["company_id"])
    op.create_index("idx_service_ticket_events_ticket", "service_ticket_events",
                    ["company_id", "ticket_id"])
    _rls("service_ticket_events")


def downgrade() -> None:
    for t in ("service_ticket_events", "service_tickets"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {t};")
        op.drop_table(t)
