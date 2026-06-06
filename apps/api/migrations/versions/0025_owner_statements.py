"""Propriétaires — relevés mensuels (owner_statements) + notifications in-app.

Revision ID: 0025_owner_statements
Revises: 0024_contract_renewal_signature
Create Date: 2026-05-30

Crée :
- owner_statements (relevé mensuel : revenus/dépenses/commission/payout net)
- notifications   (in-app générique, réutilisable)
RLS activé sur les 2 tables (Loi 1).
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0025_owner_statements"
down_revision = "0024_contract_renewal_signature"
branch_labels = None
depends_on = None


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
    op.execute(f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def upgrade() -> None:
    # ── owner_statements ─────────────────────────────────────────────────
    op.create_table(
        "owner_statements",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_party_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("owners.party_id", ondelete="CASCADE"), nullable=False),
        sa.Column("period_year", sa.Integer, nullable=False),
        sa.Column("period_month", sa.Integer, nullable=False),
        sa.Column("gross_revenue_aed", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("expenses_aed", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("commission_aed", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("net_payout_aed", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="AED"),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("line_items", JSONB, nullable=False, server_default="[]"),
        sa.Column("document_id", sa.UUID(as_uuid=True), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_check_constraint("ck_owner_statements_status", "owner_statements",
        "status IN ('draft','sent')")
    op.create_check_constraint("ck_owner_statements_month", "owner_statements",
        "period_month BETWEEN 1 AND 12")
    op.create_index("idx_owner_statements_company", "owner_statements", ["company_id"])
    op.create_index("idx_owner_statements_owner", "owner_statements", ["owner_party_id"])
    op.create_index("uq_owner_statements_period", "owner_statements",
                    ["company_id", "owner_party_id", "period_year", "period_month"],
                    unique=True)
    _rls("owner_statements")

    # ── notifications ────────────────────────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("recipient_user_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("recipient_party_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=True),
        sa.Column("type", sa.String(40), nullable=False),
        sa.Column("channel", sa.String(20), nullable=False, server_default="in_app"),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text, nullable=True),
        sa.Column("payload", JSONB, nullable=False, server_default="{}"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_check_constraint("ck_notifications_status", "notifications",
        "status IN ('pending','sent','read')")
    op.create_index("idx_notifications_company", "notifications", ["company_id"])
    op.create_index("idx_notifications_recipient_user", "notifications",
                    ["company_id", "recipient_user_id", "status"])
    op.create_index("idx_notifications_recipient_party", "notifications",
                    ["company_id", "recipient_party_id", "status"])
    _rls("notifications")


def downgrade() -> None:
    for t in ("notifications", "owner_statements"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {t};")
        op.drop_table(t)
