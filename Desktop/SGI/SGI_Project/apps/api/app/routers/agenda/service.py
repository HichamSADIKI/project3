"""Service Agenda (Real Estate) — helpers purs, testables sans DB.

L'agenda est un embed Google Calendar : aucune table, juste de la config
serveur (source du calendrier + fuseau). Voir aussi le frontend
`realestate-agenda` qui consomme la même source via env publique.
"""
from __future__ import annotations

from urllib.parse import quote

# Langues UI supportées (AR primaire, EN, FR) — paramètre `hl` de l'embed.
SUPPORTED_LANGS = ("ar", "en", "fr")
DEFAULT_LANG = "ar"


def is_configured(src: str | None) -> bool:
    """True si une source de calendrier non vide est configurée."""
    return bool(src and src.strip())


def normalize_lang(lang: str | None) -> str:
    """Replie toute langue inconnue sur la langue par défaut (AR)."""
    if lang and lang.lower() in SUPPORTED_LANGS:
        return lang.lower()
    return DEFAULT_LANG


def build_embed_url(
    src: str | None,
    *,
    timezone: str = "Asia/Dubai",
    lang: str = DEFAULT_LANG,
) -> str | None:
    """Construit l'URL d'embed Google Calendar.

    Renvoie None si aucune source n'est configurée. Tous les paramètres sont
    URL-encodés (la source est souvent un email `…@group.calendar.google.com`).
    """
    if not is_configured(src):
        return None
    assert src is not None  # garanti par is_configured
    params = (
        f"src={quote(src.strip(), safe='')}"
        f"&ctz={quote(timezone, safe='')}"
        f"&hl={normalize_lang(lang)}"
    )
    return f"https://calendar.google.com/calendar/embed?{params}"
