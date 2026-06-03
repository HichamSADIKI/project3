"""Profil public agent — champs vitrine sur users (phone/whatsapp/photo/title/bio).

Revision ID: 0039_user_public_profile
Revises: 0038_public_site_fields
Create Date: 2026-06-03

Champs exposés sur les profils agents publics de la vitrine. Tous nullables —
aucune contrainte, aucune RLS (table `users` exempte, cf. Loi 1).
"""
import sqlalchemy as sa
from alembic import op

revision = "0041_user_public_profile"
down_revision = "0040_public_site_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("phone", sa.String(40), nullable=True))
    op.add_column("users", sa.Column("whatsapp", sa.String(40), nullable=True))
    op.add_column("users", sa.Column("photo_url", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("title", sa.String(120), nullable=True))
    op.add_column("users", sa.Column("bio", sa.Text(), nullable=True))


def downgrade() -> None:
    for col in ("bio", "title", "photo_url", "whatsapp", "phone"):
        op.drop_column("users", col)
