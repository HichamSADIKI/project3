"""Réglage du design du site public (vitrine) — pilotable depuis Website.

Revision ID: 0061_public_site_design
Revises: 0060_signature_proofs
Create Date: 2026-06-07

Une ligne par société : modèle de design appliqué au portail public.
- `mode`        : 'manual' (un style fixe) ou 'auto' (rotation temporisée).
- `style`       : style actif en mode manuel (instagram | snapchat | facebook).
- `delay_hours` : période de rotation en mode auto.
- `rotation_since` : ancre temporelle de la rotation (style actif = dérivé du
  temps écoulé depuis cette date).

Loi 1 : `company_id NOT NULL` + index + RLS `tenant_isolation`. Le rôle restreint
`sgi_app` reçoit ses droits via l'ALTER DEFAULT PRIVILEGES posé en 0023.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0061_public_site_design"
down_revision = "0060_signature_proofs"
branch_labels = None
depends_on = None

TABLE = "public_site_design"


def upgrade() -> None:
    op.create_table(
        TABLE,
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("mode", sa.String(16), nullable=False, server_default="manual"),
        sa.Column("style", sa.String(32), nullable=False, server_default="instagram"),
        sa.Column("delay_hours", sa.Integer(), nullable=False, server_default="6"),
        sa.Column("rotation_since", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("mode IN ('manual','auto')", name="ck_psd_mode"),
        sa.CheckConstraint("style IN ('instagram','snapchat','facebook')", name="ck_psd_style"),
        sa.CheckConstraint("delay_hours >= 1 AND delay_hours <= 168", name="ck_psd_delay"),
    )
    # Une seule ligne de réglage par société.
    op.create_index("idx_public_site_design_company", TABLE, ["company_id"], unique=True)

    op.execute(f"ALTER TABLE {TABLE} ENABLE ROW LEVEL SECURITY;")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON {TABLE}
        USING (company_id = current_setting('app.current_company_id')::UUID);
        """
    )


def downgrade() -> None:
    op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {TABLE};")
    op.drop_index("idx_public_site_design_company", table_name=TABLE)
    op.drop_table(TABLE)
