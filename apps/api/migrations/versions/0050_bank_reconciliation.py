"""Bank reconciliation — comptes bancaires + lignes de relevé + rapprochement.

Revision ID: 0050_bank_reconciliation
Revises: 0049_device_tokens
Create Date: 2026-06-05

2 tables métier (RLS Loi 1 — company_id + policy + index) :
- bank_accounts : comptes bancaires du tenant.
- bank_statement_lines : lignes de relevé (montant signé), rapprochées ou non à
  une transaction finance (matched_transaction_id). company_id NON dénormalisé
  nécessaire pour RLS directe sur la table.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0050_bank_reconciliation"
down_revision = "0049_device_tokens"
branch_labels = None
depends_on = None


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
    op.execute(f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def upgrade() -> None:
    # ── Comptes bancaires ────────────────────────────────────────────────────
    op.create_table(
        "bank_accounts",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("account_number", sa.String(50), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="AED"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_bank_accounts_company", "bank_accounts", ["company_id"])
    _rls("bank_accounts")

    # ── Lignes de relevé bancaire ────────────────────────────────────────────
    op.create_table(
        "bank_statement_lines",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "bank_account_id",
            UUID(as_uuid=True),
            sa.ForeignKey("bank_accounts.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("value_date", sa.Date, nullable=False),
        sa.Column("label", sa.String(500), nullable=False),
        # Montant SIGNÉ : positif = entrée (crédit), négatif = sortie (débit).
        sa.Column("amount", sa.DECIMAL(15, 2), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="unreconciled"),
        sa.Column(
            "matched_transaction_id",
            UUID(as_uuid=True),
            sa.ForeignKey("finance_transactions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("matched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('unreconciled','reconciled')",
            name="ck_bank_statement_lines_status",
        ),
    )
    op.create_index("idx_bank_statement_lines_company", "bank_statement_lines", ["company_id"])
    op.create_index("idx_bank_statement_lines_account", "bank_statement_lines", ["bank_account_id"])
    op.create_index(
        "idx_bank_statement_lines_matched", "bank_statement_lines", ["matched_transaction_id"]
    )
    op.create_index(
        "idx_bank_statement_lines_company_status",
        "bank_statement_lines",
        ["company_id", "status"],
    )
    _rls("bank_statement_lines")


def downgrade() -> None:
    op.drop_table("bank_statement_lines")
    op.drop_table("bank_accounts")
