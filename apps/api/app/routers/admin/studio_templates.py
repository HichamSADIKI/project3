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


def generated_files(slug: str) -> dict[str, str]:
    """Chemins (depuis la racine du dépôt) → contenu, pour le module généré."""
    base = f"apps/api/app/routers/{slug}"
    return {
        f"{base}/__init__.py": render_init(slug),
        f"{base}/router.py": render_router(slug),
        f"{base}/test_{slug}.py": render_test(slug),
        f"{base}/CLAUDE.md": render_claude_md(slug),
    }
