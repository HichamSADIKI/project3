"""Merge des deux têtes alembic : chaîne téléphonie + chaîne audit (main).

Revision ID: 0030_merge_telephony_audit
Revises: 0029_calls_channel_unique, 0029_child_company_indexes
Create Date: 2026-06-02

La fusion de `main` dans `feat/telephony-realestate` a fait coexister deux têtes :
- `0029_calls_channel_unique` (téléphonie ← 0028_telephony)
- `0029_child_company_indexes` (audit ← 0028_notifications_type_index)
Cette migration de merge les réconcilie en une seule tête (aucun DDL).
"""

from collections.abc import Sequence

revision: str = "0030_merge_telephony_audit"
down_revision: str | Sequence[str] | None = (
    "0029_calls_channel_unique",
    "0029_child_company_indexes",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
