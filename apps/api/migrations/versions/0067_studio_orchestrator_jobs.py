"""Studio de Modules — jobs de l'orchestrateur de génération de code (Phase 3).

Revision ID: 0067_studio_orchestrator_jobs
Revises: 0066_studio_modules
Create Date: 2026-06-08

Table PLATEFORME (cross-tenant, HORS Loi 1 — pas de company_id ni RLS, comme
`studio_modules`/`infra_actions`). Journal append-only d'un run du worker dédié
`worker-studio` : l'API n'insère qu'une ligne `status='requested'` et enqueue ;
seul le worker (queue `studio`, profil compose éteint par défaut) la fait transiter.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0067_studio_orchestrator_jobs"
down_revision = "0066_studio_modules"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "studio_orchestrator_jobs",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("module_id", UUID(as_uuid=True), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False, server_default="codegen"),
        sa.Column("status", sa.String(20), nullable=False, server_default="requested"),
        sa.Column("phase", sa.String(20), nullable=False, server_default="queued"),
        sa.Column("requested_by", UUID(as_uuid=True), nullable=True),
        sa.Column("detail", sa.String(4000), nullable=True),
        sa.Column("radar_report", JSONB(), nullable=True),
        sa.Column("chasseur_report", JSONB(), nullable=True),
        sa.Column("branch_name", sa.String(200), nullable=True),
        sa.Column("pr_url", sa.String(500), nullable=True),
        sa.Column("pr_number", sa.Integer(), nullable=True),
        sa.Column("worktree_path", sa.String(500), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["module_id"], ["studio_modules.id"], ondelete="CASCADE"),
        sa.CheckConstraint(
            "status IN ('requested','running','done','failed')", name="ck_studio_job_status"
        ),
        sa.CheckConstraint(
            "phase IN ('queued','scaffold','radar','chasseur','push','pr','done','failed')",
            name="ck_studio_job_phase",
        ),
    )
    op.create_index("idx_studio_jobs_module", "studio_orchestrator_jobs", ["module_id"])


def downgrade() -> None:
    op.drop_index("idx_studio_jobs_module", table_name="studio_orchestrator_jobs")
    op.drop_table("studio_orchestrator_jobs")
