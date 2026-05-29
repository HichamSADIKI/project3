"""Client minimaliste pour Google Gemini (REST API via httpx).

Utilisé par l'espace Client pour transformer un besoin exprimé en texte libre
(ou dicté via Web Speech / Whisper côté portal) en deal CRM structuré.

Conception :
- Async, basé sur httpx (déjà dans les dépendances)
- Fail-safe : si GEMINI_API_KEY absente, fallback heuristique purement local
  (catégorie = realestate, extraction regex légère du budget AED)
- Pas d'état partagé — instanciable à chaque appel
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Literal

import httpx

logger = logging.getLogger(__name__)

# Modèle par défaut — Gemini 2.5 Flash (rapide, peu cher, JSON-friendly)
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)

VALID_CATEGORIES = (
    "realestate",
    "tourisme",
    "sante",
    "assurance",
    "banques",
    "amazon",
    "consultants",
    "admin",
    "travail",
)

Locale = Literal["ar", "en", "fr"]


# ── Fallback heuristique (sans IA) ───────────────────────────────────────

_BUDGET_RE = re.compile(
    r"(\d{1,3}(?:[\.,\s]\d{3})+|\d+)\s*(k|m|million|millions|aed|dirham|دره|د\.إ)?",
    re.IGNORECASE,
)

_CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "realestate": (
        "villa", "apartment", "appartement", "studio", "penthouse", "duplex",
        "rent", "buy", "achat", "vente", "location", "real estate", "immobilier",
        "marina", "downtown", "palm", "jbr", "deira", "jvc", "jlt", "fila",
        "شقة", "فيلا", "إيجار", "شراء", "عقار",
    ),
    "tourisme": (
        "hotel", "tour", "visa", "yacht", "excursion", "circuit", "séjour",
        "tourisme", "tourism", "voyage", "transfer", "vip",
        "فندق", "سياحة", "رحلة", "تأشيرة",
    ),
    "sante": (
        "medical", "doctor", "hospital", "surgery", "health insurance",
        "santé", "médical", "chirurgie", "checkup", "bilan",
        "طبي", "صحة", "مستشفى",
    ),
    "assurance": (
        "insurance", "assurance", "policy", "couverture", "claim",
        "تأمين",
    ),
    "banques": (
        "mortgage", "loan", "account", "bank", "wealth", "credit",
        "banque", "compte", "prêt", "crédit", "hypothèque",
        "بنك", "قرض", "حساب", "رهن",
    ),
    "amazon": (
        "amazon", "fba", "e-commerce", "ecommerce", "store", "shopify",
        "boutique en ligne", "vendeur",
        "أمازون", "متجر إلكتروني",
    ),
    "consultants": (
        "consulting", "consultant", "audit", "strategy", "due diligence",
        "conseil", "stratégie",
        "استشارة", "تدقيق",
    ),
    "admin": (
        "license", "permit", "company setup", "trade license", "pro service",
        "dld", "notary", "création société", "permis", "notaire", "résidence",
        "ترخيص", "تأسيس شركة", "إقامة",
    ),
    "travail": (
        "recruitment", "hiring", "headhunting", "employment", "rh",
        "recrutement", "emploi", "embauche",
        "توظيف", "وظيفة",
    ),
}


def _parse_budget_aed(text: str) -> float | None:
    """Extraction très simple — premier nombre vu, multiplicateur k/m."""
    m = _BUDGET_RE.search(text)
    if not m:
        return None
    raw, unit = m.group(1), (m.group(2) or "").lower()
    try:
        amount = float(raw.replace(" ", "").replace(",", "").replace(".", ""))
    except ValueError:
        return None
    if unit in ("k",):
        amount *= 1_000
    elif unit in ("m", "million", "millions"):
        amount *= 1_000_000
    # Plafond raisonnable : si on a un nombre < 1000 sans unité, considère 'k' implicite
    # uniquement quand le contexte parle d'AED (sinon on laisse tel quel)
    return amount if amount > 0 else None


def _detect_category_local(text: str) -> str:
    t = text.lower()
    scores: dict[str, int] = {}
    for cat, keywords in _CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in t)
        if score:
            scores[cat] = score
    if not scores:
        return "realestate"
    return max(scores, key=lambda k: scores[k])


def _fallback_parse(text: str, locale: Locale) -> dict[str, Any]:
    """Parsing local (sans appel API) — utilisé si pas de clé Gemini."""
    return {
        "category": _detect_category_local(text),
        "service_type": None,
        "budget_aed": _parse_budget_aed(text),
        "preferred_location": None,
        "property_type": None,
        "urgency": "medium",
        "summary": text[:300],
        "confidence": 0.4,
        "engine": "local_heuristic",
    }


# ── Appel Gemini ─────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """You are an expert UAE multi-sector CRM analyst for SGI (real estate, tourism, health, insurance, banking, e-commerce, consulting, administrations, employment).

Given a free-text or transcribed-voice client need, return a STRICT JSON object with this exact shape (no markdown, no extra prose):

{
  "category": one of ["realestate","tourisme","sante","assurance","banques","amazon","consultants","admin","travail"],
  "service_type": short label (e.g. "Long-term rental", "Tourist visa") or null,
  "budget_aed": numeric AED amount or null,
  "preferred_location": string (Dubai area / city) or null,
  "property_type": one of ["apartment","villa","townhouse","penthouse","commercial","land","studio"] or null (only when category=realestate),
  "urgency": one of ["high","medium","low"],
  "summary": one-sentence summary in the SAME language as the input,
  "confidence": float in [0,1]
}

Rules:
- If unsure of category, return "realestate" with confidence < 0.6.
- Budget: convert k/m suffixes (k=thousand, m=million). Always AED.
- Be conservative — null is better than wrong.
- Output VALID JSON ONLY — nothing else."""


async def parse_client_need(text: str, locale: Locale = "fr") -> dict[str, Any]:
    """
    Parse un besoin client libre/dicté en deal structuré.

    Retourne toujours un dict avec les clés du schéma. Ne lève jamais.
    En cas d'erreur API → fallback heuristique local.
    """
    text = (text or "").strip()
    if not text:
        return _fallback_parse("", locale)

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        logger.info("GEMINI_API_KEY absent — utilisation du fallback local")
        return _fallback_parse(text, locale)

    payload = {
        "systemInstruction": {"parts": [{"text": _SYSTEM_PROMPT}]},
        "contents": [
            {
                "role": "user",
                "parts": [{"text": f"Locale={locale}\n\nClient need:\n{text}"}],
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(
                f"{GEMINI_URL}?key={api_key}",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:  # noqa: BLE001 — fail-safe explicite
        logger.warning("Gemini API error: %s — fallback local", exc)
        return _fallback_parse(text, locale)

    try:
        raw = data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(raw)
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        logger.warning("Gemini réponse non-parsable: %s — fallback local", exc)
        return _fallback_parse(text, locale)

    # Validation des champs critiques
    cat = parsed.get("category")
    if cat not in VALID_CATEGORIES:
        parsed["category"] = "realestate"
        parsed["confidence"] = min(float(parsed.get("confidence") or 0.5), 0.5)

    parsed.setdefault("urgency", "medium")
    parsed.setdefault("confidence", 0.7)
    parsed.setdefault("summary", text[:300])
    parsed["engine"] = "gemini-2.5-flash"
    return parsed
