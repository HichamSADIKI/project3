"""Tests Agenda (Real Estate) — helpers purs (sans DB)."""
from __future__ import annotations

import pytest

from app.routers.agenda.service import (
    DEFAULT_LANG,
    build_embed_url,
    is_configured,
    normalize_lang,
)

CAL = "equipe@group.calendar.google.com"


# ── is_configured ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("src", [None, "", "   "])
def test_is_configured_false(src: str | None) -> None:
    assert is_configured(src) is False


def test_is_configured_true() -> None:
    assert is_configured(CAL) is True


# ── normalize_lang ─────────────────────────────────────────────────────────

@pytest.mark.parametrize("lang", ["ar", "en", "fr", "AR", "Fr"])
def test_normalize_lang_supported(lang: str) -> None:
    assert normalize_lang(lang) == lang.lower()


@pytest.mark.parametrize("lang", [None, "", "de", "zz"])
def test_normalize_lang_fallback(lang: str | None) -> None:
    assert normalize_lang(lang) == DEFAULT_LANG  # AR primaire


# ── build_embed_url ────────────────────────────────────────────────────────

def test_build_embed_url_none_when_unconfigured() -> None:
    assert build_embed_url(None) is None
    assert build_embed_url("") is None


def test_build_embed_url_encodes_source_and_tz() -> None:
    url = build_embed_url(CAL, timezone="Asia/Dubai", lang="fr")
    assert url is not None
    # @ et / encodés (pas de fuite de caractères non échappés dans la query).
    assert "src=equipe%40group.calendar.google.com" in url
    assert "ctz=Asia%2FDubai" in url
    assert "hl=fr" in url
    assert url.startswith("https://calendar.google.com/calendar/embed?")


def test_build_embed_url_unknown_lang_falls_back() -> None:
    url = build_embed_url(CAL, lang="de")
    assert url is not None
    assert "hl=ar" in url  # langue inconnue → AR


def test_build_embed_url_default_timezone_dubai() -> None:
    url = build_embed_url(CAL)
    assert url is not None
    assert "ctz=Asia%2FDubai" in url
