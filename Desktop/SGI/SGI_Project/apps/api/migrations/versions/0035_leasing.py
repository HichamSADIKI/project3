"""Leasing / Location — annonces de location + candidatures locataires.

Revision ID: 0035_leasing
Revises: 0034_sales
Create Date: 2026-06-02

Sous-catégorie « Location » : une annonce (`rental_listings`) sur une unité,
des candidatures (`rental_applications`) qui, une fois approuvées, aboutissent à
un bail `rentals` (rattaché via `converted_rental_id`).

Tables (RLS Loi 1) :
- rental_listings      : annonce (loyer, statut draft→leased, dates de dispo)
- rental_applications  : candidature d'un client sur une annonce (submitted→converted)
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0035_leasing"
down_revision = "0034_sales"
branch_labels = None
depends_on = None

# Statuts — DOIVENT correspondre EXACTEMENT aux helpers du service.
_LISTING_STATUSES = "'draft','published','reserved','leased','withdrawn'"
_APPLICATION_STATUSES = "'submitted','screening','approved','rejected','converted'"


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
    op.execute(f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def upgrade() -> None:
    # ── rental_listings ───────────────────────────────────────────────────────
    op.create_table(
        "rental_listings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("reference", sa.String(20), nullable=False),
        sa.Column("unit_id", UUID(as_uuid=True),
                  sa.ForeignKey("units.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("title_ar", sa.String(255), nullable=True),
        sa.Column("title_en", sa.String(255), nullable=True),
        sa.Column("title_fr", sa.String(255), nullable=True),
        sa.Column("monthly_rent", sa.Numeric(15, 2), nullable=False),
        sa.Column("annual_rent", sa.Numeric(15, 2), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("available_from", sa.Date, nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint("ck_rental_listings_status", "rental_listings",
                               f"status IN ({_LISTING_STATUSES})")
    op.create_index("idx_rental_listings_company", "rental_listings", ["company_id"])
    op.create_index("idx_rental_listings_company_status", "rental_listings",
                    ["company_id", "status"])
    op.create_index("uq_rental_listings_reference", "rental_listings",
                    ["company_id", "reference"], unique=True)
    _rls("rental_listings")

    # ── rental_applications ─────────────────────────────────────────────────────
    op.create_table(
        "rental_applications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("reference", sa.String(20), nullable=False),
        sa.Column("listing_id", UUID(as_uuid=True),
                  sa.ForeignKey("rental_listings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("applicant_client_id", UUID(as_uuid=True),
                  sa.ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("offered_rent", sa.Numeric(15, 2), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="submitted"),
        sa.Column("screening_notes", sa.Text, nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("converted_rental_id", UUID(as_uuid=True),
                  sa.ForeignKey("rentals.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint("ck_rental_applications_status", "rental_applications",
                               f"status IN ({_APPLICATION_STATUSES})")
    op.create_index("idx_rental_applications_company", "rental_applications", ["company_id"])
    op.create_index("idx_rental_applications_company_listing", "rental_applications",
                    ["company_id", "listing_id"])
    op.create_index("uq_rental_applications_reference", "rental_applications",
                    ["company_id", "reference"], unique=True)
    _rls("rental_applications")


def downgrade() -> None:
    for t in ("rental_applications", "rental_listings"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {t};")
        op.drop_table(t)
