"""Golden Visa — suivi de revue par document (colonne JSONB document_status).

Revision ID: 0058_golden_visa_document_status
Revises: 0057_finance_dunning_events
Create Date: 2026-06-06

Ajoute `document_status` (JSONB) sur golden_visa_applications : statut de revue
par pièce ({label: {status, notes, reviewed_at}}, status ∈ pending/approved/rejected).
Pas de nouvelle table (la table porte déjà la RLS Loi 1).
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0058_golden_visa_document_status"
down_revision = "0057_finance_dunning_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "golden_visa_applications",
        sa.Column("document_status", JSONB, nullable=False, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_column("golden_visa_applications", "document_status")
