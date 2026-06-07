"""Rename role value 'partner' -> 'fournisseur' (user-facing rename only).

Revision ID: 0006_role_partner_to_fournisseur
Revises: 0005_client_partner_modules
Create Date: 2026-05-28

Met à jour la valeur stockée dans `users.role` ainsi que la contrainte CHECK.
Les noms de tables internes (`partner_leads`, `partner_services`,
`partner_commission_entries`) et les colonnes (`partner_user_id`) sont
volontairement conservés — ils n'apparaissent pas côté utilisateur.
"""
from alembic import op

revision = "0006_role_partner_to_fournisseur"
down_revision = "0005_client_partner_modules"
branch_labels = None
depends_on = None


_NEW_ROLES = ("admin", "manager", "agent", "client", "fournisseur")
_OLD_ROLES = ("admin", "manager", "agent", "client", "partner")


def upgrade() -> None:
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.execute("UPDATE users SET role = 'fournisseur' WHERE role = 'partner'")
    roles_in = ", ".join(f"'{r}'" for r in _NEW_ROLES)
    op.create_check_constraint("ck_users_role", "users", f"role IN ({roles_in})")


def downgrade() -> None:
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.execute("UPDATE users SET role = 'partner' WHERE role = 'fournisseur'")
    roles_in = ", ".join(f"'{r}'" for r in _OLD_ROLES)
    op.create_check_constraint("ck_users_role", "users", f"role IN ({roles_in})")
