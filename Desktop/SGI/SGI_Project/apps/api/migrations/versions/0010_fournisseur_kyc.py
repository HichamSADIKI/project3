"""Phase 2 — KYC fournisseur : compte ↔ profil prestataire + licence + validation.

Revision ID: 0010_fournisseur_kyc
Revises: 0009_crm_lead_reference
Create Date: 2026-05-29

Étend la table `vendors` (profil prestataire, party-role étendant `clients`)
pour porter le workflow d'onboarding fournisseur unifié :

  - account_user_id            — lien 1-1 vers le compte de connexion (users.id)
                                  qui pilote ce profil prestataire. NULL pour les
                                  fiches créées par l'agence sans compte portail.
  - verification_status        — pending | verified | rejected (validation admin)
  - commercial_license_path    — clé objet MinIO de la licence commerciale uploadée
  - commercial_license_extracted — JSONB : champs extraits par OCR/IA (n° licence,
                                  expiration, autorité, raison sociale, confiance…)
  - verified_at / verified_by_user_id — traçabilité de la décision admin
  - rejection_reason           — motif en cas de rejet

Loi 1 : `vendors` porte déjà company_id + index + RLS (migration 0002) — on
n'ajoute que des colonnes, l'isolation tenant reste inchangée.

Backfill : les fiches `vendors` préexistantes ont été créées directement par
un admin/manager (CRUD interne) → réputées de confiance, passées en `verified`.
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0010_fournisseur_kyc"
down_revision = "0009_crm_lead_reference"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "vendors",
        sa.Column(
            "account_user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "vendors",
        sa.Column(
            "verification_status",
            sa.String(30),
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column(
        "vendors",
        sa.Column("commercial_license_path", sa.String(500), nullable=True),
    )
    op.add_column(
        "vendors",
        sa.Column(
            "commercial_license_extracted",
            JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.add_column(
        "vendors",
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "vendors",
        sa.Column(
            "verified_by_user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "vendors",
        sa.Column("rejection_reason", sa.Text(), nullable=True),
    )

    op.create_check_constraint(
        "ck_vendors_verification_status",
        "vendors",
        "verification_status IN ('pending','verified','rejected')",
    )
    op.create_index(
        "idx_vendors_account_user", "vendors", ["account_user_id"]
    )
    op.create_index(
        "idx_vendors_verification", "vendors", ["verification_status"]
    )

    # Les prestataires préexistants ont été créés en interne → confiance acquise.
    op.execute(
        "UPDATE vendors SET verification_status = 'verified' "
        "WHERE verification_status = 'pending'"
    )


def downgrade() -> None:
    op.drop_index("idx_vendors_verification", table_name="vendors")
    op.drop_index("idx_vendors_account_user", table_name="vendors")
    op.drop_constraint(
        "ck_vendors_verification_status", "vendors", type_="check"
    )
    op.drop_column("vendors", "rejection_reason")
    op.drop_column("vendors", "verified_by_user_id")
    op.drop_column("vendors", "verified_at")
    op.drop_column("vendors", "commercial_license_extracted")
    op.drop_column("vendors", "commercial_license_path")
    op.drop_column("vendors", "verification_status")
    op.drop_column("vendors", "account_user_id")
