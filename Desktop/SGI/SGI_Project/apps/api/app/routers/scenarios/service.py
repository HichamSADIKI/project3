"""Service Scenarios — helpers purs + fonctions DB (filtrées company_id, Loi 1).

Génération vidéo + voix d'avatar = STUB (MVP). `run_stub_generation` fait passer
le scénario de `generating` à `ready` avec une URL placeholder déterministe ;
un vrai fournisseur (D-ID/HeyGen + TTS) remplacera ce stub sans toucher au reste.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.routers.scenarios.models import VideoScenario

AVATARS: tuple[str, ...] = ("male", "female")
VOICE_MODES: frozenset[str] = frozenset({"avatar", "recorded"})
LISTING_TYPES: frozenset[str] = frozenset({"sale", "rent"})
STATUSES: frozenset[str] = frozenset({"draft", "generating", "ready", "failed"})

# Vidéo placeholder publique (stub MVP) — remplacée par la vraie sortie plus tard.
_STUB_VIDEO = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
MAX_PHOTOS = 10


# ── Helpers purs (sans DB) ───────────────────────────────────────────────────


def is_valid_avatar(avatar: str) -> bool:
    return avatar in AVATARS


def is_valid_voice_mode(mode: str) -> bool:
    return mode in VOICE_MODES


def is_valid_listing_type(listing_type: str) -> bool:
    return listing_type in LISTING_TYPES


def avatar_voice_label(avatar: str | None) -> str:
    """Libellé de la voix générée selon l'avatar choisi (pur, testable)."""
    return {"male": "voix masculine", "female": "voix féminine"}.get(avatar or "", "voix")


def stub_video_url(scenario_id: uuid.UUID) -> str:
    """URL de la vidéo générée (stub déterministe). `scenario_id` en fragment."""
    return f"{_STUB_VIDEO}#scenario={scenario_id.hex[:8]}"


# ── Fonctions DB (Loi 1 : toujours filtrer company_id) ───────────────────────


async def list_scenarios(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    listing_type: str | None = None,
    listing_id: uuid.UUID | None = None,
    limit: int = 200,
) -> list[VideoScenario]:
    q = select(VideoScenario).where(
        VideoScenario.company_id == company_id,
        VideoScenario.deleted_at.is_(None),
    )
    if listing_type is not None:
        q = q.where(VideoScenario.listing_type == listing_type)
    if listing_id is not None:
        q = q.where(VideoScenario.listing_id == listing_id)
    q = q.order_by(VideoScenario.created_at.desc()).limit(limit)
    return list((await db.execute(q)).scalars().all())


async def get_scenario(
    db: AsyncSession, company_id: uuid.UUID, scenario_id: uuid.UUID
) -> VideoScenario | None:
    q = select(VideoScenario).where(
        VideoScenario.id == scenario_id,
        VideoScenario.company_id == company_id,
        VideoScenario.deleted_at.is_(None),
    )
    return (await db.execute(q)).scalar_one_or_none()


async def create_scenario(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    listing_type: str,
    listing_id: uuid.UUID,
    voice_mode: str,
    photo_refs: list[str],
    title: str | None = None,
    avatar: str | None = None,
    script: str | None = None,
    audio_ref: str | None = None,
) -> VideoScenario:
    """Crée un scénario en statut `generating` (la génération est déclenchée après)."""
    scenario = VideoScenario(
        company_id=company_id,
        listing_type=listing_type,
        listing_id=listing_id,
        title=title,
        voice_mode=voice_mode,
        avatar=avatar,
        script=script,
        photo_refs=photo_refs,
        audio_ref=audio_ref,
        status="generating",
    )
    db.add(scenario)
    await db.commit()
    await db.refresh(scenario)
    return scenario


async def soft_delete(
    db: AsyncSession, company_id: uuid.UUID, scenario_id: uuid.UUID
) -> VideoScenario | None:
    scenario = await get_scenario(db, company_id, scenario_id)
    if scenario is None:
        return None
    now = datetime.now(UTC)
    scenario.deleted_at = now
    scenario.updated_at = now
    await db.commit()
    return scenario


async def run_stub_generation(
    db: AsyncSession, company_id: uuid.UUID, scenario_id: uuid.UUID
) -> VideoScenario | None:
    """STUB de génération : `generating` → `ready` + URL vidéo placeholder.

    Idempotent : ne régénère pas une vidéo déjà prête. Remplacer le corps par un
    vrai appel fournisseur (photos+script+avatar → vidéo) sans changer la signature.
    """
    scenario = await get_scenario(db, company_id, scenario_id)
    if scenario is None:
        return None
    if scenario.status == "ready" and scenario.video_url:
        return scenario
    scenario.status = "ready"
    scenario.video_url = stub_video_url(scenario.id)
    scenario.error = None
    scenario.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(scenario)
    return scenario
