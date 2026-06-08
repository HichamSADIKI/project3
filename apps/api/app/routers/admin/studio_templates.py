"""Gabarits de génération de code du Studio (Phase 3A — squelette réel).

**Fonctions PURES** (aucun I/O) → testables en process (pytest), sans worker. Le worker
`worker-studio` n'orchestre que git/subprocess ; tout le code *rendu* est produit ici, de
façon déterministe (aucun LLM). Le code généré est volontairement minimal mais **réel et
câblé** : un router authentifié + son test co-localisé + un CLAUDE.md. L'enrichissement
CRUD-depuis-schéma (table+RLS+migration+écran) est la Phase 3B.

Sentinelle `__SLUG__` remplacée par le slug du module (évite l'échappement des accolades
présentes dans le code rendu : dicts, f-strings).
"""

from __future__ import annotations

import re
from typing import Any, NamedTuple

_SLUG_RE = re.compile(r"^[a-z0-9_]+$")


def module_slug(key: str) -> str:
    """Slug identifiant-sûr dérivé du `key` du module (les points → underscores).

    `key` est déjà borné `^[a-z0-9_.]+$` (contrainte DB) → le slug est `^[a-z0-9_]+$`,
    valide comme nom de package Python, de préfixe de route et de branche. Lève si non conforme.
    """
    slug = (key or "").replace(".", "_")
    if not _SLUG_RE.match(slug):
        raise ValueError(f"invalid_module_key:{key!r}")
    return slug


_ROUTER_TMPL = '''"""Module __SLUG__ — généré par le Studio de Modules (squelette Phase 3A).

Endpoint minimal **authentifié** (tenant-scopé via get_company_id → 401 sans JWT).
Enrichissement CRUD (table + RLS + endpoints) = Phase 3B.
"""

from fastapi import APIRouter, Depends

from app.core.deps import get_company_id

router = APIRouter(prefix="/__SLUG__", tags=["__SLUG__"])


@router.get("/status")
async def __SLUG___status(company_id: str = Depends(get_company_id)) -> dict[str, str]:
    """État du module (nécessite un JWT valide)."""
    return {"module": "__SLUG__", "status": "ok"}
'''


_TEST_TMPL = '''"""Tests du module __SLUG__ (généré).

Frontière d'auth : 401 sans JWT, 200 authentifié. C'est l'invariant de sécurité
vérifié par le CHASSEUR pour un squelette (pas de donnée tenant en Phase 3A).
"""

import pytest
from httpx import AsyncClient

AUTH = "Authorization"
BASE = "/api/v1/__SLUG__"


@pytest.mark.asyncio
async def test___SLUG___status_requires_auth(client: AsyncClient) -> None:
    assert (await client.get(f"{BASE}/status")).status_code == 401


@pytest.mark.asyncio
async def test___SLUG___status_authed(client: AsyncClient, seed_admin) -> None:
    _admin, token = seed_admin
    resp = await client.get(f"{BASE}/status", headers={AUTH: f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["module"] == "__SLUG__"
'''


_INIT_TMPL = '"""Module __SLUG__ — généré par le Studio de Modules (Phase 3A)."""\n'


_CLAUDE_TMPL = """# Module `__SLUG__` (généré par le Studio de Modules)

Squelette Phase 3A : un endpoint authentifié `GET /api/v1/__SLUG__/status`.
Généré de façon déterministe (aucun LLM) puis testé + audité avant PR. Ne pas
modifier à la main sans répercuter sur le gabarit `studio_templates.py` si ce
module doit rester régénérable. Enrichissement CRUD = Phase 3B.
"""


def render_router(slug: str) -> str:
    return _ROUTER_TMPL.replace("__SLUG__", slug)


def render_test(slug: str) -> str:
    return _TEST_TMPL.replace("__SLUG__", slug)


def render_init(slug: str) -> str:
    return _INIT_TMPL.replace("__SLUG__", slug)


def render_claude_md(slug: str) -> str:
    return _CLAUDE_TMPL.replace("__SLUG__", slug)


