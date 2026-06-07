"""Phase ERP — MFA (TOTP) sur les comptes utilisateurs.

Revision ID: 0017_mfa
Revises: 0016_workflow_engine
Create Date: 2026-05-30

Ajoute deux colonnes à `users` :
- mfa_secret  : secret TOTP chiffré (Fernet), nullable — NULL = MFA non activé.
- mfa_enabled : booléen, False par défaut.
Pas de nouvelle table — le MFA est porté directement par le compte utilisateur.
"""
from alembic import op
import sqlalchemy as sa


revision = "0017_mfa"
down_revision = "0016_workflow_engine"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column(
        "mfa_secret", sa.Text, nullable=True, comment="Secret TOTP chiffré (Fernet)"
    ))
    op.add_column("users", sa.Column(
        "mfa_enabled", sa.Boolean, nullable=False,
        server_default="false",
        comment="True si le MFA TOTP est activé sur ce compte",
    ))
    op.create_index("idx_users_mfa_enabled", "users", ["mfa_enabled"])


def downgrade() -> None:
    op.drop_index("idx_users_mfa_enabled", table_name="users")
    op.drop_column("users", "mfa_enabled")
    op.drop_column("users", "mfa_secret")
