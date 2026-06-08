"""Tests PURS des gabarits CRUD du Studio (Phase 3B) — sans worker ni DB.

Couvre : mapping des colonnes (type→colonne, required→nullable, réservés→f_, label/button
ignorés), `compute_revision`, et la conformité du code généré (tous les `.py` **compilent**
via `ast.parse` ; la migration contient les 3 ordres RLS + l'index company ; le test généré
embarque le Red-Team cross-tenant `tenant_isolation` + assert 404 ; le service filtre `company_id`).
"""

import ast

import pytest

from app.routers.admin.studio_templates import (
    column_specs,
    compute_revision,
    crud_files,
    render_migration,
    render_model,
    render_service,
)

SCHEMA = {
    "schema_version": 1,
    "sheets": [
        {
            "id": "main",
            "title_ar": "ر",
            "title_en": "Main",
            "title_fr": "Principale",
            "elements": [
                {
                    "id": "name",
                    "type": "text",
                    "label_ar": "ا",
                    "label_en": "N",
                    "label_fr": "N",
                    "required": True,
                },
                {
                    "id": "amount",
                    "type": "number",
                    "label_ar": "ا",
                    "label_en": "A",
                    "label_fr": "M",
                },
                {
                    "id": "active",
                    "type": "checkbox",
                    "label_ar": "ا",
                    "label_en": "Ac",
                    "label_fr": "Ac",
                },
                {"id": "due", "type": "date", "label_ar": "ا", "label_en": "D", "label_fr": "D"},
                {
                    "id": "kind",
                    "type": "select",
                    "label_ar": "ا",
                    "label_en": "K",
                    "label_fr": "K",
                    "options": [],
                },
                {
                    "id": "note",
                    "type": "textarea",
                    "label_ar": "ا",
                    "label_en": "No",
                    "label_fr": "No",
                },
                {
                    "id": "id",
                    "type": "text",
                    "label_ar": "ا",
                    "label_en": "I",
                    "label_fr": "I",
                },  # réservé → f_id
                {
                    "id": "go",
                    "type": "button",
                    "label_ar": "ا",
                    "label_en": "Go",
                    "label_fr": "Go",
                    "action": "submit",
                },
                {"id": "hdr", "type": "label", "label_ar": "ا", "label_en": "H", "label_fr": "H"},
            ],
        }
    ],
}


def test_column_specs_mapping() -> None:
    cols = {c.name: c for c in column_specs(SCHEMA)}
    # label & button ignorés ; id réservé → f_id.
    assert set(cols) == {"name", "amount", "active", "due", "kind", "note", "f_id"}
    assert cols["name"].orm_type == "String(300)" and cols["name"].nullable is False  # required
    assert cols["amount"].py_type == "Decimal" and cols["amount"].nullable is True
    assert cols["active"].orm_type == "Boolean" and cols["active"].nullable is False
    assert cols["active"].default == "False"
    assert cols["due"].py_type == "date"
    assert cols["kind"].orm_type == "String(120)"
    assert cols["note"].orm_type == "Text"


def test_compute_revision() -> None:
    assert compute_revision(["0066_studio_modules", "0067_studio_orchestrator_jobs"], "foo") == (
        "0068_studio_gen_foo",
        "0067_studio_orchestrator_jobs",
    )
    assert compute_revision([], "foo") == ("0001_studio_gen_foo", "")


def test_generated_crud_python_compiles() -> None:
    """Tous les fichiers .py générés sont syntaxiquement valides."""
    for path, content in crud_files("studio_demo", SCHEMA).items():
        if path.endswith(".py"):
            ast.parse(content)


def test_generated_migration_has_rls() -> None:
    cols = column_specs(SCHEMA)
    mig = render_migration("studio_demo", cols, "0068_studio_gen_studio_demo", "0067_x")
    ast.parse(mig)  # compile
    assert "ENABLE ROW LEVEL SECURITY" in mig
    assert "CREATE POLICY tenant_isolation" in mig
    assert "current_setting('app.current_company_id')::UUID" in mig
    assert "idx_studio_gen_studio_demo_company" in mig
    assert 'revision = "0068_studio_gen_studio_demo"' in mig
    assert 'down_revision = "0067_x"' in mig
    # checkbox → server_default false
    assert 'server_default=sa.text("false")' in mig


def test_generated_test_has_redteam() -> None:
    test_src = crud_files("studio_demo", SCHEMA)[
        "apps/api/app/routers/studio_demo/test_studio_demo.py"
    ]
    assert "test_studio_demo_tenant_isolation" in test_src
    assert "second_admin" in test_src
    assert "== 404" in test_src  # 404 anti-BOLA cross-tenant


def test_generated_service_filters_company_id() -> None:
    svc = render_service("studio_demo", column_specs(SCHEMA))
    assert "company_id ==" in svc
    assert "deleted_at.is_(None)" in svc


@pytest.mark.parametrize("schema", [{"schema_version": 1, "sheets": []}])
def test_column_specs_empty(schema: dict) -> None:
    assert column_specs(schema) == []


# ── 3B+ B2 : CHECK des `select` (intégrité des valeurs) ─────────────────────────


def _select_schema(*values: str) -> dict:
    return {
        "schema_version": 1,
        "sheets": [
            {
                "id": "main",
                "title_ar": "a",
                "title_en": "M",
                "title_fr": "M",
                "elements": [
                    {
                        "id": "kind",
                        "type": "select",
                        "label_ar": "a",
                        "label_en": "K",
                        "label_fr": "K",
                        "options": [
                            {"value": v, "label_ar": "a", "label_en": v, "label_fr": v}
                            for v in values
                        ],
                    }
                ],
            }
        ],
    }


def test_select_check_values_captured() -> None:
    cols = {c.name: c for c in column_specs(_select_schema("new", "old"))}
    assert cols["kind"].check_values == ("new", "old")


def test_select_check_in_model_and_migration() -> None:
    cols = column_specs(_select_schema("new", "old"))
    model = render_model("studio_demo", cols)
    ast.parse(model)
    assert "CheckConstraint" in model
    assert "kind IN ('new', 'old')" in model
    mig = render_migration("studio_demo", cols, "0068_x", "0067_y")
    ast.parse(mig)
    assert "sa.CheckConstraint" in mig
    assert "kind IN ('new', 'old')" in mig


def test_select_unsafe_value_skips_check() -> None:
    """Une valeur d'option hors charset sûr → pas de CHECK (anti-injection SQL)."""
    cols = {c.name: c for c in column_specs(_select_schema("ok", "a'); DROP TABLE x;--"))}
    assert cols["kind"].check_values == ()
    assert "CheckConstraint" not in render_model("studio_demo", list(cols.values()))