def main_import_line(slug: str) -> str:
    """Ligne d'import à insérer dans main.py (sous l'ancre dédiée)."""
    return f"from app.routers.{slug}.router import router as {slug}_router"


def main_include_line(slug: str) -> str:
    """Ligne de montage à insérer dans main.py (sous l'ancre dédiée)."""
    return f'app.include_router({slug}_router, prefix="/api/v1")'


# ════════════════════════════════════════════════════════════════════════════
# Phase 3B — module CRUD tenant-scopé compilé depuis le SheetSchema
# Calqué 1:1 sur le module `developers`. Loi 1 baked-in : company_id+RLS+404 anti-BOLA.
# ════════════════════════════════════════════════════════════════════════════

# Noms réservés (fournis par id/mixins) → préfixe f_ si un champ entre en collision.
_RESERVED = frozenset({"id", "company_id", "created_at", "updated_at", "deleted_at"})

# type d'élément → (type ORM, type migration sa.*, type Python, défaut Python | None)
_TYPE_MAP: dict[str, tuple[str, str, str, str | None]] = {
    "text": ("String(300)", "sa.String(300)", "str", None),
    "textarea": ("Text", "sa.Text", "str", None),
    "number": ("Numeric(18, 2)", "sa.Numeric(18, 2)", "Decimal", None),
    "date": ("Date", "sa.Date", "date", None),
    "checkbox": ("Boolean", "sa.Boolean", "bool", "False"),
    "select": ("String(120)", "sa.String(120)", "str", None),
}


class ColumnSpec(NamedTuple):
    name: str
    orm_type: str
    mig_type: str
    py_type: str
    nullable: bool
    default: str | None


def _class_name(slug: str) -> str:
    return "".join(p.capitalize() for p in slug.split("_")) or "Module"


def column_specs(schema: dict[str, Any]) -> list[ColumnSpec]:
    """Mappe les éléments-champs (toutes feuilles aplaties) en colonnes. PUR.

    label/button ignorés ; `required`→`nullable=False` ; `checkbox`→Boolean default False ;
    collision avec un nom réservé → préfixe `f_` ; dédoublonnage par suffixe.
    """
    used: set[str] = set()
    cols: list[ColumnSpec] = []
    for sheet in schema.get("sheets", []):
        for el in sheet.get("elements", []):
            spec = _TYPE_MAP.get(el.get("type"))
            fid = el.get("id") or ""
            if spec is None or not fid:
                continue
            orm_type, mig_type, py_type, default = spec
            name = fid if fid not in _RESERVED else f"f_{fid}"
            base, i = name, 2
            while name in used:
                name, i = f"{base}_{i}", i + 1
            used.add(name)
            nullable = el.get("type") != "checkbox" and not bool(el.get("required"))
            cols.append(ColumnSpec(name, orm_type, mig_type, py_type, nullable, default))
    return cols


def compute_revision(existing_revisions: list[str], slug: str) -> tuple[str, str]:
    """(nouvelle révision, down_revision) à partir des stems de migrations existants. PUR.

    Migrations SGI linéaires (NNNN_*) → `down_revision` = la révision NNNN la plus haute.
    """
    numbered = sorted(
        (int(m.group(1)), r) for r in existing_revisions if (m := re.match(r"^(\d{4})_", r))
    )
    if not numbered:
        return f"0001_studio_gen_{slug}", ""
    max_n, head = numbered[-1]
    return f"{max_n + 1:04d}_studio_gen_{slug}", head


def _extra_py_imports(cols: list[ColumnSpec]) -> str:
    lines = []
    if any(c.py_type == "Decimal" for c in cols):
        lines.append("from decimal import Decimal")
    if any(c.py_type == "date" for c in cols):
        lines.append("from datetime import date")
    return ("\n".join(lines) + "\n") if lines else ""


_SAMPLE = {"str": '"x"', "Decimal": '"1.00"', "date": '"2026-01-01"', "bool": "True"}


# ── Templates à sentinelles (raw — pas d'échappement d'accolades) ──────────────

