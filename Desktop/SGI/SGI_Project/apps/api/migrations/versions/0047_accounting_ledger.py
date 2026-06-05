"""Accounting — plan comptable + grand-livre (double entrée).

Revision ID: 0047_accounting_ledger
Revises: 0046_scenario_video_object_key
Create Date: 2026-06-05

3 tables métier (RLS Loi 1 — company_id + policy + index) :
- accounting_chart_accounts : plan comptable (code unique par tenant, self-FK parent).
- accounting_journal_entries : écritures (réf JE-YYYY-NNNNN unique par tenant, machine à états).
- accounting_journal_lines : lignes débit XOR crédit, company_id DÉNORMALISÉ (RLS directe).
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0047_accounting_ledger"
down_revision = "0046_scenario_video_object_key"
branch_labels = None
depends_on = None


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
    op.execute(f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def upgrade() -> None:
    # ── Plan comptable ───────────────────────────────────────────────────────
    op.create_table(
        "accounting_chart_accounts",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(20), nullable=False),
        sa.Column("name_ar", sa.String(255), nullable=True),
        sa.Column("name_en", sa.String(255), nullable=False),
        sa.Column("name_fr", sa.String(255), nullable=True),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column(
            "parent_id",
            UUID(as_uuid=True),
            sa.ForeignKey("accounting_chart_accounts.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "type IN ('asset','liability','equity','revenue','expense')",
            name="ck_accounting_chart_accounts_type",
        ),
        sa.UniqueConstraint("company_id", "code", name="uq_accounting_chart_accounts_code"),
    )
    op.create_index(
        "idx_accounting_chart_accounts_company", "accounting_chart_accounts", ["company_id"]
    )
    op.create_index(
        "idx_accounting_chart_accounts_parent", "accounting_chart_accounts", ["parent_id"]
    )
    op.create_index(
        "idx_accounting_chart_accounts_company_type",
        "accounting_chart_accounts",
        ["company_id", "type"],
    )
    _rls("accounting_chart_accounts")

    # ── Écritures de journal ─────────────────────────────────────────────────
    op.create_table(
        "accounting_journal_entries",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("reference", sa.String(20), nullable=False),
        sa.Column("entry_date", sa.Date, nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('draft','posted','void')",
            name="ck_accounting_journal_entries_status",
        ),
        sa.UniqueConstraint(
            "company_id", "reference", name="uq_accounting_journal_entries_reference"
        ),
    )
    op.create_index(
        "idx_accounting_journal_entries_company", "accounting_journal_entries", ["company_id"]
    )
    op.create_index(
        "idx_accounting_journal_entries_company_status",
        "accounting_journal_entries",
        ["company_id", "status"],
    )
    op.create_index(
        "idx_accounting_journal_entries_company_date",
        "accounting_journal_entries",
        ["company_id", "entry_date"],
    )
    _rls("accounting_journal_entries")

    # ── Lignes d'écriture (company_id dénormalisé) ──────────────────────────
    op.create_table(
        "accounting_journal_lines",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "entry_id",
            UUID(as_uuid=True),
            sa.ForeignKey("accounting_journal_entries.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "account_id",
            UUID(as_uuid=True),
            sa.ForeignKey("accounting_chart_accounts.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("debit", sa.DECIMAL(15, 2), nullable=False, server_default="0"),
        sa.Column("credit", sa.DECIMAL(15, 2), nullable=False, server_default="0"),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("debit >= 0", name="ck_accounting_journal_lines_debit_pos"),
        sa.CheckConstraint("credit >= 0", name="ck_accounting_journal_lines_credit_pos"),
        sa.CheckConstraint(
            "(debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)",
            name="ck_accounting_journal_lines_xor",
        ),
    )
    op.create_index(
        "idx_accounting_journal_lines_company", "accounting_journal_lines", ["company_id"]
    )
    op.create_index("idx_accounting_journal_lines_entry", "accounting_journal_lines", ["entry_id"])
    op.create_index(
        "idx_accounting_journal_lines_account", "accounting_journal_lines", ["account_id"]
    )
    op.create_index(
        "idx_accounting_journal_lines_company_account",
        "accounting_journal_lines",
        ["company_id", "account_id"],
    )
    _rls("accounting_journal_lines")


def downgrade() -> None:
    # Ordre inverse des FK : lignes → écritures → comptes.
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON accounting_journal_lines;")
    op.drop_table("accounting_journal_lines")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON accounting_journal_entries;")
    op.drop_table("accounting_journal_entries")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON accounting_chart_accounts;")
    op.drop_table("accounting_chart_accounts")
