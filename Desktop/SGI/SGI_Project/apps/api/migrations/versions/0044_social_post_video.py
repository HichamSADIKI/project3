"""Social post ↔ vidéo : un post social peut porter une vidéo générée (scénario).

Revision ID: 0044_social_post_video
Revises: 0043_video_scenarios
Create Date: 2026-06-04

Relie les deux briques Immobilier livrées séparément : une publication social
(`social_posts`) peut désormais référencer une vidéo générée
(`video_scenarios`). Colonne nullable + FK ON DELETE SET NULL (supprimer une
vidéo ne casse pas le post — il perd juste son média).
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0044_social_post_video"
down_revision = "0043_video_scenarios"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "social_posts",
        sa.Column(
            "video_scenario_id",
            UUID(as_uuid=True),
            sa.ForeignKey("video_scenarios.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("social_posts", "video_scenario_id")
