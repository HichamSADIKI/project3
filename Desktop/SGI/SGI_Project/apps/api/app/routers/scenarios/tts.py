"""TTS Azure Speech — voix d'avatar (Homme/Femme) des scénarios vidéo.

Synthèse vocale du script via l'API REST Azure Cognitive Services Speech. Voix
neurales choisies par (genre × langue détectée) — arabe des Émirats `ar-AE` par
défaut (Hamdan / Fatima), avec EN/FR. **Désactivé proprement** si la clé OU la
région manque (`synthesize` renvoie None → diaporama silencieux). Aucun secret
en dur : tout vient de `settings` (env). Les helpers de mapping/SSML sont **purs
et testables** ; l'appel HTTP est isolé dans `synthesize`.
"""

from __future__ import annotations

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Voix neurales Azure par (langue, genre). ar-AE = arabe des Émirats (golfe).
_VOICES: dict[tuple[str, str], str] = {
    ("ar", "male"): "ar-AE-HamdanNeural",
    ("ar", "female"): "ar-AE-FatimaNeural",
    ("en", "male"): "en-US-GuyNeural",
    ("en", "female"): "en-US-JennyNeural",
    ("fr", "male"): "fr-FR-HenriNeural",
    ("fr", "female"): "fr-FR-DeniseNeural",
}
_LOCALE: dict[str, str] = {"ar": "ar-AE", "en": "en-US", "fr": "fr-FR"}
_OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3"
_FR_MARKERS = (
    " le ",
    " la ",
    " les ",
    " des ",
    " une ",
    " est ",
    " et ",
    " à ",
    "é",
    "è",
    "ê",
    "ç",
    "où",
    "œ",
)


def is_configured() -> bool:
    """Vrai si la clé ET la région Azure sont présentes."""
    return bool(settings.AZURE_SPEECH_KEY and settings.AZURE_SPEECH_REGION)


def detect_language(text: str) -> str:
    """Heuristique simple AR / FR / EN (pure, testable)."""
    if any("؀" <= c <= "ۿ" for c in text):
        return "ar"
    low = f" {text.lower()} "
    if any(m in low for m in _FR_MARKERS):
        return "fr"
    return "en"


def voice_name(gender: str, lang: str) -> str:
    """Nom de la voix Azure pour (genre, langue). Repli femme / arabe. Pur."""
    g = gender if gender in ("male", "female") else "female"
    return _VOICES.get((lang, g), _VOICES[("ar", g)])


def _escape(text: str) -> str:
    return (
        text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
    )


def build_ssml(text: str, *, voice: str, lang: str) -> str:
    """Document SSML pour la synthèse. Pur, testable (échappement XML)."""
    locale = _LOCALE.get(lang, "ar-AE")
    return (
        f"<speak version='1.0' xml:lang='{locale}'>"
        f"<voice name='{voice}'>{_escape(text)}</voice></speak>"
    )


def synthesize(text: str, *, gender: str) -> bytes | None:
    """Synthétise la voix (mp3) depuis `text`. None si non configuré / vide / échec."""
    text = (text or "").strip()
    if not text or not is_configured():
        return None
    lang = detect_language(text)
    ssml = build_ssml(text, voice=voice_name(gender, lang), lang=lang)
    url = f"https://{settings.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1"
    headers = {
        "Ocp-Apim-Subscription-Key": settings.AZURE_SPEECH_KEY,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": _OUTPUT_FORMAT,
        "User-Agent": "sgi-scenarios",
    }
    try:
        resp = httpx.post(url, content=ssml.encode("utf-8"), headers=headers, timeout=30.0)
    except Exception as exc:  # noqa: BLE001 — réseau/timeout → pas de voix
        logger.warning("Azure TTS échec réseau: %s", exc)
        return None
    if resp.status_code != 200:
        logger.warning("Azure TTS %s: %s", resp.status_code, resp.text[:200])
        return None
    return resp.content
