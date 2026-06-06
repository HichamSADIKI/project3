"""Contrats & Renouvellement — liens de renouvellement + support e-signature.

Revision ID: 0024_contract_renewal_signature
Revises: 0023_app_role_rls
Create Date: 2026-05-30

Ajoute :
- contracts.renewed_from_contract_id (FK self) + contracts.signing_document_id
- rentals.renewed_from_rental_id (FK self)
"""
import sqlalchemy as sa
from alembic import op

revision = "0024_contract_renewal_signature"
down_revision = "0023_app_role_rls"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "contracts",
        sa.Column("renewed_from_contract_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("contracts.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column(
        "contracts",
        sa.Column("signing_document_id", sa.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        "idx_contracts_renewed_from", "contracts", ["renewed_from_contract_id"]
    )

    op.add_column(
        "rentals",
        sa.Column("renewed_from_rental_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("rentals.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index(
        "idx_rentals_renewed_from", "rentals", ["renewed_from_rental_id"]
    )


def downgrade() -> None:
    op.drop_index("idx_rentals_renewed_from", "rentals")
    op.drop_column("rentals", "renewed_from_rental_id")
    op.drop_index("idx_contracts_renewed_from", "contracts")
    op.drop_column("contracts", "signing_document_id")
    op.drop_column("contracts", "renewed_from_contract_id")
