"""Immobilier Core — branches (succursales) + company_settings (paramètres UAE).

Revision ID: 0020_realestate_core
Revises: 0019_payments
Create Date: 2026-05-30

Crée :
- branches         (succursales/agences internes au tenant ; PostGIS location)
- company_settings (config UAE centralisée, singleton par tenant)
RLS activé sur les 2 tables (Loi 1). Index GIST sur branches.location (Loi 2).
"""
import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geometry
from sqlalchemy.dialects.postgresql import JSONB

revision = "0020_realestate_core"
down_revision = "0019_payments"
branch_labels = None
depends_on = None


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
    op.execute(f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def upgrade() -> None:
    # ── branches ─────────────────────────────────────────────────────────
    op.create_table(
        "branches",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(20), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("name_ar", sa.String(200), nullable=True),
        sa.Column("name_en", sa.String(200), nullable=True),
        sa.Column("name_fr", sa.String(200), nullable=True),
        sa.Column("emirate", sa.String(3), nullable=False, server_default="DXB"),
        sa.Column("address", sa.Text, nullable=True),
        sa.Column("location", Geometry("POINT", srid=4326), nullable=True),
        sa.Column("phone", sa.String(40), nullable=True),
        sa.Column("email", sa.String(200), nullable=True),
        sa.Column("manager_user_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint("ck_branches_emirate", "branches",
        "emirate IN ('DXB','AUH','SHJ','AJM','RAK','FUJ','UAQ')")
    op.create_index("idx_branches_company", "branches", ["company_id"])
    op.create_index("uq_branches_company_code", "branches",
                    ["company_id", "code"], unique=True)
    op.create_index("idx_branches_manager", "branches", ["manager_user_id"])
    op.execute(
        "CREATE INDEX idx_branches_location_gist ON branches USING GIST (location)"
    )
    _rls("branches")

    # ── company_settings ─────────────────────────────────────────────────
    op.create_table(
        "company_settings",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="AED"),
        sa.Column("vat_enabled", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("vat_rate", sa.Numeric(5, 2), nullable=False, server_default="5.00"),
        sa.Column("default_emirate", sa.String(3), nullable=False, server_default="DXB"),
        sa.Column("timezone", sa.String(50), nullable=False,
                  server_default="Asia/Dubai"),
        sa.Column("ejari_enabled", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("dld_enabled", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("fiscal_year_start_month", sa.Integer, nullable=False,
                  server_default="1"),
        sa.Column("invoice_prefix", sa.String(10), nullable=False, server_default="INV"),
        sa.Column("contract_prefix", sa.String(10), nullable=False, server_default="CTR"),
        sa.Column("default_payment_terms_days", sa.Integer, nullable=False,
                  server_default="30"),
        sa.Column("extra", JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_check_constraint("ck_company_settings_fiscal_month", "company_settings",
        "fiscal_year_start_month BETWEEN 1 AND 12")
    op.create_index("uq_company_settings_company", "company_settings",
                    ["company_id"], unique=True)
    _rls("company_settings")


def downgrade() -> None:
    for t in ("company_settings", "branches"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {t};")
        op.drop_table(t)
