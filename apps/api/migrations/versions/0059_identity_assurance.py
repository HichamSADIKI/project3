"""Infinity ID — niveaux d'assurance des identités (table identity_assurance).

Revision ID: 0059_identity_assurance
Revises: 0058_golden_visa_document_status
Create Date: 2026-06-06

Table métier (RLS Loi 1 — company_id + policy + index) :
- identity_assurance : état de vérification + niveau d'assurance (L0–L3) par
  identité, unique par (company_id, subject_type, subject_id).
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0059_identity_assurance"
down_revision = "0058_golden_visa_document_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "identity_assurance",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("subject_type", sa.String(20), nullable=False),
        sa.Column("subject_id", UUID(as_uuid=True), nullable=False),
        sa.Column("email_verified", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("mobile_verified", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("emirates_id_verified", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("strong_auth_verified", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("level", sa.String(2), nullable=False, server_default="L0"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "subject_type IN ('user','client')", name="ck_identity_assurance_subject_type"
        ),
        sa.CheckConstraint("level IN ('L0','L1','L2','L3')", name="ck_identity_assurance_level"),
        sa.UniqueConstraint(
            "company_id", "subject_type", "subject_id", name="uq_identity_assurance_subject"
        ),
    )
    op.create_index("idx_identity_assurance_company", "identity_assurance", ["company_id"])

    op.execute("ALTER TABLE identity_assurance ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY tenant_isolation ON identity_assurance
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON identity_assurance;")
    op.drop_table("identity_assurance")
