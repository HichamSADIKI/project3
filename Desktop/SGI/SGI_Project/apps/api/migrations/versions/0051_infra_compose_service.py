"""Admin · D2 — mapping service supervisé → service Docker Compose.

Revision ID: 0051_infra_compose_service
Revises: 0050_bank_reconciliation
Create Date: 2026-06-05

Ajoute `infra_services.compose_service` : le nom du service Docker Compose (label
`com.docker.compose.service`) utilisé par l'exécuteur D2 pour résoudre le conteneur
cible (robuste au préfixe de projet, contrairement à un nom de conteneur en dur).
Nullable : un service supervisé non pilotable (ex. node-exporter) peut ne pas en avoir.
"""

import sqlalchemy as sa
from alembic import op

revision = "0051_infra_compose_service"
down_revision = "0050_bank_reconciliation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "infra_services",
        sa.Column("compose_service", sa.String(120), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("infra_services", "compose_service")
