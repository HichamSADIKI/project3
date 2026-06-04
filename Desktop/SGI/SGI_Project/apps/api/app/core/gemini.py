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

import base64
import json
import logging
import os
import re
from collections.abc import AsyncIterator
from typing import Any, Literal

import httpx

logger = logging.getLogger(__name__)

# Modèle par défaut — Gemini 2.5 Flash (rapide, peu cher, JSON-friendly).
# Surchargeable via la variable d'env GEMINI_MODEL sans toucher au code
# (ex. "gemini-2.5-flash-lite" si son quota free-tier est disponible).
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "").strip() or "gemini-2.5-flash"
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
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
    r"(\d[\d.,\s]*\d|\d)\s*"
    r"(milliards?|millions?|million|bn|k\b|m\b|aed|dirhams?|درهم|دره|د\.إ)?",
    re.IGNORECASE,
)

# Multiplicateurs des suffixes (k=mille, m/million=million, bn/milliard=milliard).
_BUDGET_MULTIPLIERS: dict[str, int] = {
    "k": 1_000,
    "m": 1_000_000,
    "million": 1_000_000,
    "millions": 1_000_000,
    "bn": 1_000_000_000,
    "milliard": 1_000_000_000,
    "milliards": 1_000_000_000,
}

_CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "realestate": (
        "villa",
        "apartment",
        "appartement",
        "studio",
        "penthouse",
        "duplex",
        "townhouse",
        "logement",
        "maison",
        "terrain",
        "bureau",
        "local commercial",
        "achat immobilier",
        "acheter un bien",
        "vendre mon bien",
        "à louer",
        "real estate",
        "immobilier",
        "bien immobilier",
        "propriété",
        "loyer",
        "hypothèque immobilière",
        "dld",
        "ejari",
        "freehold",
        "marina",
        "downtown",
        "palm",
        "jbr",
        "deira",
        "jvc",
        "jlt",
        "fila",
        "شقة",
        "فيلا",
        "إيجار",
        "شراء",
        "عقار",
        "منزل",
    ),
    "tourisme": (
        "hotel",
        "hôtel",
        "tour",
        "visa touristique",
        "yacht",
        "excursion",
        "circuit",
        "séjour",
        "tourisme",
        "tourism",
        "voyage",
        "voyager",
        "transfer",
        "transfert aéroport",
        "vip",
        # voyage aérien
        "billet",
        "billet d'avion",
        "billet davion",
        "avion",
        "vols",
        "aérien",
        "aerien",
        "compagnie aérienne",
        "flight",
        "plane ticket",
        "airline",
        "airfare",
        "ticket avion",
        # loisirs / séjour
        "croisière",
        "cruise",
        "plage",
        "resort",
        "vacances",
        "holiday",
        "réservation hôtel",
        "safari",
        "desert safari",
        "billetterie",
        "فندق",
        "سياحة",
        "رحلة",
        "تأشيرة",
        "طيران",
        "تذكرة طيران",
        "رحلة جوية",
    ),
    "sante": (
        "medical",
        "doctor",
        "médecin",
        "docteur",
        "dentiste",
        "dentist",
        "hospital",
        "hôpital",
        "clinique",
        "clinic",
        "surgery",
        "chirurgie",
        "health insurance",
        "santé",
        "médical",
        "checkup",
        "bilan",
        "pharmacie",
        "traitement",
        "consultation médicale",
        "ophtalmo",
        "fertilité",
        "ivf",
        "طبي",
        "صحة",
        "مستشفى",
        "طبيب",
        "عيادة",
    ),
    "assurance": (
        "insurance",
        "assurance",
        "assurer",
        "policy",
        "police d'assurance",
        "couverture",
        "claim",
        "sinistre",
        "mutuelle",
        "assurance auto",
        "assurance habitation",
        "assurance vie",
        "assurance voyage",
        "تأمين",
        "بوليصة",
    ),
    "banques": (
        "mortgage",
        "loan",
        "account",
        "compte bancaire",
        "bank",
        "wealth",
        "credit",
        "banque",
        "compte",
        "prêt",
        "crédit",
        "hypothèque",
        "carte bancaire",
        "virement",
        "iban",
        "financement",
        "épargne",
        "investissement",
        "gestion de patrimoine",
        "bourse",
        "بنك",
        "قرض",
        "حساب",
        "رهن",
        "تمويل",
    ),
    "amazon": (
        "amazon",
        "fba",
        "e-commerce",
        "ecommerce",
        "store",
        "shopify",
        "boutique en ligne",
        "vendeur en ligne",
        "marketplace",
        "dropshipping",
        "vendre en ligne",
        "noon",
        "fulfillment",
        "أمازون",
        "متجر إلكتروني",
        "تجارة إلكترونية",
    ),
    "consultants": (
        "consulting",
        "consultant",
        "audit",
        "strategy",
        "due diligence",
        "conseil",
        "stratégie",
        "accompagnement",
        "expertise",
        "business plan",
        "étude de marché",
        "coaching",
        "feasibility",
        "استشارة",
        "تدقيق",
        "خطة عمل",
    ),
    "admin": (
        "license",
        "licence",
        "permit",
        "company setup",
        "trade license",
        "pro service",
        "notary",
        "création société",
        "creation societe",
        "créer une société",
        "permis",
        "notaire",
        "résidence",
        "golden visa",
        "emirates id",
        "immigration",
        "attestation",
        "pro services",
        "freezone",
        "ترخيص",
        "تأسيس شركة",
        "إقامة",
        "هوية إماراتية",
    ),
    "travail": (
        "recruitment",
        "hiring",
        "headhunting",
        "employment",
        "rh",
        "recrutement",
        "recruter",
        "recrute",
        "emploi",
        "embauche",
        "embaucher",
        "ressources humaines",
        "candidat",
        "cv",
        "offre d'emploi",
        "staffing",
        "main d'oeuvre",
        "manpower",
        "توظيف",
        "وظيفة",
        "موارد بشرية",
    ),
}


