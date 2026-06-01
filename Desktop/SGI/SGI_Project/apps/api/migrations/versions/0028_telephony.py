"""Téléphonie — journal d'appels (calls) + présence agent (agent_states).

Revision ID: 0028_telephony
Revises: 0027_refresh_tokens
Create Date: 2026-06-01

Centre de contact intégré à la rubrique Communication.
- calls        : CDR applicatif (entrant/sortant/interne), lié au client (screen
                 pop) et à l'agent. Référence CALL-YYYY-NNNNNN.
- agent_states : présence/disponibilité téléphonie d'un agent (1 par user/tenant).

RLS activé sur les 2 tables (Loi 1) — company_id NOT NULL + index + policy.
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0028_telephony"
down_revision = "0027_refresh_tokens"
branch_labels = None
depends_on = None


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
    op.execute(f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def upgrade() -> None:
    # ── calls ────────────────────────────────────────────────────────────
    op.create_table(
        "calls",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("reference", sa.String(20), nullable=False),
        sa.Column("direction", sa.String(10), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="ringing"),
        sa.Column("from_number", sa.String(50), nullable=True),
        sa.Column("to_number", sa.String(50), nullable=True),
        sa.Column("agent_user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("agent_extension", sa.String(20), nullable=True),
        sa.Column("client_id", UUID(as_uuid=True),
                  sa.ForeignKey("clients.id", ondelete="SET NULL"), nullable=True),
        sa.Column("queue", sa.String(50), nullable=True),
        # Identifiants techniques Asterisk (corrélation des events AMI).
        sa.Column("channel_id", sa.String(150), nullable=True),
        sa.Column("sip_call_id", sa.String(255), nullable=True),
        # Enregistrement (phase 4) + consentement PDPL.
        sa.Column("recording_url", sa.String(500), nullable=True),
        sa.Column("recording_consent", sa.Boolean, nullable=False, server_default=sa.false()),
        # Horodatage cycle de vie.
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("answered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("wait_seconds", sa.Integer, nullable=True),
        sa.Column("duration_seconds", sa.Integer, nullable=True),
        sa.Column("hangup_cause", sa.String(50), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_check_constraint(
        "ck_calls_direction", "calls",
        "direction IN ('inbound','outbound','internal')")
    op.create_check_constraint(
        "ck_calls_status", "calls",
        "status IN ('ringing','answered','completed','missed',"
        "'busy','no_answer','failed','cancelled')")
    op.create_index("idx_calls_company", "calls", ["company_id"])
    op.create_index("idx_calls_company_status", "calls", ["company_id", "status"])
    op.create_index("idx_calls_company_agent", "calls", ["company_id", "agent_user_id"])
    op.create_index("idx_calls_company_client", "calls", ["company_id", "client_id"])
    op.create_index("idx_calls_company_started", "calls", ["company_id", "started_at"])
    op.create_index("idx_calls_channel", "calls", ["channel_id"])
    op.create_index("uq_calls_reference", "calls",
                    ["company_id", "reference"], unique=True)
    _rls("calls")

    # ── agent_states ───────────────────────────────────────────────────────
    op.create_table(
        "agent_states",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("extension", sa.String(20), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="offline"),
        sa.Column("current_call_id", UUID(as_uuid=True),
                  sa.ForeignKey("calls.id", ondelete="SET NULL"), nullable=True),
        sa.Column("last_changed_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_check_constraint(
        "ck_agent_states_status", "agent_states",
        "status IN ('offline','available','busy','wrap_up','paused')")
    op.create_index("idx_agent_states_company", "agent_states", ["company_id"])
    op.create_index("idx_agent_states_company_status", "agent_states",
                    ["company_id", "status"])
    op.create_index("uq_agent_states_user", "agent_states",
                    ["company_id", "user_id"], unique=True)
    # Une extension donnée n'est attribuée qu'à un agent à la fois (par tenant).
    op.create_index("uq_agent_states_extension", "agent_states",
                    ["company_id", "extension"], unique=True,
                    postgresql_where=sa.text("extension IS NOT NULL"))
    _rls("agent_states")


def downgrade() -> None:
    for t in ("agent_states", "calls"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {t};")
        op.drop_table(t)
