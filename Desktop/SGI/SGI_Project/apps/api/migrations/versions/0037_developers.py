"""Developers / Promoteurs — annuaire des promoteurs immobiliers UAE.

Revision ID: 0037_developers
Revises: 0036_iam
Create Date: 2026-06-03

Table (RLS Loi 1) :
- developers : promoteur (raison sociale multilingue, licence, ville, contact,
  indicateurs portefeuille). Référence triable `DEV-YYYY-NNNNNN`, unique par tenant.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0037_developers"
down_revision = "0036_iam"
branch_labels = None
depends_on = None


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
    op.execute(f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def upgrade() -> None:
    op.create_table(
        "developers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("reference", sa.String(20), nullable=False),
        sa.Column("name_en", sa.String(300), nullable=False),
        sa.Column("name_ar", sa.String(300), nullable=True),
        sa.Column("name_fr", sa.String(300), nullable=True),
        sa.Column("city", sa.String(150), nullable=True),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("trade_license", sa.String(100), nullable=True),
        sa.Column("phone", sa.String(40), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("website", sa.String(255), nullable=True),
        sa.Column("projects_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("units_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_developers_company", "developers", ["company_id"])
    op.create_index(
        "uq_developers_reference", "developers", ["company_id", "reference"], unique=True
    )
    _rls("developers")


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON developers;")
    op.drop_table("developers")
