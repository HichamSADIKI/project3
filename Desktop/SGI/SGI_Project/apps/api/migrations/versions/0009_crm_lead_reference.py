"""Phase 2 — Référence métier lisible sur crm_leads.

Revision ID: 0009_crm_lead_reference
Revises: 0008_user_preferred_language
Create Date: 2026-05-29

Ajoute le champ `reference` (CRM-YYYY-NNNNNN) à crm_leads — le code lisible de
chaque deal affiché dans la liste des deals du back-office. Backfill des lignes
existantes par tenant + année (numérotation stable triée sur created_at), puis
index unique composite (company_id, reference) — Loi 1 respectée.
"""
from alembic import op
import sqlalchemy as sa


revision = "0009_crm_lead_reference"
down_revision = "0008_user_preferred_language"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "crm_leads",
        sa.Column("reference", sa.String(20), nullable=True),
    )

    # Backfill : numérotation par (company_id, année de création), triée
    # chronologiquement pour des codes stables et reproductibles.
    op.execute(
        """
        WITH numbered AS (
            SELECT
                id,
                to_char(created_at, 'YYYY') AS yr,
                row_number() OVER (
                    PARTITION BY company_id, date_part('year', created_at)
                    ORDER BY created_at, id
                ) AS seq
            FROM crm_leads
        )
        UPDATE crm_leads l
        SET reference = 'CRM-' || numbered.yr || '-' || lpad(numbered.seq::text, 6, '0')
        FROM numbered
        WHERE l.id = numbered.id;
        """
    )

    op.create_index(
        "uq_crm_leads_company_reference",
        "crm_leads",
        ["company_id", "reference"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_crm_leads_company_reference", table_name="crm_leads")
    op.drop_column("crm_leads", "reference")
