"""Référence unique PAR société, pas globalement (défaut multi-tenant).

Revision ID: 0025_reference_composite_unique
Revises: 0024_contract_renewal_signature
Create Date: 2026-05-30

Problème corrigé (audit) :
`properties.reference`, `contracts.reference` et `finance_transactions.reference`
portaient une contrainte `UNIQUE(reference)` GLOBALE. Or les séquences sont
calculées par société (explicitement pour properties via `count WHERE
company_id = X` ; via la RLS pour contracts/finance). Deux sociétés génèrent
donc toutes deux `DXB-2026-0001` / `CNT-2026-0001` / `TXN-2026-00001` → la 2ᵉ
société se fait rejeter par la contrainte globale. Vrai défaut multi-tenant,
aggravé par l'activation réelle de la RLS (C1).

Correctif :
Remplace la contrainte globale par une contrainte composite
`UNIQUE(company_id, reference)` sur les 3 tables. La référence reste unique
À L'INTÉRIEUR d'une société, mais deux sociétés peuvent réutiliser la même.
"""
from alembic import op

revision = "0025_reference_composite_unique"
down_revision = "0024_contract_renewal_signature"
branch_labels = None
depends_on = None

# (table, ancienne contrainte globale, nouvelle contrainte composite)
_TABLES = [
    ("properties", "properties_reference_key", "uq_properties_company_reference"),
    ("contracts", "contracts_reference_key", "uq_contracts_company_reference"),
    (
        "finance_transactions",
        "finance_transactions_reference_key",
        "uq_finance_transactions_company_reference",
    ),
]


def upgrade() -> None:
    for table, old_global, new_composite in _TABLES:
        op.drop_constraint(old_global, table, type_="unique")
        op.create_unique_constraint(new_composite, table, ["company_id", "reference"])


def downgrade() -> None:
    for table, old_global, new_composite in _TABLES:
        op.drop_constraint(new_composite, table, type_="unique")
        op.create_unique_constraint(old_global, table, ["reference"])
