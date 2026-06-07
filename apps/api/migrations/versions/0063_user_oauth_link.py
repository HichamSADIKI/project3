"""Liaison SSO OAuth (Google / Apple) sur les comptes utilisateurs.

Revision ID: 0063_user_oauth_link
Revises: 0062_honeytokens
Create Date: 2026-06-08

Ajoute `oauth_provider` + `oauth_subject` à `users` pour épingler l'identité
sociale au compte interne (la connexion sociale n'autorise QUE des comptes
existants, match par email vérifié — pas d'auto-création).

`users` est une table EXEMPTE de RLS (Loi 1, cf. CLAUDE.md) → pas de policy
tenant ici. Index unique partiel (provider, subject) pour éviter qu'une même
identité sociale soit liée à deux comptes.
"""

import sqlalchemy as sa
from alembic import op

revision = "0063_user_oauth_link"
down_revision = "0062_honeytokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("oauth_provider", sa.String(16), nullable=True))
    op.add_column("users", sa.Column("oauth_subject", sa.String(255), nullable=True))
    # Unicité d'une identité sociale (NULLs ignorés → comptes sans SSO illimités).
    op.create_index(
        "uq_users_oauth_identity",
        "users",
        ["oauth_provider", "oauth_subject"],
        unique=True,
        postgresql_where=sa.text("oauth_subject IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_users_oauth_identity", table_name="users")
    op.drop_column("users", "oauth_subject")
    op.drop_column("users", "oauth_provider")
