"""merge 0025 heads (owner_statements + reference_composite_unique)

Revision ID: 0026_merge_0025
Revises: 0025_owner_statements, 0025_reference_composite_unique
Create Date: 2026-05-30 17:56:40.209837

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0026_merge_0025'
down_revision: Union[str, None] = ('0025_owner_statements', '0025_reference_composite_unique')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
