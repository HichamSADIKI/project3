"""Téléphonie — unicité (company_id, channel_id) pour CDR idempotents via AMI.

Revision ID: 0029_calls_channel_unique
Revises: 0028_telephony
Create Date: 2026-06-02

Le listener AMI tourne sur CHAQUE réplica API (lifespan) → plusieurs listeners
reçoivent les mêmes events. Pour que la création de CDR entrants soit
idempotente (pas de doublon sous `make scale`), on impose l'unicité de
(company_id, channel_id) — channel_id = Linkedid Asterisk. Le get-or-create
résout les races sur cette contrainte.

Index PARTIEL (WHERE channel_id IS NOT NULL) : les CDR sans channel_id (ex.
logs manuels) ne sont pas contraints.
"""
import sqlalchemy as sa
from alembic import op

revision = "0029_calls_channel_unique"
down_revision = "0028_telephony"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "uq_calls_company_channel",
        "calls",
        ["company_id", "channel_id"],
        unique=True,
        postgresql_where=sa.text("channel_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_calls_company_channel", table_name="calls")
