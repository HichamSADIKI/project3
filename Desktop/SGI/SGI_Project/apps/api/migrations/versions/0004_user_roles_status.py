"""Ajoute UserRole enum (CHECK) + colonne `status` (pending/active/rejected).

Revision ID: 0004_user_roles_status
Revises: 0003_buildings_units_pdc
Create Date: 2026-05-28

Phase 0 — Fondations Client/Partenaire.

Changements :
- `users.role` : CHECK contrainte sur {'admin','manager','agent','client','partner'}
- `users.status` : nouvelle colonne VARCHAR(20) NOT NULL DEFAULT 'active'
  Permet le workflow "inscription publique → pending → admin valide → active"
- Index sur status pour lister rapidement les comptes en attente
"""
from alembic import op
import sqlalchemy as sa

revision = "0004_user_roles_status"
down_revision = "0003_buildings_units_pdc"
branch_labels = None
depends_on = None


_ALLOWED_ROLES = ("admin", "manager", "agent", "client", "partner")
_ALLOWED_STATUSES = ("active", "pending", "rejected", "suspended")


def upgrade() -> None:
    # Normaliser les rôles existants : tout ce qui n'est pas dans la liste devient 'agent'
    roles_in = ", ".join(f"'{r}'" for r in _ALLOWED_ROLES)
    op.execute(f"UPDATE users SET role = 'agent' WHERE role NOT IN ({roles_in})")

    # Réduire la taille de la colonne role (50 → 20) pour aligner avec le modèle
    op.alter_column(
        "users",
        "role",
        existing_type=sa.String(length=50),
        type_=sa.String(length=20),
        existing_nullable=False,
    )

    # Ajouter la contrainte CHECK sur role
    op.create_check_constraint(
        "ck_users_role",
        "users",
        f"role IN ({roles_in})",
    )

    # Ajouter colonne status
    op.add_column(
        "users",
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="active",
        ),
    )
    statuses_in = ", ".join(f"'{s}'" for s in _ALLOWED_STATUSES)
    op.create_check_constraint(
        "ck_users_status",
        "users",
        f"status IN ({statuses_in})",
    )
    op.create_index("idx_users_status", "users", ["status"])


def downgrade() -> None:
    op.drop_index("idx_users_status", table_name="users")
    op.drop_constraint("ck_users_status", "users", type_="check")
    op.drop_column("users", "status")
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.alter_column(
        "users",
        "role",
        existing_type=sa.String(length=20),
        type_=sa.String(length=50),
        existing_nullable=False,
    )