def _amount_from(raw: str, unit: str) -> float | None:
    """Convertit (nombre brut, unité) en montant AED.

    Si un suffixe multiplicateur est présent, « . »/« , » sont des séparateurs
    décimaux (« 2.5m » = 2 500 000) ; sinon ce sont des séparateurs de milliers
    (« 2,500,000 » = 2 500 000).
    """
    mult = _BUDGET_MULTIPLIERS.get(unit, 1)
    if mult > 1:
        num = raw.replace(" ", "").replace(",", ".")
        parts = num.split(".")
        if len(parts) > 1:
            num = "".join(parts[:-1]) + "." + parts[-1]
    else:
        num = raw.replace(" ", "").replace(",", "").replace(".", "")
    try:
        amount = float(num) * mult
    except ValueError:
        return None
    return amount if amount > 0 else None


def _parse_budget_aed(text: str) -> float | None:
    """Extrait le montant budgétaire le plus pertinent du texte.

    Stratégie : on préfère un nombre accompagné d'une unité ou d'une devise
    (« 2.5m », « 500000 AED ») — c'est presque toujours le budget. Sinon, on
    retient le plus grand nombre trouvé (un budget n'est jamais « 2 chambres »).
    Gère décimales avec suffixe et séparateurs de milliers.
    """
    first_with_unit: float | None = None
    largest: float | None = None
    for m in _BUDGET_RE.finditer(text):
        raw, unit = m.group(1).strip(), (m.group(2) or "").lower()
        val = _amount_from(raw, unit)
        if val is None:
            continue
        if unit and first_with_unit is None:
            first_with_unit = val
        if largest is None or val > largest:
            largest = val
    return first_with_unit if first_with_unit is not None else largest


def _detect_category_with_score(text: str) -> tuple[str, int]:
    """Catégorie détectée + nombre de mots-clés ayant matché (0 = aucun)."""
    t = text.lower()
    scores: dict[str, int] = {}
    for cat, keywords in _CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in t)
        if score:
            scores[cat] = score
    if not scores:
        return "realestate", 0
    best = max(scores, key=lambda k: scores[k])
    return best, scores[best]


def _detect_category_local(text: str) -> str:
    return _detect_category_with_score(text)[0]


def detect_categories(text: str, *, max_n: int = 4) -> list[str]:
    """Toutes les catégories dont au moins un mot-clé matche, triées par score
    décroissant (un même texte peut couvrir plusieurs secteurs). Si aucune ne
    matche, renvoie ['realestate'] (défaut métier SGI)."""
    t = text.lower()
    scores: dict[str, int] = {}
    for cat, keywords in _CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in t)
        if score:
            scores[cat] = score
    if not scores:
        return ["realestate"]
    ordered = sorted(scores, key=lambda k: scores[k], reverse=True)
    return ordered[:max_n]


# Types de bien — alignés sur le schéma Gemini (apartment, villa, townhouse,
# penthouse, commercial, land, studio). Ordre = priorité (le plus spécifique
# d'abord pour que « penthouse » l'emporte sur « apartment »).
_PROPERTY_TYPES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("villa", ("villa", "فيلا")),
    ("penthouse", ("penthouse",)),
    ("townhouse", ("townhouse", "maison de ville")),
    ("studio", ("studio", "ستوديو")),
    ("apartment", ("apartment", "appartement", "appart", "flat", "شقة")),
    (
        "commercial",
        (
            "bureau",
            "local commercial",
            "commercial",
            "office",
            "shop",
            "magasin",
            "مكتب",
            "محل",
        ),
    ),
    ("land", ("terrain", "plot", "land", "أرض")),
)

