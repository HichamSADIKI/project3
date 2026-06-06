"""Module Vente (sales) — mandat → annonce → offre → transaction.

Revision ID: 0034_sales
Revises: 0033_acquisitions
Create Date: 2026-06-02

Pipeline pré-contrat de vente immobilière (distinct du contrat lui-même, porté
par le module `contracts` type 'sale'). Quatre tables, toutes RLS (Loi 1) :
- sale_mandates      : mandat de vente confié par un vendeur
- sale_listings      : annonce publiée à partir d'un mandat (multilingue)
- sale_offers        : offre d'achat déposée sur une annonce
- sale_transactions  : transaction conclue + commission de l'agence
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0034_sales"
down_revision = "0033_acquisitions"
branch_labels = None
depends_on = None

_MANDATE_TYPES = "'exclusive','simple','open'"
_MANDATE_STATUSES = "'active','sold','expired','cancelled'"
_LISTING_STATUSES = "'draft','published','under_offer','sold','withdrawn'"
_OFFER_STATUSES = "'submitted','accepted','rejected','withdrawn'"
_TRANSACTION_STATUSES = "'pending','completed','cancelled'"


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
    op.execute(f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def upgrade() -> None:
    # ── sale_mandates ────────────────────────────────────────────────────────
    op.create_table(
        "sale_mandates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("reference", sa.String(20), nullable=False),
        sa.Column("seller_client_id", UUID(as_uuid=True),
                  sa.ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("property_id", UUID(as_uuid=True),
                  sa.ForeignKey("properties.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("mandate_type", sa.String(20), nullable=False, server_default="exclusive"),
        sa.Column("commission_rate", sa.Numeric(5, 2), nullable=False, server_default="2.00"),
        sa.Column("asking_price", sa.Numeric(15, 2), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint("ck_sale_mandates_type", "sale_mandates",
                               f"mandate_type IN ({_MANDATE_TYPES})")
    op.create_check_constraint("ck_sale_mandates_status", "sale_mandates",
                               f"status IN ({_MANDATE_STATUSES})")
    op.create_index("idx_sale_mandates_company", "sale_mandates", ["company_id"])
    op.create_index("idx_sale_mandates_company_status", "sale_mandates",
                    ["company_id", "status"])
    op.create_index("uq_sale_mandates_reference", "sale_mandates",
                    ["company_id", "reference"], unique=True)
    _rls("sale_mandates")

    # ── sale_listings ────────────────────────────────────────────────────────
    op.create_table(
        "sale_listings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("reference", sa.String(20), nullable=False),
        sa.Column("mandate_id", UUID(as_uuid=True),
                  sa.ForeignKey("sale_mandates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title_ar", sa.String(255), nullable=True),
        sa.Column("title_en", sa.String(255), nullable=True),
        sa.Column("title_fr", sa.String(255), nullable=True),
        sa.Column("list_price", sa.Numeric(15, 2), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint("ck_sale_listings_status", "sale_listings",
                               f"status IN ({_LISTING_STATUSES})")
    op.create_index("idx_sale_listings_company", "sale_listings", ["company_id"])
    op.create_index("idx_sale_listings_company_status", "sale_listings",
                    ["company_id", "status"])
    op.create_index("uq_sale_listings_reference", "sale_listings",
                    ["company_id", "reference"], unique=True)
    _rls("sale_listings")

    # ── sale_offers ──────────────────────────────────────────────────────────
    op.create_table(
        "sale_offers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("reference", sa.String(20), nullable=False),
        sa.Column("listing_id", UUID(as_uuid=True),
                  sa.ForeignKey("sale_listings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("buyer_client_id", UUID(as_uuid=True),
                  sa.ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="submitted"),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint("ck_sale_offers_status", "sale_offers",
                               f"status IN ({_OFFER_STATUSES})")
    op.create_index("idx_sale_offers_company", "sale_offers", ["company_id"])
    op.create_index("idx_sale_offers_company_listing", "sale_offers",
                    ["company_id", "listing_id"])
    op.create_index("uq_sale_offers_reference", "sale_offers",
                    ["company_id", "reference"], unique=True)
    _rls("sale_offers")

    # ── sale_transactions ────────────────────────────────────────────────────
    op.create_table(
        "sale_transactions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("reference", sa.String(20), nullable=False),
        sa.Column("listing_id", UUID(as_uuid=True),
                  sa.ForeignKey("sale_listings.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("offer_id", UUID(as_uuid=True),
                  sa.ForeignKey("sale_offers.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("final_price", sa.Numeric(15, 2), nullable=False),
        sa.Column("commission_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint("ck_sale_transactions_status", "sale_transactions",
                               f"status IN ({_TRANSACTION_STATUSES})")
    op.create_index("idx_sale_transactions_company", "sale_transactions", ["company_id"])
    op.create_index("uq_sale_transactions_reference", "sale_transactions",
                    ["company_id", "reference"], unique=True)
    _rls("sale_transactions")


def downgrade() -> None:
    for t in ("sale_transactions", "sale_offers", "sale_listings", "sale_mandates"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {t};")
        op.drop_table(t)
