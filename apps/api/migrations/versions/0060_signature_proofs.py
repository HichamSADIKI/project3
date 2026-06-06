"""Infinity ID — preuves de signature qualifiée (table signature_proofs).

Revision ID: 0060_signature_proofs
Revises: 0059_identity_assurance
Create Date: 2026-06-06

Table métier (RLS Loi 1 — company_id + policy + index) :
- signature_proofs : preuve scellée (doc SHA‑256 + signataire + niveau + HMAC).
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0060_signature_proofs"
down_revision = "0059_identity_assurance"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "signature_proofs",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("signer_subject_type", sa.String(20), nullable=False),
        sa.Column("signer_subject_id", UUID(as_uuid=True), nullable=False),
        sa.Column("document_sha256", sa.String(64), nullable=False),
        sa.Column("qualified", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("signer_level", sa.String(2), nullable=False),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("signature", sa.String(64), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "signer_subject_type IN ('user','client')", name="ck_signature_proofs_subject_type"
        ),
    )
    op.create_index("idx_signature_proofs_company", "signature_proofs", ["company_id"])
    op.create_index(
        "idx_signature_proofs_document", "signature_proofs", ["company_id", "document_sha256"]
    )

    op.execute("ALTER TABLE signature_proofs ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY tenant_isolation ON signature_proofs
        USING (company_id = current_setting('app.current_company_id')::UUID);
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON signature_proofs;")
    op.drop_table("signature_proofs")
