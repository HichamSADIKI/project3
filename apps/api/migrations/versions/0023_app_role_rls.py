"""Rôle applicatif restreint pour activer réellement la RLS multi-tenant (C1).

Revision ID: 0023_app_role_rls
Revises: 0022_tenant_kyc
Create Date: 2026-05-30

Problème corrigé (audit C1) :
La connexion applicative utilisait `sgi_user` — SUPERUSER + propriétaire des
tables → il bypasse INCONDITIONNELLEMENT la RLS. Les policies `tenant_isolation`
n'étaient donc jamais appliquées au runtime ; l'isolation ne tenait que par le
filtrage applicatif `company_id`.

Correctif :
Crée un rôle `sgi_app` LOGIN, **NOSUPERUSER / NOBYPASSRLS / non-propriétaire**.
Les requêtes de l'API passent désormais par ce rôle → les policies RLS
(`company_id = current_setting('app.current_company_id')`) s'appliquent enfin
(en lecture ET en écriture, le USING servant aussi de WITH CHECK).

Le worker Celery et les migrations continuent d'utiliser `sgi_user` (privilégié)
car les tâches cron scannent légitimement toutes les sociétés (cross-tenant).

Opt-in : la migration n'agit que si la variable d'env `APP_DB_PASSWORD` est
définie (sinon no-op → aucun flux existant cassé). Le mot de passe doit être
identique à celui utilisé dans `APP_DATABASE_URL` côté API.
"""
import os

from alembic import op

revision = "0023_app_role_rls"
down_revision = "0022_tenant_kyc"
branch_labels = None
depends_on = None

APP_ROLE = "sgi_app"
OWNER_ROLE = "sgi_user"


def _escape_literal(value: str) -> str:
    """Échappe une chaîne pour un littéral SQL (doublage des apostrophes)."""
    return value.replace("'", "''")


def upgrade() -> None:
    password = os.getenv("APP_DB_PASSWORD")
    if not password:
        # Pas de mot de passe fourni → on n'active pas le rôle restreint.
        # (Garde-fou : ne casse pas `alembic upgrade head` en dev/CI sans la var.)
        print(
            "[0022] APP_DB_PASSWORD non défini — rôle applicatif restreint NON créé. "
            "Définir APP_DB_PASSWORD pour activer l'isolation RLS réelle (C1)."
        )
        return

    pwd = _escape_literal(password)

    # 1. Créer le rôle restreint (idempotent) puis (re)positionner son mot de passe.
    op.execute(
        f"""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{APP_ROLE}') THEN
                CREATE ROLE {APP_ROLE} LOGIN
                    NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
            END IF;
        END
        $$;
        """
    )
    op.execute(f"ALTER ROLE {APP_ROLE} WITH PASSWORD '{pwd}' NOBYPASSRLS NOSUPERUSER;")

    # 2. Droits sur le schéma + objets existants (CRUD, pas de DDL).
    op.execute(f"GRANT USAGE ON SCHEMA public TO {APP_ROLE};")
    op.execute(
        f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {APP_ROLE};"
    )
    op.execute(
        f"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {APP_ROLE};"
    )

    # 3. Privilèges par défaut pour les FUTURES tables/séquences créées par
    #    l'owner des migrations → pas besoin de re-granter à chaque nouveau module.
    op.execute(
        f"""
        ALTER DEFAULT PRIVILEGES FOR ROLE {OWNER_ROLE} IN SCHEMA public
            GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {APP_ROLE};
        """
    )
    op.execute(
        f"""
        ALTER DEFAULT PRIVILEGES FOR ROLE {OWNER_ROLE} IN SCHEMA public
            GRANT USAGE, SELECT ON SEQUENCES TO {APP_ROLE};
        """
    )


def downgrade() -> None:
    # Révoque puis supprime le rôle si présent.
    op.execute(
        f"""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{APP_ROLE}') THEN
                ALTER DEFAULT PRIVILEGES FOR ROLE {OWNER_ROLE} IN SCHEMA public
                    REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM {APP_ROLE};
                ALTER DEFAULT PRIVILEGES FOR ROLE {OWNER_ROLE} IN SCHEMA public
                    REVOKE USAGE, SELECT ON SEQUENCES FROM {APP_ROLE};
                REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM {APP_ROLE};
                REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {APP_ROLE};
                REVOKE USAGE ON SCHEMA public FROM {APP_ROLE};
                DROP ROLE {APP_ROLE};
            END IF;
        END
        $$;
        """
    )
