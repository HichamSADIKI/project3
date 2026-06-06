"""Phase 2 — Catégorie multi-secteurs sur crm_leads.

Revision ID: 0007_crm_lead_category
Revises: 0006_role_partner_to_fournisseur
Create Date: 2026-05-29

Ajoute le champ `category` (string 30) à crm_leads pour router les leads par
secteur métier (realestate, tourisme, sante, assurance, banques, amazon,
consultants, admin, travail). Permet l'expression de besoin via le portal
client (texte / dictée) à être dispatchée vers le bon pipeline CRM.

Loi 1 respectée — index composite (company_id, category, status) pour le
kanban sectoriel.
"""
from alembic import op
import sqlalchemy as sa


revision = "0007_crm_lead_category"
down_revision = "0006_role_partner_to_fournisseur"
branch_labels = None
depends_on = None


VALID_CATEGORIES = (
    "realestate",
    "tourisme",
    "sante",
    "assurance",
    "banques",
    "amazon",
    "consultants",
    "admin",
    "travail",
)


def upgrade() -> None:
    op.add_column(
        "crm_leads",
        sa.Column(
            "category",
            sa.String(30),
            nullable=False,
            server_default="realestate",
        ),
    )
    op.create_check_constraint(
        "ck_crm_leads_category",
        "crm_leads",
        f"category IN {VALID_CATEGORIES!r}".replace("'", "'"),
    )
    op.create_index(
        "idx_crm_leads_company_category_status",
        "crm_leads",
        ["company_id", "category", "status"],
    )


def downgrade() -> None:
    op.drop_index("idx_crm_leads_company_category_status", table_name="crm_leads")
    op.drop_constraint("ck_crm_leads_category", "crm_leads", type_="check")
    op.drop_column("crm_leads", "category")
