"""Acquisitions — mandats d'achat acquéreur + offres d'achat.

Revision ID: 0033_acquisitions
Revises: 0032_service_tickets
Create Date: 2026-06-02

Côté acquéreur (sous-catégorie « Achat ») :
- buyer_mandates  : mandat d'achat (budget, critères, point + rayon PostGIS).
- purchase_offers : offre d'achat sur un bien, rattachée à un mandat.

Tables RLS (Loi 1 — company_id NOT NULL + index + politique tenant_isolation).
Loi 2 : buyer_mandates.preferred_location = GEOMETRY(Point, 4326) + index GIST.
"""
import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geometry
from sqlalchemy.dialects.postgresql import UUID

revision = "0033_acquisitions"
down_revision = "0032_service_tickets"
branch_labels = None
depends_on = None

_MANDATE_STATUSES = "'active','fulfilled','expired','cancelled'"
_OFFER_STATUSES = "'draft','submitted','accepted','rejected','withdrawn'"


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
    op.execute(f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def upgrade() -> None:
    # ── buyer_mandates ───────────────────────────────────────────────────
    op.create_table(
        "buyer_mandates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("reference", sa.String(20), nullable=False),
        sa.Column("buyer_client_id", UUID(as_uuid=True),
                  sa.ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("budget_min", sa.Numeric(15, 2), nullable=True),
        sa.Column("budget_max", sa.Numeric(15, 2), nullable=True),
        sa.Column("property_type", sa.String(30), nullable=True),
        sa.Column("bedrooms_min", sa.Integer, nullable=True),
        sa.Column("preferred_location", Geometry("POINT", srid=4326), nullable=True),
        sa.Column("search_radius_m", sa.Integer, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint("ck_buyer_mandates_status", "buyer_mandates",
                               f"status IN ({_MANDATE_STATUSES})")
    op.create_index("idx_buyer_mandates_company", "buyer_mandates", ["company_id"])
    op.create_index("idx_buyer_mandates_company_status", "buyer_mandates",
                    ["company_id", "status"])
    op.create_index("uq_buyer_mandates_reference", "buyer_mandates",
                    ["company_id", "reference"], unique=True)
    # Loi 2 : index GIST sur le point de recherche.
    op.execute(
        "CREATE INDEX idx_buyer_mandates_location_gist "
        "ON buyer_mandates USING GIST (preferred_location)"
    )
    _rls("buyer_mandates")

    # ── purchase_offers ──────────────────────────────────────────────────
    op.create_table(
        "purchase_offers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("reference", sa.String(20), nullable=False),
        sa.Column("mandate_id", UUID(as_uuid=True),
                  sa.ForeignKey("buyer_mandates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("property_id", UUID(as_uuid=True),
                  sa.ForeignKey("properties.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint("ck_purchase_offers_status", "purchase_offers",
                               f"status IN ({_OFFER_STATUSES})")
    op.create_index("idx_purchase_offers_company", "purchase_offers", ["company_id"])
    op.create_index("idx_purchase_offers_company_mandate", "purchase_offers",
                    ["company_id", "mandate_id"])
    op.create_index("uq_purchase_offers_reference", "purchase_offers",
                    ["company_id", "reference"], unique=True)
    _rls("purchase_offers")


def downgrade() -> None:
    for t in ("purchase_offers", "buyer_mandates"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {t};")
        op.drop_table(t)