_MODEL_TMPL = '''"""Modèle __SLUG__ — généré par le Studio (Phase 3B). Tenant-scopé (Loi 1)."""

import uuid
__EXTRA__from sqlalchemy import __SATYPES__
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class __CLS__(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):
    """Entité générée. RLS via company_id (Loi 1) ; mixins → company_id/timestamps/deleted_at."""

    __tablename__ = "studio_gen___SLUG__"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
__COLS__
'''

_SCHEMAS_TMPL = '''"""Schemas __SLUG__ — généré (Phase 3B)."""

import uuid
from datetime import datetime
__EXTRA__from typing import Any

from pydantic import BaseModel


class __CLS__Create(BaseModel):
__CREATE__


class __CLS__Update(BaseModel):
__UPDATE__


class __CLS__Out(BaseModel):
    id: uuid.UUID
__OUT__
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class __CLS__ListOut(BaseModel):
    success: bool = True
    data: list[__CLS__Out]
    meta: dict[str, Any]


class __CLS__DetailOut(BaseModel):
    success: bool = True
    data: __CLS__Out
'''

_SERVICE_TMPL = '''"""Service __SLUG__ — généré (Phase 3B). Toujours filtré company_id (Loi 1)."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.routers.__SLUG__.models import __CLS__
from app.routers.__SLUG__.schemas import __CLS__Create, __CLS__Update


async def list___SLUG__(
    db: AsyncSession, company_id: uuid.UUID, page: int = 1, limit: int = 20
) -> tuple[list[__CLS__], int]:
    base = select(__CLS__).where(
        __CLS__.company_id == company_id, __CLS__.deleted_at.is_(None)
    )
    total: int = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar_one()
    stmt = base.order_by(__CLS__.created_at.desc()).offset((page - 1) * limit).limit(limit)
    rows = (await db.execute(stmt)).scalars().all()
    return list(rows), total


async def get___SLUG__(
    db: AsyncSession, company_id: uuid.UUID, item_id: uuid.UUID
) -> __CLS__ | None:
    return (
        await db.execute(
            select(__CLS__).where(
                __CLS__.id == item_id,
                __CLS__.company_id == company_id,
                __CLS__.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()


async def create___SLUG__(
    db: AsyncSession, company_id: uuid.UUID, data: __CLS__Create
) -> __CLS__:
    obj = __CLS__(company_id=company_id, **data.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def update___SLUG__(
    db: AsyncSession, company_id: uuid.UUID, item_id: uuid.UUID, data: __CLS__Update
) -> __CLS__ | None:
    obj = await get___SLUG__(db, company_id, item_id)
    if obj is None:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    await db.commit()
    await db.refresh(obj)
    return obj


async def delete___SLUG__(
    db: AsyncSession, company_id: uuid.UUID, item_id: uuid.UUID
) -> bool:
    obj = await get___SLUG__(db, company_id, item_id)
    if obj is None:
        return False
    from datetime import UTC, datetime

    obj.deleted_at = datetime.now(UTC)
    await db.commit()
    return True
'''

