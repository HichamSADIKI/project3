"""Finance — journal des relances d'impayés (dunning).

Revision ID: 0055_finance_dunning_events
Revises: 0054_finance_period_closure
Create Date: 2026-06-05

1 table métier (RLS Loi 1) : finance_dunning_events. Journal append-only des
relances envoyées pour une facture impayée (échéancier & relances). Chaque
relance porte un niveau d'escalade (J+1 / J+7 / J+15) et un canal.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0055_finance_dunning_events"
down_revision = "0054_finance_period_closure"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "finance_dunning_events",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "transaction_id",
            UUID(as_uuid=True),
            sa.ForeignKey("finance_transactions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("channel", sa.String(20), nullable=False),
        sa.Column("level", sa.Integer, nullable=False, server_default="1"),
        sa.Column("recipient", sa.String(255), nullable=True),
        sa.Column("message", sa.Text, nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("idx_finance_dunning_events_company", "finance_dunning_events", ["company_id"])
    op.create_index(
        "idx_finance_dunning_events_txn",
        "finance_dunning_events",
        ["company_id", "transaction_id"],
    )
    op.execute("ALTER TABLE finance_dunning_events ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY tenant_isolation ON finance_dunning_events
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def downgrade() -> None:
    op.drop_table("finance_dunning_events")