# Zones UAE connues — ordonnées du plus spécifique au plus générique pour que
# « palm jumeirah » l'emporte sur « palm » / « jumeirah » / « dubai ».
_KNOWN_LOCATIONS: tuple[str, ...] = (
    "palm jumeirah",
    "downtown dubai",
    "dubai marina",
    "business bay",
    "jumeirah village circle",
    "jumeirah lake towers",
    "dubai hills estate",
    "dubai hills",
    "emirates hills",
    "arabian ranches",
    "dubai silicon oasis",
    "al barsha",
    "yas island",
    "saadiyat island",
    "al reem island",
    "abu dhabi",
    "jbr",
    "jvc",
    "jlt",
    "deira",
    "bur dubai",
    "mirdif",
    "marina",
    "downtown",
    "jumeirah",
    "palm",
    "dubai",
    "sharjah",
    "ajman",
    "ras al khaimah",
    "fujairah",
    "umm al quwain",
    "نخلة جميرا",
    "دبي",
    "أبوظبي",
    "الشارقة",
)

_URGENCY_HIGH: tuple[str, ...] = (
    "urgent",
    "asap",
    "au plus vite",
    "immédiat",
    "immediat",
    "tout de suite",
    "rapidement",
    "dès que possible",
    "des que possible",
    "ce mois",
    "cette semaine",
    "this month",
    "this week",
    "immediately",
    "right away",
    "عاجل",
    "بسرعة",
    "فورا",
    "في أقرب وقت",
)
_URGENCY_LOW: tuple[str, ...] = (
    "pas pressé",
    "pas presse",
    "pas urgent",
    "flexible",
    "plus tard",
    "no rush",
    "long terme",
    "long term",
    "dans quelques mois",
    "éventuellement",
    "eventuellement",
    "غير مستعجل",
    "لاحقا",
)


def _detect_property_type(text: str) -> str | None:
    """Type de bien immobilier détecté (None si aucun)."""
    t = text.lower()
    for canonical, needles in _PROPERTY_TYPES:
        if any(n in t for n in needles):
            return canonical
    return None


def _detect_location(text: str) -> str | None:
    """Première zone UAE connue trouvée (la plus spécifique grâce à l'ordre)."""
    t = text.lower()
    for loc in _KNOWN_LOCATIONS:
        if loc in t:
            return loc.title() if loc.isascii() else loc
    return None


def _detect_urgency(text: str) -> str:
    """Urgence heuristique : high / low si signal explicite, sinon medium."""
    t = text.lower()
    if any(k in t for k in _URGENCY_HIGH):
        return "high"
    if any(k in t for k in _URGENCY_LOW):
        return "low"
    return "medium"