_ROUTER_CRUD_TMPL = '''"""Router __SLUG__ — généré (Phase 3B). Tenant-scopé : 404 anti-BOLA."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.core.route_deps import get_company_id, require_roles
from app.routers.__SLUG__.schemas import (
    __CLS__Create,
    __CLS__DetailOut,
    __CLS__ListOut,
    __CLS__Out,
    __CLS__Update,
)
from app.routers.__SLUG__ import service

router = APIRouter(prefix="/__SLUG__", tags=["__SLUG__"])


@router.get("/", response_model=__CLS__ListOut)
async def list_endpoint(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> __CLS__ListOut:
    company_id = await get_company_id(db)
    rows, total = await service.list___SLUG__(db, company_id, page, limit)
    return __CLS__ListOut(
        data=[__CLS__Out.model_validate(r) for r in rows],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/",
    response_model=__CLS__DetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def create_endpoint(
    body: __CLS__Create, db: AsyncSession = Depends(get_db_session)
) -> __CLS__DetailOut:
    company_id = await get_company_id(db)
    obj = await service.create___SLUG__(db, company_id, body)
    return __CLS__DetailOut(data=__CLS__Out.model_validate(obj))


@router.get("/{item_id}", response_model=__CLS__DetailOut)
async def get_endpoint(
    item_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)
) -> __CLS__DetailOut:
    company_id = await get_company_id(db)
    obj = await service.get___SLUG__(db, company_id, item_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="__SLUG___not_found")
    return __CLS__DetailOut(data=__CLS__Out.model_validate(obj))


@router.patch(
    "/{item_id}",
    response_model=__CLS__DetailOut,
    dependencies=[Depends(require_roles("admin", "manager"))],
)
async def update_endpoint(
    item_id: uuid.UUID, body: __CLS__Update, db: AsyncSession = Depends(get_db_session)
) -> __CLS__DetailOut:
    company_id = await get_company_id(db)
    obj = await service.update___SLUG__(db, company_id, item_id, body)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="__SLUG___not_found")
    return __CLS__DetailOut(data=__CLS__Out.model_validate(obj))


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("admin"))],
)
async def delete_endpoint(
    item_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)
) -> None:
    company_id = await get_company_id(db)
    if not await service.delete___SLUG__(db, company_id, item_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="__SLUG___not_found")
'''

_CRUD_TEST_TMPL = '''"""Tests __SLUG__ (généré) — CRUD + Red-Team cross-tenant (Loi 1)."""

import pytest
from httpx import AsyncClient

AUTH = "Authorization"
BASE = "/api/v1/__SLUG__"
PAYLOAD = __PAYLOAD__


@pytest.mark.asyncio
async def test___SLUG___crud(client: AsyncClient, seed_admin) -> None:
    _admin, token = seed_admin
    h = {AUTH: f"Bearer {token}"}
    created = await client.post(f"{BASE}/", json=PAYLOAD, headers=h)
    assert created.status_code == 201
    item_id = created.json()["data"]["id"]
    got = await client.get(f"{BASE}/{item_id}", headers=h)
    assert got.status_code == 200
    listed = await client.get(f"{BASE}/", headers=h)
    assert any(r["id"] == item_id for r in listed.json()["data"])


@pytest.mark.asyncio
async def test___SLUG___requires_auth(client: AsyncClient) -> None:
    assert (await client.get(f"{BASE}/")).status_code == 401


@pytest.mark.asyncio
async def test___SLUG___tenant_isolation(client: AsyncClient, seed_admin, second_admin) -> None:
    """Loi 1 : ce que crée le tenant 1 est invisible/inaccessible au tenant 2 (404 anti-BOLA)."""
    _admin, token = seed_admin
    _company2, token2 = second_admin
    created = await client.post(f"{BASE}/", json=PAYLOAD, headers={AUTH: f"Bearer {token}"})
    item_id = created.json()["data"]["id"]

    other = await client.get(f"{BASE}/", headers={AUTH: f"Bearer {token2}"})
    assert all(r["id"] != item_id for r in other.json()["data"])
    direct = await client.get(f"{BASE}/{item_id}", headers={AUTH: f"Bearer {token2}"})
    assert direct.status_code == 404
'''

_MIGRATION_TMPL = '''"""__SLUG__ — table générée par le Studio (Phase 3B). RLS Loi 1."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "__REV__"
down_revision = "__DOWN__"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "studio_gen___SLUG__",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
__MIGCOLS__
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_studio_gen___SLUG___company", "studio_gen___SLUG__", ["company_id"])
    op.execute("ALTER TABLE studio_gen___SLUG__ ENABLE ROW LEVEL SECURITY;")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON studio_gen___SLUG__
        USING (company_id = current_setting('app.current_company_id')::UUID);
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON studio_gen___SLUG__;")
    op.drop_index("idx_studio_gen___SLUG___company", table_name="studio_gen___SLUG__")
    op.drop_table("studio_gen___SLUG__")
'''


def _fill(tmpl: str, slug: str, **extra: str) -> str:
    out = tmpl.replace("__CLS__", _class_name(slug)).replace("__SLUG__", slug)
    for key, val in extra.items():
        out = out.replace(f"__{key}__", val)
    return out


