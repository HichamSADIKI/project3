"""scenario: stocker la clé objet MinIO de la vidéo (URL « Voir » durable)

Les URLs présignées MinIO plafonnent à 7 jours : stocker l'URL signée sur la ligne
faisait expirer le lien « Voir » au bout d'une semaine. On stocke désormais la clé
objet (`video_object_key`) et on re-signe à chaque lecture → lien jamais périmé.

Revision ID: 0045_scenario_video_object_key
Revises: 0044_social_post_video
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision = "0045_scenario_video_object_key"
down_revision = "0044_social_post_video"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "video_scenarios",
        sa.Column("video_object_key", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("video_scenarios", "video_object_key")
