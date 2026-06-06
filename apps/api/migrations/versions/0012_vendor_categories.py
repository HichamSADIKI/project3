"""Phase 2 — Multi-catégories fournisseur activées par l'admin.

Revision ID: 0012_vendor_categories
Revises: 0011_vendor_docs_missions
Create Date: 2026-05-29

Un fournisseur peut désormais être activé sur **une ou plusieurs catégories**
de prestation (et non plus une seule via `vendor_type`). La colonne `categories`
(JSONB, liste de codes VendorType) porte l'ensemble activé par l'administrateur
depuis la fiche fournisseur du back-office.

`vendor_type` reste la catégorie principale (choisie à l'inscription) ; le backfill
initialise `categories = [vendor_type]` pour garantir « au minimum une catégorie ».
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = "0012_vendor_categories"
down_revision = "0011_vendor_docs_missions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "vendors",
        sa.Column(
            "categories", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")
        ),
    )
    # Backfill : au moins la catégorie principale est activée.
    op.execute(
        "UPDATE vendors SET categories = jsonb_build_array(vendor_type) "
        "WHERE categories IS NULL OR categories = '[]'::jsonb"
    )


def downgrade() -> None:
    op.drop_column("vendors", "categories")
