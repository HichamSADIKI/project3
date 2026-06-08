"""Studio de Modules — tables plateforme (cross-tenant) + gouvernance 4-eyes.

Revision ID: 0066_studio_modules
Revises: 0065_presence_session
Create Date: 2026-06-08

Périmètre PLATEFORME (infra-admin, HORS Loi 1) : `studio_modules` et
`studio_integration_requests` n'ont **pas** de `company_id` ni de RLS (comme
`infra_services`/`infra_actions`). Gardées exclusivement par `require_platform_admin`.

Garde-fous en base (défense en profondeur) :
- `key` borné `^[a-z0-9_.]+$` (anti-injection — le `key` alimente branches/chemins en Phase 3).
- `flavor`/`mode`/`state` contraints par CHECK (machine à états du cycle de vie).
- 4-eyes : `approved_by <> requested_by` (un second humain distinct approuve).
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0066_studio_modules"
down_revision = "0065_presence_session"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "studio_modules",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("key", sa.String(120), nullable=False),
        sa.Column("title_ar", sa.String(200), nullable=False),
        sa.Column("title_en", sa.String(200), nullable=False),
        sa.Column("title_fr", sa.String(200), nullable=False),
        sa.Column("flavor", sa.String(10), nullable=False, server_default="lite"),
        sa.Column("mode", sa.String(10), nullable=False, server_default="manual"),
        sa.Column("state", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("schema_json", JSONB(), nullable=True),
        sa.Column("branch_name", sa.String(200), nullable=True),
        sa.Column("pr_url", sa.String(500), nullable=True),
        sa.Column("pr_number", sa.Integer(), nullable=True),
        sa.Column("radar_report", JSONB(), nullable=True),
        sa.Column("chasseur_report", JSONB(), nullable=True),
        sa.Column("is_integrated", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("key", name="uq_studio_modules_key"),
        sa.CheckConstraint("key ~ '^[a-z0-9_.]+$'", name="ck_studio_modules_key_charset"),
        sa.CheckConstraint("flavor IN ('lite','code')", name="ck_studio_modules_flavor"),
        sa.CheckConstraint("mode IN ('ai','manual')", name="ck_studio_modules_mode"),
        sa.CheckConstraint(
            "state IN ('draft','built','tested','audited','pr_open',"
            "'approved','integrated','rejected','failed')",
            name="ck_studio_modules_state",
        ),
    )

    op.create_table(
        "studio_integration_requests",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("module_id", UUID(as_uuid=True), nullable=False),
        sa.Column("requested_by", UUID(as_uuid=True), nullable=False),
        sa.Column("reason", sa.String(500), nullable=False),
        sa.Column("ticket_ref", sa.String(120), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("approved_by", UUID(as_uuid=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["module_id"], ["studio_modules.id"], ondelete="CASCADE"),
        sa.CheckConstraint(
            "approved_by IS NULL OR approved_by <> requested_by",
            name="ck_studio_intreq_four_eyes",
        ),
        sa.CheckConstraint(
            "status IN ('pending','approved','rejected','expired')",
            name="ck_studio_intreq_status",
        ),
    )
    op.create_index("idx_studio_intreq_module", "studio_integration_requests", ["module_id"])


def downgrade() -> None:
    op.drop_index("idx_studio_intreq_module", table_name="studio_integration_requests")
    op.drop_table("studio_integration_requests")
    op.drop_table("studio_modules")
