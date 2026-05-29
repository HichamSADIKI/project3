"""Transcription audio — OpenAI Whisper (préférence) avec fallback Gemini.

Utilisé comme fallback côté portal client quand Web Speech API n'est pas
disponible (Safari/iOS) ou quand elle échoue (Chrome — erreur network).
L'audio est enregistré via MediaRecorder côté navigateur puis uploadé sur
`/api/v1/client/needs/transcribe`.

Conception :
- Async via httpx (déjà dans les dépendances).
- Sélection automatique du provider :
    1. OPENAI_API_KEY présente → Whisper (whisper-1).
    2. Sinon, GEMINI_API_KEY présente → Gemini 2.0 Flash (audio inline).
    3. Sinon → 503 service_unavailable.
- Limites strictes : ≤ 5 MB d'audio par requête.
"""
from __future__ import annotations

import base64
import logging
import os
from typing import Literal

import httpx

logger = logging.getLogger(__name__)

WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions"
WHISPER_MODEL = "whisper-1"
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.0-flash:generateContent"
)
MAX_AUDIO_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_MIME_PREFIXES = ("audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg")

Locale = Literal["ar", "en", "fr"]

_GEMINI_PROMPT = {
    "fr": (
        "Transcris exactement ce que dit le locuteur en français. "
        "Retourne uniquement le texte transcrit, sans préfixe ni commentaire."
    ),
    "en": (
        "Transcribe exactly what the speaker says in English. "
        "Return only the transcribed text, no prefix or commentary."
    ),
    "ar": (
        "اكتب بالضبط ما يقوله المتحدث باللغة العربية. "
        "أعد فقط النص المنسوخ، بدون مقدمة أو تعليق."
    ),
}


class WhisperUnavailable(RuntimeError):
    """Levée quand aucun provider n'est configuré ou que l'API échoue."""


def _gemini_mime(content_type: str) -> str:
    """Gemini n'accepte pas les codecs (ex: 'audio/webm;codecs=opus'), seulement le type principal."""
    return content_type.split(";")[0].strip()


async def _transcribe_via_openai(
    audio_bytes: bytes,
    filename: str,
    content_type: str,
    locale: Locale,
    api_key: str,
) -> str:
    files = {
        "file": (filename, audio_bytes, content_type),
        "model": (None, WHISPER_MODEL),
        "language": (None, locale),
        "response_format": (None, "json"),
        "temperature": (None, "0"),
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                WHISPER_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                files=files,
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as exc:
        logger.warning("Whisper HTTP %s: %s", exc.response.status_code, exc.response.text[:200])
        raise WhisperUnavailable(f"whisper_http_{exc.response.status_code}") from exc
    except Exception as exc:  # noqa: BLE001
        logger.warning("Whisper unreachable: %s", exc)
        raise WhisperUnavailable("whisper_unreachable") from exc

    text = (data or {}).get("text", "").strip()
    if not text:
        raise WhisperUnavailable("whisper_empty_transcript")
    return text


async def _transcribe_via_gemini(
    audio_bytes: bytes,
    content_type: str,
    locale: Locale,
    api_key: str,
) -> str:
    mime = _gemini_mime(content_type)
    body = {
        "contents": [
            {
                "parts": [
                    {"text": _GEMINI_PROMPT.get(locale, _GEMINI_PROMPT["fr"])},
                    {
                        "inline_data": {
                            "mime_type": mime,
                            "data": base64.b64encode(audio_bytes).decode("ascii"),
                        }
                    },
                ]
            }
        ],
        "generationConfig": {"temperature": 0, "maxOutputTokens": 2048},
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{GEMINI_URL}?key={api_key}",
                json=body,
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as exc:
        logger.warning("Gemini HTTP %s: %s", exc.response.status_code, exc.response.text[:200])
        raise WhisperUnavailable(f"gemini_http_{exc.response.status_code}") from exc
    except Exception as exc:  # noqa: BLE001
        logger.warning("Gemini unreachable: %s", exc)
        raise WhisperUnavailable("gemini_unreachable") from exc

    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError, TypeError) as exc:
        logger.warning("Gemini unexpected response: %s", str(data)[:200])
        raise WhisperUnavailable("gemini_empty_transcript") from exc

    if not text:
        raise WhisperUnavailable("gemini_empty_transcript")
    return text


async def transcribe_audio(
    audio_bytes: bytes,
    filename: str,
    content_type: str,
    locale: Locale = "fr",
) -> str:
    """
    Transcrit un buffer audio. Choisit le provider selon les clés disponibles.

    Lève WhisperUnavailable si aucun provider n'est configuré ou si l'API
    retourne une erreur — le router transforme cela en 503.
    """
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise WhisperUnavailable("audio_too_large")

    if not any(content_type.startswith(p) for p in ALLOWED_MIME_PREFIXES):
        raise WhisperUnavailable(f"unsupported_audio_mime:{content_type}")

    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    if openai_key:
        return await _transcribe_via_openai(
            audio_bytes, filename, content_type, locale, openai_key
        )

    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    if gemini_key:
        return await _transcribe_via_gemini(audio_bytes, content_type, locale, gemini_key)

    raise WhisperUnavailable("openai_api_key_missing")
