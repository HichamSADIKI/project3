"""Phase 2 — Langue préférée utilisateur (ar/en/fr) sur users.

Revision ID: 0008_user_preferred_language
Revises: 0007_crm_lead_category
Create Date: 2026-05-29

Ajoute le champ `preferred_language` (2 char) à users — permet au portail
de rediriger l'utilisateur dans sa langue après login (claim JWT `language`).
Valeurs autorisées : ar, en, fr (cf. packages/i18n).
"""
from alembic import op
import sqlalchemy as sa


revision = "0008_user_preferred_language"
down_revision = "0007_crm_lead_category"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "preferred_language",
            sa.String(2),
            nullable=False,
            server_default="en",
        ),
    )
    op.create_check_constraint(
        "ck_users_preferred_language",
        "users",
        "preferred_language IN ('ar', 'en', 'fr')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_users_preferred_language", "users", type_="check")
    op.drop_column("users", "preferred_language")