def _fallback_parse(text: str, locale: Locale) -> dict[str, Any]:
    """Parsing local (sans appel API) — utilisé si pas de clé Gemini.

    Confiance dynamique : si des mots-clés ont matché, la détection est fiable
    et la confiance dépasse le seuil 0.6 — sinon le service forcerait
    'realestate' (cf. service.py). Sans aucun match (catégorie ambiguë), on
    reste à 0.4 et 'realestate' devient le défaut métier assumé.

    Extrait aussi, par heuristique : budget, localisation (zones UAE), type de
    bien (immobilier uniquement) et urgence — pour un lead exploitable même
    sans Gemini.
    """
    category, match_score = _detect_category_with_score(text)
    confidence = 0.7 if match_score >= 1 else 0.4
    property_type = _detect_property_type(text) if category == "realestate" else None
    return {
        "category": category,
        "service_type": None,
        "budget_aed": _parse_budget_aed(text),
        "preferred_location": _detect_location(text),
        "property_type": property_type,
        "urgency": _detect_urgency(text),
        "summary": text[:300],
        "confidence": confidence,
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
                GEMINI_URL,
                json=payload,
                headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
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


# ── OCR licence commerciale (vision) ──────────────────────────────────────

# Catégories prestataire SGI (alignées sur VendorType — apps/api/.../vendors/schemas.py)
VENDOR_TYPES = (
    "maintenance",
    "cleaning",
    "security",
    "landscaping",
    "pest_control",
    "elevator",
    "moving",
    "hvac",
    "electrical",
    "plumbing",
    "other",
)

# MIME acceptés par l'inline_data Gemini pour un document licence.
_LICENCE_MIME_PREFIXES = ("application/pdf", "image/jpeg", "image/png", "image/webp")

_LICENCE_PROMPT = """You are a UAE trade-licence (commercial license) OCR extractor.

From the attached document (a UAE trade licence — DED Dubai, ADDED Abu Dhabi, a
free-zone authority, etc.), return a STRICT JSON object with this exact shape
(no markdown, no commentary):

{
  "trade_licence_number": string or null,
  "trade_licence_expiry": "YYYY-MM-DD" or null,
  "trade_licence_authority": string or null,
  "company_name": string or null,
  "suggested_vendor_type": one of ["maintenance","cleaning","security","landscaping","pest_control","elevator","moving","hvac","electrical","plumbing","other"],
  "confidence": float in [0,1]
}

Rules:
- Map the licensed business activity to the closest vendor_type; if none fits, use "other".
- Dates MUST be ISO (YYYY-MM-DD). If only a Hijri/partial date is visible, return null.
- Be conservative — null is better than a wrong value.
- Output VALID JSON ONLY."""


def _empty_licence_extraction(engine: str) -> dict[str, Any]:
    return {
        "trade_licence_number": None,
        "trade_licence_expiry": None,
        "trade_licence_authority": None,
        "company_name": None,
        "suggested_vendor_type": None,
        "confidence": 0.0,
        "engine": engine,
    }


async def extract_trade_licence(document_bytes: bytes, content_type: str) -> dict[str, Any]:
    """Extrait les champs d'une licence commerciale UAE via Gemini Vision.

    Best-effort : ne lève JAMAIS. Retourne toujours un dict au schéma attendu.
    Sans clé Gemini, MIME non supporté ou erreur API → extraction vide
    (l'admin saisit/valide manuellement à partir du document affiché).
    """
    mime = (content_type or "").split(";")[0].strip().lower()
    if not document_bytes or not any(mime.startswith(p) for p in _LICENCE_MIME_PREFIXES):
        return _empty_licence_extraction("unsupported_mime")

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        logger.info("GEMINI_API_KEY absent — extraction licence non disponible")
        return _empty_licence_extraction("unavailable")

    payload = {
        "systemInstruction": {"parts": [{"text": _LICENCE_PROMPT}]},
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": "Extract the trade licence fields from this document."},
                    {
                        "inline_data": {
                            "mime_type": mime,
                            "data": base64.b64encode(document_bytes).decode("ascii"),
                        }
                    },
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0,
            "responseMimeType": "application/json",
        },
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                GEMINI_URL,
                json=payload,
                headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
            )
            resp.raise_for_status()
            data = resp.json()
        raw = data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(raw)
    except Exception as exc:  # noqa: BLE001 — fail-safe explicite
        logger.warning("Extraction licence échouée: %s", exc)
        return _empty_licence_extraction("error")

    out = _empty_licence_extraction("gemini-2.5-flash")
    for key in (
        "trade_licence_number",
        "trade_licence_expiry",
        "trade_licence_authority",
        "company_name",
        "confidence",
    ):
        if parsed.get(key) is not None:
            out[key] = parsed[key]
    svt = parsed.get("suggested_vendor_type")
    out["suggested_vendor_type"] = svt if svt in VENDOR_TYPES else "other"
    return out


# ── Génération de texte libre (copilot agent) ─────────────────────────────


async def generate_text(
    prompt: str,
    *,
    system_instruction: str | None = None,
    locale: Locale = "fr",
    temperature: float = 0.3,
    max_chars: int = 2000,
) -> dict[str, Any]:
    """Complétion de texte libre via Gemini (rédaction assistée, copilot agent).

    Best-effort, ne lève JAMAIS : sans clé ou sur erreur API, retourne
    ``{"text": "", "engine": "unavailable"}`` — l'appelant fournit alors son
    propre repli (brouillon heuristique). Le texte renvoyé est tronqué à
    ``max_chars`` pour borner la sortie.
    """
    prompt = (prompt or "").strip()
    if not prompt:
        return {"text": "", "engine": "unavailable"}

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        logger.info("GEMINI_API_KEY absent — generate_text indisponible")
        return {"text": "", "engine": "unavailable"}

    payload: dict[str, Any] = {
        "contents": [
            {"role": "user", "parts": [{"text": f"Locale={locale}\n\n{prompt}"}]},
        ],
        "generationConfig": {"temperature": temperature},
    }
    if system_instruction:
        payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(
                GEMINI_URL,
                json=payload,
                headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
            )
            resp.raise_for_status()
            data = resp.json()
        raw = data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as exc:  # noqa: BLE001 — fail-safe explicite
        logger.warning("generate_text Gemini error: %s — repli appelant", exc)
        return {"text": "", "engine": "unavailable"}

    return {"text": (raw or "").strip()[:max_chars], "engine": GEMINI_MODEL}


