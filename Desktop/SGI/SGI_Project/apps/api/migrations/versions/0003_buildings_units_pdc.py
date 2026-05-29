"""Hiérarchie Building/Floor/Unit + PDC (chèques post-datés UAE).

Revision ID: 0003_buildings_units_pdc
Revises: 0002_party_roles
Create Date: 2026-05-28

Tables ajoutées (purement additives, aucune table existante modifiée) :
- buildings    — actif physique + PostGIS (Loi 2)
- floors       — niveau intermédiaire optionnel
- units        — atome locatif/vendable, lien optionnel vers properties legacy
- pdc_cheques  — chèques post-datés first-class UAE

Lois appliquées :
- Loi 1 : company_id + index + RLS sur les 4 tables
- Loi 2 : buildings.location GEOMETRY(POINT,4326) + index GIST
- Soft delete sur buildings, units, pdc_cheques (pas sur floors — suit le bâtiment)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
from geoalchemy2 import Geometry

revision = "0003_buildings_units_pdc"
down_revision = "0002_party_roles"
branch_labels = None
depends_on = None


_TABLES_WITH_TRIGGER = ("buildings", "floors", "units", "pdc_cheques")


def _enable_rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (company_id = current_setting('app.current_company_id')::UUID)
        """
    )


def upgrade() -> None:
    # ── buildings ─────────────────────────────────────────────────────────
    op.create_table(
        "buildings",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("reference", sa.String(50), nullable=False),
        sa.Column(
            "owner_party_id",
            UUID(as_uuid=True),
            sa.ForeignKey("owners.party_id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("name_ar", sa.String(300), nullable=True),
        sa.Column("name_en", sa.String(300), nullable=True),
        sa.Column("name_fr", sa.String(300), nullable=True),
        sa.Column("building_type", sa.String(30), nullable=False),
        sa.Column("location", Geometry("POINT", srid=4326), nullable=True),
        sa.Column("footprint", Geometry("POLYGON", srid=4326), nullable=True),
        sa.Column("address_en", sa.String(300), nullable=True),
        sa.Column("address_ar", sa.String(300), nullable=True),
        sa.Column("district", sa.String(150), nullable=True),
        sa.Column("emirate", sa.String(3), nullable=False, server_default="DXB"),
        sa.Column("total_floors", sa.Integer(), nullable=True),
        sa.Column("total_units", sa.Integer(), nullable=True),
        sa.Column("year_built", sa.Integer(), nullable=True),
        sa.Column("developer", sa.String(200), nullable=True),
        sa.Column(
            "status", sa.String(30), nullable=False, server_default="operational"
        ),
        sa.Column("dld_property_number", sa.String(100), nullable=True),
        sa.Column("dld_tenure", sa.String(20), nullable=True),
        sa.Column("insurance_policy_number", sa.String(100), nullable=True),
        sa.Column("insurance_expiry", sa.Date(), nullable=True),
        sa.Column("amenities", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("images", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("documents", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("estimated_value_aed", sa.DECIMAL(15, 2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "has_active_security_contract",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column(
            "has_active_cleaning_contract",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "building_type IN ('residential_tower','villa_compound','mixed_use',"
            "'commercial','warehouse')",
            name="ck_buildings_type",
        ),
        sa.CheckConstraint(
            "status IN ('operational','under_renovation','off_market','demolished')",
            name="ck_buildings_status",
        ),
        sa.CheckConstraint(
            "dld_tenure IS NULL OR dld_tenure IN ('freehold','leasehold')",
            name="ck_buildings_tenure",
        ),
    )
    op.create_index("idx_buildings_company", "buildings", ["company_id"])
    op.create_index("idx_buildings_owner", "buildings", ["owner_party_id"])
    op.create_index("idx_buildings_emirate", "buildings", ["emirate"])
    # Loi 2 — index GIST PostGIS
    op.execute(
        "CREATE INDEX idx_buildings_location_gist ON buildings USING GIST (location)"
    )
    op.create_unique_constraint(
        "uq_buildings_reference_company", "buildings", ["company_id", "reference"]
    )
    _enable_rls("buildings")

    # ── floors ────────────────────────────────────────────────────────────
    op.create_table(
        "floors",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "building_id",
            UUID(as_uuid=True),
            sa.ForeignKey("buildings.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("floor_number", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(50), nullable=True),
        sa.Column("planned_units", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("idx_floors_company", "floors", ["company_id"])
    op.create_index("idx_floors_building", "floors", ["building_id"])
    op.create_unique_constraint(
        "uq_floors_building_number", "floors", ["building_id", "floor_number"]
    )
    _enable_rls("floors")

    # ── units ─────────────────────────────────────────────────────────────
    op.create_table(
        "units",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "building_id",
            UUID(as_uuid=True),
            sa.ForeignKey("buildings.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "floor_id",
            UUID(as_uuid=True),
            sa.ForeignKey("floors.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("unit_number", sa.String(50), nullable=False),
        sa.Column("unit_type", sa.String(30), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="vacant"),
        sa.Column("area_sqm", sa.DECIMAL(10, 2), nullable=True),
        sa.Column("bedrooms", sa.Integer(), nullable=True),
        sa.Column("bathrooms", sa.Integer(), nullable=True),
        sa.Column(
            "parking_spaces", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column("furnished", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("list_rent_aed", sa.DECIMAL(15, 2), nullable=True),
        sa.Column("list_sale_aed", sa.DECIMAL(15, 2), nullable=True),
        sa.Column(
            "legacy_property_id",
            UUID(as_uuid=True),
            sa.ForeignKey("properties.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("ejari_number", sa.String(50), nullable=True),
        sa.Column("dewa_account_number", sa.String(50), nullable=True),
        sa.Column("addc_account_number", sa.String(50), nullable=True),
        sa.Column("inventory", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("images", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column(
            "floor_plan_paths", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('vacant','occupied','reserved','maintenance','renovation','off_market')",
            name="ck_units_status",
        ),
    )
    op.create_index("idx_units_company", "units", ["company_id"])
    op.create_index("idx_units_building", "units", ["building_id"])
    op.create_index("idx_units_floor", "units", ["floor_id"])
    op.create_index("idx_units_status", "units", ["status"])
    op.create_index("idx_units_type", "units", ["unit_type"])
    op.create_unique_constraint(
        "uq_units_building_number", "units", ["building_id", "unit_number"]
    )
    _enable_rls("units")

    # ── pdc_cheques ───────────────────────────────────────────────────────
    op.create_table(
        "pdc_cheques",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("reference", sa.String(50), nullable=False),
        sa.Column(
            "rental_id",
            UUID(as_uuid=True),
            sa.ForeignKey("rentals.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column(
            "contract_id",
            UUID(as_uuid=True),
            sa.ForeignKey("contracts.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column(
            "drawer_party_id",
            UUID(as_uuid=True),
            sa.ForeignKey("clients.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("cheque_number", sa.String(50), nullable=False),
        sa.Column("bank_name", sa.String(150), nullable=False),
        sa.Column("bank_branch", sa.String(150), nullable=True),
        sa.Column("account_holder_name", sa.String(255), nullable=False),
        sa.Column("amount_aed", sa.DECIMAL(15, 2), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("deposit_date", sa.Date(), nullable=True),
        sa.Column("cleared_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("bounced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("bounce_reason", sa.String(150), nullable=True),
        sa.Column(
            "bounce_fee_aed", sa.DECIMAL(15, 2), nullable=False, server_default="0"
        ),
        sa.Column(
            "replaced_by_pdc_id",
            UUID(as_uuid=True),
            sa.ForeignKey("pdc_cheques.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("document_path", sa.String(500), nullable=True),
        sa.Column("ocr_data", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("ocr_confidence", sa.DECIMAL(5, 2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "legal_notices_sent",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('pending','deposited','cleared','bounced','replaced','cancelled')",
            name="ck_pdc_status",
        ),
        # Exactement un des deux liens transactionnels doit être renseigné
        sa.CheckConstraint(
            "(rental_id IS NOT NULL)::int + (contract_id IS NOT NULL)::int = 1",
            name="ck_pdc_exactly_one_link",
        ),
        sa.CheckConstraint("amount_aed > 0", name="ck_pdc_amount_positive"),
    )
    op.create_index("idx_pdc_company", "pdc_cheques", ["company_id"])
    op.create_index("idx_pdc_status", "pdc_cheques", ["status"])
    op.create_index("idx_pdc_due_date", "pdc_cheques", ["due_date"])
    op.create_index("idx_pdc_drawer", "pdc_cheques", ["drawer_party_id"])
    op.create_index("idx_pdc_rental", "pdc_cheques", ["rental_id"])
    op.create_index("idx_pdc_contract", "pdc_cheques", ["contract_id"])
    op.create_unique_constraint(
        "uq_pdc_reference_company", "pdc_cheques", ["company_id", "reference"]
    )
    _enable_rls("pdc_cheques")

    # Trigger updated_at (réutilise la fonction de la migration 0001)
    for tbl in _TABLES_WITH_TRIGGER:
        op.execute(
            f"""
            CREATE TRIGGER set_updated_at
            BEFORE UPDATE ON {tbl}
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
            """
        )


def downgrade() -> None:
    for tbl in _TABLES_WITH_TRIGGER:
        op.execute(f"DROP TRIGGER IF EXISTS set_updated_at ON {tbl}")

    op.drop_table("pdc_cheques")
    op.drop_table("units")
    op.drop_table("floors")
    op.drop_table("buildings")
