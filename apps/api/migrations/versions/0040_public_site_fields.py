"""Vitrine publique — champs slug / featured / urgent sur les annonces.

Revision ID: 0038_public_site_fields
Revises: 0037_source_imports
Create Date: 2026-06-03

Ajoute aux annonces publiables (sale_listings ET rental_listings) les champs
nécessaires à la vitrine publique mono-agence :
- slug VARCHAR(255)        : identifiant URL stable, unique par tenant.
- is_featured BOOL         : mise en avant (section « À la une »).
- is_urgent BOOL           : badge « Urgent » (déstockage / bonne affaire).

Aucune NOUVELLE table — on réutilise les modèles SaleListing / RentalListing
existants. Index :
- UNIQUE PARTIEL (company_id, slug) WHERE slug IS NOT NULL → un slug ne collisionne
  que dans son tenant ; les lignes sans slug ne bloquent pas l'unicité.
- (company_id, status, is_featured) → sert le filtre vitrine « published + featured ».

Backfill : slug = slugify(title_en|title_ar|reference) + '-' + 6 derniers car. de
l'id (suffixe stable, garantit l'unicité même si deux titres coïncident).
"""

import re

import sqlalchemy as sa
from alembic import op

revision = "0040_public_site_fields"
down_revision = "0039_source_imports"
branch_labels = None
depends_on = None

_LISTING_TABLES = ("sale_listings", "rental_listings")


def _slugify(value: str) -> str:
    """Kebab-case ASCII (translittération basique). Doit rester aligné sur
    `public_site.service.slugify` (même logique, dupliquée ici car les migrations
    ne doivent pas importer le code applicatif)."""
    text = (value or "").strip().lower()
    # Translittération basique des diacritiques latins courants.
    replacements = {
        "à": "a", "â": "a", "ä": "a", "á": "a", "ã": "a", "å": "a",
        "ç": "c",
        "è": "e", "é": "e", "ê": "e", "ë": "e",
        "ì": "i", "í": "i", "î": "i", "ï": "i",
        "ñ": "n",
        "ò": "o", "ó": "o", "ô": "o", "ö": "o", "õ": "o",
        "ù": "u", "ú": "u", "û": "u", "ü": "u",
        "ý": "y", "ÿ": "y",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-{2,}", "-", text).strip("-")
    return text


def _add_columns(table: str) -> None:
    op.add_column(table, sa.Column("slug", sa.String(255), nullable=True))
    op.add_column(
        table,
        sa.Column("is_featured", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        table,
        sa.Column("is_urgent", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def _backfill_slugs(table: str) -> None:
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            f"SELECT id, title_en, title_ar, reference FROM {table} WHERE slug IS NULL"
        )
    ).fetchall()
    for row in rows:
        rid = str(row[0])
        base = row[1] or row[2] or row[3] or "listing"
        slug = _slugify(base) or "listing"
        slug = f"{slug}-{rid.replace('-', '')[-6:]}"
        conn.execute(
            sa.text(f"UPDATE {table} SET slug = :slug WHERE id = :id"),
            {"slug": slug, "id": rid},
        )


def upgrade() -> None:
    for table in _LISTING_TABLES:
        _add_columns(table)
        _backfill_slugs(table)
        # Unicité du slug par tenant (partiel : ignore les lignes sans slug).
        op.create_index(
            f"uq_{table}_company_slug",
            table,
            ["company_id", "slug"],
            unique=True,
            postgresql_where=sa.text("slug IS NOT NULL"),
        )
        # Sert le filtre vitrine : published + featured d'un tenant.
        op.create_index(
            f"idx_{table}_company_status_featured",
            table,
            ["company_id", "status", "is_featured"],
        )


def downgrade() -> None:
    for table in _LISTING_TABLES:
        op.drop_index(f"idx_{table}_company_status_featured", table_name=table)
        op.drop_index(f"uq_{table}_company_slug", table_name=table)
        op.drop_column(table, "is_urgent")
        op.drop_column(table, "is_featured")
        op.drop_column(table, "slug")