# ── Chat multi-tours (assistant in-app) ───────────────────────────────────


async def generate_chat(
    messages: list[dict[str, str]],
    *,
    system_instruction: str | None = None,
    locale: Locale = "fr",
    temperature: float = 0.3,
    max_chars: int = 2000,
) -> dict[str, Any]:
    """Complétion conversationnelle multi-tours via Gemini (assistant in-app).

    ``messages`` est une liste ``{"role": "user"|"assistant", "content": str}``
    dans l'ordre chronologique. Best-effort, ne lève JAMAIS : sans clé ou sur
    erreur API, retourne ``{"text": "", "engine": "unavailable"}`` — l'appelant
    fournit alors son propre repli. Le texte est tronqué à ``max_chars``.
    """
    # On ne garde que les messages non vides ; le tour Gemini doit finir par un
    # message `user` (sinon l'API refuse). On exige donc au moins un user.
    turns = [
        {
            "role": "model" if m.get("role") == "assistant" else "user",
            "text": (m.get("content") or "").strip(),
        }
        for m in messages
        if (m.get("content") or "").strip()
    ]
    if not turns or turns[-1]["role"] != "user":
        return {"text": "", "engine": "unavailable"}

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        logger.info("GEMINI_API_KEY absent — generate_chat indisponible")
        return {"text": "", "engine": "unavailable"}

    contents = [{"role": t["role"], "parts": [{"text": t["text"]}]} for t in turns]
    payload: dict[str, Any] = {
        "contents": contents,
        "generationConfig": {"temperature": temperature},
    }
    sys = f"Locale={locale}. Always answer in this language."
    if system_instruction:
        sys = f"{system_instruction}\n\n{sys}"
    payload["systemInstruction"] = {"parts": [{"text": sys}]}

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(
                GEMINI_URL,
                json=payload,
                headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
            )
            resp.raise_for_status()
            data = resp.json()
        raw = data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as exc:  # noqa: BLE001 — fail-safe explicite
        logger.warning("generate_chat Gemini error: %s — repli appelant", exc)
        return {"text": "", "engine": "unavailable"}

    return {"text": (raw or "").strip()[:max_chars], "engine": GEMINI_MODEL}


# ── Chat en streaming (SSE) — assistant in-app, effet « en train d'écrire » ──

GEMINI_STREAM_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}"
    ":streamGenerateContent?alt=sse"
)


async def generate_chat_stream(
    messages: list[dict[str, str]],
    *,
    system_instruction: str | None = None,
    locale: Locale = "fr",
    temperature: float = 0.3,
) -> AsyncIterator[str]:
    """Complétion conversationnelle **en streaming** (deltas de texte) via Gemini.

    Best-effort : sans clé ou sur erreur, le générateur **ne yield rien** (et ne
    lève jamais) → l'appelant détecte l'absence de chunk et fournit son repli.
    """
    turns = [
        {
            "role": "model" if m.get("role") == "assistant" else "user",
            "text": (m.get("content") or "").strip(),
        }
        for m in messages
        if (m.get("content") or "").strip()
    ]
    if not turns or turns[-1]["role"] != "user":
        return

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        logger.info("GEMINI_API_KEY absent — generate_chat_stream indisponible")
        return

    contents = [{"role": t["role"], "parts": [{"text": t["text"]}]} for t in turns]
    sys = f"Locale={locale}. Always answer in this language."
    if system_instruction:
        sys = f"{system_instruction}\n\n{sys}"
    payload: dict[str, Any] = {
        "contents": contents,
        "generationConfig": {"temperature": temperature},
        "systemInstruction": {"parts": [{"text": sys}]},
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream(
                "POST",
                GEMINI_STREAM_URL,
                json=payload,
                headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if not line.startswith("data:"):
                        continue
                    chunk = line[len("data:") :].strip()
                    if not chunk or chunk == "[DONE]":
                        continue
                    try:
                        obj = json.loads(chunk)
                        text = obj["candidates"][0]["content"]["parts"][0]["text"]
                    except (KeyError, IndexError, TypeError, json.JSONDecodeError):
                        continue
                    if text:
                        yield text
    except Exception as exc:  # noqa: BLE001 — fail-safe : l'appelant repliera
        logger.warning("generate_chat_stream Gemini error: %s", exc)
        return
