"""Garde PDPL — source unique du denylist de champs sensibles.

Aucune donnée personnelle sensible (Emirates ID, IBAN, chèques post-datés,
passeport, etc.) ne doit quitter la plateforme vers un LLM tiers (Gemini).
Tout dict sérialisé dans un prompt passe par `pdpl_safe`. Mutualisé entre les
modules (clients, vendors…) pour éviter toute dérive du denylist.
"""

from typing import Any

# Clés interdites de transmission à un LLM tiers (insensible à la casse).
PDPL_SENSITIVE_KEYS = frozenset(
    {
        "emirates_id",
        "emiratesid",
        "eid",
        "iban",
        "pdc",
        "passport",
        "passport_number",
        "national_id",
        "account_number",
        "card_number",
        "cvv",
        "tax_id",
    }
)


def pdpl_safe(data: dict[str, Any]) -> dict[str, Any]:
    """Retire les clés sensibles (PDPL) d'un dict avant envoi à Gemini."""
    return {k: v for k, v in data.items() if str(k).lower() not in PDPL_SENSITIVE_KEYS}
