"""Finance — clôture de période comptable.

Revision ID: 0054_finance_period_closure
Revises: 0053_infra_remediation_rules
Create Date: 2026-06-05

1 table métier (RLS Loi 1) : finance_period_closures. Une clôture verrouille les
transactions dont la date (created_at) est <= period_end (anti-modification).
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0054_finance_period_closure"
down_revision = "0053_infra_remediation_rules"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "finance_period_closures",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("period_end", sa.Date, nullable=False),
        sa.Column("note", sa.String(500), nullable=True),
        sa.Column("closed_by", sa.String(255), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "company_id", "period_end", name="uq_finance_period_closures_company_period"
        ),
    )
    op.create_index(
        "idx_finance_period_closures_company", "finance_period_closures", ["company_id"]
    )
    op.execute("ALTER TABLE finance_period_closures ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY tenant_isolation ON finance_period_closures
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def downgrade() -> None:
    op.drop_table("finance_period_closures")
