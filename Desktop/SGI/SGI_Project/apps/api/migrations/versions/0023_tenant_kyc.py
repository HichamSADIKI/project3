"""Locataires / KYC — workflow de vérification d'identité (extension tenant_profiles).

Revision ID: 0023_tenant_kyc
Revises: 0022_app_role_rls
Create Date: 2026-05-30

Ajoute les colonnes KYC à `tenant_profiles` :
- kyc_status (not_started → pending → verified | rejected)
- kyc_verified_at / kyc_verified_by_user_id / kyc_rejection_reason

NB : chaîne sur 0022_app_role_rls (branche audit). Cette migration suppose donc
que 0022 est présent dans l'historique cible avant application.
"""
import sqlalchemy as sa
from alembic import op

revision = "0023_tenant_kyc"
down_revision = "0022_app_role_rls"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenant_profiles",
        sa.Column("kyc_status", sa.String(20), nullable=False,
                  server_default="not_started"),
    )
    op.add_column(
        "tenant_profiles",
        sa.Column("kyc_verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "tenant_profiles",
        sa.Column("kyc_verified_by_user_id", sa.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column(
        "tenant_profiles",
        sa.Column("kyc_rejection_reason", sa.String(500), nullable=True),
    )
    op.create_check_constraint(
        "ck_tenant_kyc_status", "tenant_profiles",
        "kyc_status IN ('not_started','pending','verified','rejected')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_tenant_kyc_status", "tenant_profiles", type_="check")
    op.drop_column("tenant_profiles", "kyc_rejection_reason")
    op.drop_column("tenant_profiles", "kyc_verified_by_user_id")
    op.drop_column("tenant_profiles", "kyc_verified_at")
    op.drop_column("tenant_profiles", "kyc_status")