def render_model(slug: str, cols: list[ColumnSpec]) -> str:
    sa_types = ", ".join(sorted({c.orm_type.split("(")[0] for c in cols})) or "String"
    lines = []
    for c in cols:
        opt = " | None" if c.nullable else ""
        args = f"{c.orm_type}, nullable={c.nullable}"
        if c.default is not None:
            args += f", default={c.default}"
        lines.append(f"    {c.name}: Mapped[{c.py_type}{opt}] = mapped_column({args})")
    return _fill(
        _MODEL_TMPL, slug, EXTRA=_extra_py_imports(cols), SATYPES=sa_types, COLS="\n".join(lines)
    )


def render_schemas(slug: str, cols: list[ColumnSpec]) -> str:
    create, update, out = [], [], []
    for c in cols:
        if c.default is not None:
            create.append(f"    {c.name}: {c.py_type} = {c.default}")
        elif c.nullable:
            create.append(f"    {c.name}: {c.py_type} | None = None")
        else:
            create.append(f"    {c.name}: {c.py_type}")
        update.append(f"    {c.name}: {c.py_type} | None = None")
        out.append(f"    {c.name}: {c.py_type}{' | None' if c.nullable else ''}")
    return _fill(
        _SCHEMAS_TMPL,
        slug,
        EXTRA=_extra_py_imports(cols),
        CREATE="\n".join(create) or "    pass",
        UPDATE="\n".join(update) or "    pass",
        OUT="\n".join(out),
    )


def render_service(slug: str, cols: list[ColumnSpec]) -> str:
    return _fill(_SERVICE_TMPL, slug)


def render_router_crud(slug: str) -> str:
    return _fill(_ROUTER_CRUD_TMPL, slug)


def render_crud_test(slug: str, cols: list[ColumnSpec]) -> str:
    payload = "{" + ", ".join(f'"{c.name}": {_SAMPLE[c.py_type]}' for c in cols) + "}"
    return _fill(_CRUD_TEST_TMPL, slug, PAYLOAD=payload)


def render_migration(slug: str, cols: list[ColumnSpec], new_rev: str, down_rev: str) -> str:
    defs = []
    for c in cols:
        args = f'"{c.name}", {c.mig_type}, nullable={c.nullable}'
        if c.default == "False":
            args += ', server_default=sa.text("false")'
        defs.append(f"        sa.Column({args}),")
    body = _fill(_MIGRATION_TMPL, slug, MIGCOLS="\n".join(defs))
    return body.replace("__REV__", new_rev).replace("__DOWN__", down_rev)


def crud_files(slug: str, schema: dict[str, Any]) -> dict[str, str]:
    """Fichiers de code (hors migration) d'un module CRUD compilé depuis le schéma."""
    cols = column_specs(schema)
    base = f"apps/api/app/routers/{slug}"
    return {
        f"{base}/__init__.py": render_init(slug),
        f"{base}/models.py": render_model(slug, cols),
        f"{base}/schemas.py": render_schemas(slug, cols),
        f"{base}/service.py": render_service(slug, cols),
        f"{base}/router.py": render_router_crud(slug),
        f"{base}/test_{slug}.py": render_crud_test(slug, cols),
        f"{base}/CLAUDE.md": render_claude_md(slug),
    }


def generated_files(slug: str, schema: dict[str, Any] | None = None) -> dict[str, str]:
    """Chemins (depuis la racine du dépôt) → contenu du module généré.

    Avec `schema` → module CRUD complet (Phase 3B). Sans → squelette (Phase 3A, repli).
    La migration (CRUD) est ajoutée par l'orchestrateur (numéro calculé au runtime).
    """
    if schema is not None:
        return crud_files(slug, schema)
    base = f"apps/api/app/routers/{slug}"
    return {
        f"{base}/__init__.py": render_init(slug),
        f"{base}/router.py": render_router(slug),
        f"{base}/test_{slug}.py": render_test(slug),
        f"{base}/CLAUDE.md": render_claude_md(slug),
    }
