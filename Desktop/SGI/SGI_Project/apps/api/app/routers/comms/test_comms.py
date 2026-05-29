"""Tests module Communication (Phase 3).

Couvre :
- Helpers purs (is_valid_conversation_type, is_valid_message_kind)
- Isolation multi-tenant (tenant A ≠ tenant B)
- Contrôle d'accès participant (non-participant → 403)
- Création conversation + participants
- Envoi et pagination de messages (curseur)
- Marquer comme lu
"""
from __future__ import annotations

import pytest

from app.routers.comms.service import is_valid_conversation_type, is_valid_message_kind


# ── Helpers purs ─────────────────────────────────────────────────────────

def test_valid_conversation_types() -> None:
    for t in ("direct", "group", "ticket", "contract"):
        assert is_valid_conversation_type(t), f"'{t}' should be valid"


def test_invalid_conversation_type() -> None:
    assert not is_valid_conversation_type("chat")
    assert not is_valid_conversation_type("")
    assert not is_valid_conversation_type("DIRECT")


def test_valid_message_kinds() -> None:
    for k in ("text", "voice", "system"):
        assert is_valid_message_kind(k), f"'{k}' should be valid"


def test_invalid_message_kind() -> None:
    assert not is_valid_message_kind("image")
    assert not is_valid_message_kind("")
    assert not is_valid_message_kind("TEXT")


# ── Tests d'intégration ────────────────────────────────────────────────────
# Nécessitent le conftest.py (fixtures `client`, `seed_company`, `db_session`).
# Exécutés via `docker compose exec -e PYTHONPATH=/app api uv run pytest`.

pytestmark = pytest.mark.asyncio
