"""Génération IA d'un `SheetSchema` (Phase 1B — mode « automatique par IA »).

Transforme une description en langage naturel en **schéma de feuille déclaratif**
(`SheetSchema`), via Gemini (`app.core.gemini.generate_text`) — best-effort, avec
**repli heuristique déterministe** si la clé Gemini est absente, si l'API échoue, ou
si la sortie n'est pas un `SheetSchema` valide. La sortie IA est TOUJOURS revalidée
contre `SheetSchema` (Pydantic strict) avant d'être renvoyée/stockée : un schéma mal
formé (ou une injection de champ) est rejeté → repli. Aucune exécution de code.

Pur côté repli (`fallback_schema`) → testable sans réseau.
"""

from __future__ import annotations

import json
import logging

from app.core import gemini
from app.routers.admin.studio_schema import (
    Element,
    Sheet,
    SheetSchema,
)

logger = logging.getLogger(__name__)

# Engine renvoyé quand on a dû se replier (pas d'IA / sortie invalide).
FALLBACK_ENGINE = "fallback_heuristic"

_SYSTEM_PROMPT = """You design declarative admin form screens for an internal tool.

Given a short description, return a STRICT JSON object (no markdown, no prose)
with EXACTLY this shape:

{
  "schema_version": 1,
  "sheets": [
    {
      "id": "<lowercase slug a-z0-9_>",
      "title_ar": "<Arabic title>",
      "title_en": "<English title>",
      "title_fr": "<French title>",
      "elements": [
        {
          "id": "<lowercase slug a-z0-9_>",
          "type": one of ["text","textarea","number","select","checkbox","date","label","button"],
          "label_ar": "<Arabic>", "label_en": "<English>", "label_fr": "<French>",
          "placeholder": "<optional>" or null,
          "required": true|false,
          "options": [ {"value":"v","label_ar":"..","label_en":"..","label_fr":".."} ],
              // 'options' ONLY for type=select (else []);
          "action": one of ["submit","reset","navigate"] or null
              // 'action' ONLY for type=button (else null)
        }
      ]
    }
  ]
}

Rules:
- Output VALID JSON ONLY. No extra keys anywhere.
- 1 to 3 sheets, each with 1 to 12 elements. End forms with a button (action="submit").
- Slugs are lowercase a-z0-9_ only. Provide all three languages (ar/en/fr) for every label."""


def _placeholder_titles(prompt: str) -> tuple[str, str, str]:
    """Titres (ar/en/fr) dérivés du prompt (repli). Bornés, jamais vides."""
    base = (prompt or "").strip().replace("\n", " ")[:60] or "Module"
    return ("نموذج", base, base)


def fallback_schema(prompt: str) -> SheetSchema:
    """Schéma minimal mais VALIDE construit sans IA (repli déterministe, pur).

    Un écran « principal » avec un champ titre, une description et un bouton d'envoi.
    Toujours conforme à `SheetSchema` → garantit qu'on renvoie quelque chose d'exploitable.
    """
    ar, en, fr = _placeholder_titles(prompt)
    return SheetSchema(
        schema_version=1,
        sheets=[
            Sheet(
                id="main",
                title_ar=ar,
                title_en=en,
                title_fr=fr,
                elements=[
                    Element(
                        id="title",
                        type="text",
                        label_ar="العنوان",
                        label_en="Title",
                        label_fr="Titre",
                        required=True,
                    ),
                    Element(
                        id="description",
                        type="textarea",
                        label_ar="الوصف",
                        label_en="Description",
                        label_fr="Description",
                    ),
                    Element(
                        id="submit",
                        type="button",
                        label_ar="إرسال",
                        label_en="Submit",
                        label_fr="Envoyer",
                        action="submit",
                    ),
                ],
            )
        ],
    )


def _strip_json_fences(text: str) -> str:
    """Retire d'éventuelles barrières markdown ```json ... ``` autour du JSON."""
    t = text.strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[-1] if "\n" in t else t
        t = t.rsplit("```", 1)[0]
    return t.strip()


def parse_schema_or_none(text: str) -> SheetSchema | None:
    """Parse + valide une sortie texte en `SheetSchema` (None si invalide). Pur.

    Toute sortie non-JSON, hors-schéma ou avec champ interdit (`extra='forbid'`)
    → None (l'appelant se replie). C'est le point de contrôle anti-sortie-IA-malformée.
    """
    raw = _strip_json_fences(text or "")
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    try:
        return SheetSchema.model_validate(data)
    except ValueError:
        return None


async def generate_sheet_schema(prompt: str, locale: str = "fr") -> tuple[SheetSchema, str]:
    """Génère un `SheetSchema` depuis une description. Renvoie (schema, engine).

    Best-effort, ne lève JAMAIS : appelle Gemini ; si indisponible / sortie invalide
    → `fallback_schema` (engine=`fallback_heuristic`). La sortie Gemini est revalidée
    contre `SheetSchema` avant d'être acceptée.
    """
    loc: gemini.Locale = locale if locale in ("ar", "en", "fr") else "fr"  # type: ignore[assignment]
    result = await gemini.generate_text(
        prompt,
        system_instruction=_SYSTEM_PROMPT,
        locale=loc,
        temperature=0.2,
        max_chars=8000,
    )
    schema = parse_schema_or_none(result.get("text", ""))
    if schema is None:
        return fallback_schema(prompt), FALLBACK_ENGINE
    return schema, str(result.get("engine") or "gemini")
