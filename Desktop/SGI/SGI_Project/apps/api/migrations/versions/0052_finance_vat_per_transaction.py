"""Finance — TVA par transaction (UAE).

Revision ID: 0052_finance_vat_per_transaction
Revises: 0051_infra_compose_service
Create Date: 2026-06-05

Ajoute 3 colonnes à finance_transactions pour une TVA explicite par transaction :
- tax_treatment : standard | zero_rated | exempt
- vat_rate      : taux appliqué (0.05 standard UAE par défaut)
- vat_amount    : montant de TVA stocké (= amount × rate, 0 si zero/exempt).
Backfill : les transactions existantes sont 'standard' → vat_amount = amount×0.05
(cohérent avec l'ancien rapport TVA dérivé).
"""

import sqlalchemy as sa
from alembic import op

revision = "0052_finance_vat_per_transaction"
down_revision = "0051_infra_compose_service"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "finance_transactions",
        sa.Column("tax_treatment", sa.String(20), nullable=False, server_default="standard"),
    )
    op.add_column(
        "finance_transactions",
        sa.Column("vat_rate", sa.DECIMAL(5, 4), nullable=False, server_default="0.05"),
    )
    op.add_column(
        "finance_transactions",
        sa.Column("vat_amount", sa.DECIMAL(15, 2), nullable=False, server_default="0"),
    )
    op.create_check_constraint(
        "ck_finance_transactions_tax_treatment",
        "finance_transactions",
        "tax_treatment IN ('standard','zero_rated','exempt')",
    )
    # Backfill : transactions existantes 'standard' → TVA = montant × taux.
    op.execute(
        "UPDATE finance_transactions "
        "SET vat_amount = ROUND(amount * vat_rate, 2) "
        "WHERE tax_treatment = 'standard'"
    )


def downgrade() -> None:
    op.drop_constraint("ck_finance_transactions_tax_treatment", "finance_transactions")
    op.drop_column("finance_transactions", "vat_amount")
    op.drop_column("finance_transactions", "vat_rate")
    op.drop_column("finance_transactions", "tax_treatment")
