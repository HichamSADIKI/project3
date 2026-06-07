"""Seed E2E — un scénario vidéo **READY avec un vrai objet MinIO** + `video_object_key`.

But : permettre au test E2E « Voir » de vérifier que l'URL présignée renvoyée par
l'API (re-signée à la lecture, cf. `scenario_to_out`, #136) est réellement joignable
par le navigateur (`200 video/mp4`) via `MINIO_PUBLIC_ENDPOINT` (#125).

Diffère de `seed_scenarios_demo.py` (qui pose une URL stub externe, sans MinIO).
Idempotent : réutilise le scénario E2E s'il existe déjà.

À lancer dans le conteneur api (ffmpeg + accès MinIO) :
    docker compose exec -T api uv run python - < scripts/seed_ready_scenario_video.py
"""

from __future__ import annotations

import asyncio
import subprocess
import tempfile
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import storage
from app.core.database import async_session_maker
from app.models.company import Company
from app.routers.sales.models import SaleListing
from app.routers.scenarios.models import VideoScenario
from app.routers.scenarios.service import ffmpeg_output_key

COMPANY_SLUG = "infinity-uae"
E2E_TITLE = "E2E — vidéo MinIO durable"


def _make_tiny_mp4() -> bytes:
    """Génère un MP4 d'1 s (mire de test) via ffmpeg → bytes."""
    with tempfile.TemporaryDirectory() as d:
        out = Path(d) / "e2e.mp4"
        # fmt: off
        cmd = [
            "ffmpeg", "-y", "-f", "lavfi",
            "-i", "testsrc=size=320x240:rate=15:duration=1",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out),
        ]
        # fmt: on
        subprocess.run(cmd, check=True, capture_output=True)  # noqa: S603
        return out.read_bytes()


async def seed(session: AsyncSession) -> None:
    company_id = (
        await session.execute(select(Company.id).where(Company.slug == COMPANY_SLUG))
    ).scalar_one_or_none()
    if company_id is None:
        raise SystemExit(f"company '{COMPANY_SLUG}' introuvable — lancer d'abord make seed")

    existing = (
        await session.execute(
            select(VideoScenario).where(
                VideoScenario.company_id == company_id,
                VideoScenario.title == E2E_TITLE,
                VideoScenario.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        print(f"déjà seedé: scenario {existing.id} (listing {existing.listing_id})")
        return

    listing_id = (
        await session.execute(
            select(SaleListing.id)
            .where(SaleListing.company_id == company_id, SaleListing.deleted_at.is_(None))
            .limit(1)
        )
    ).scalar_one_or_none()
    if listing_id is None:
        raise SystemExit("aucune annonce vente — lancer scripts/seed_sale_demo.py")

    sid = uuid.uuid4()
    key = ffmpeg_output_key(company_id, sid)
    data = _make_tiny_mp4()
    await storage.upload_bytes(key, data, "video/mp4")

    session.add(
        VideoScenario(
            id=sid,
            company_id=company_id,
            listing_type="sale",
            listing_id=listing_id,
            title=E2E_TITLE,
            voice_mode="avatar",
            avatar="female",
            script=None,
            photo_refs=[f"scenarios/{company_id}/photo/e2e.jpg"],
            status="ready",
            video_object_key=key,  # clé objet → re-signée à la lecture (URL durable)
            video_url=None,
            error=None,
        )
    )
    await session.commit()
    print(f"seedé: scenario {sid} listing {listing_id} key={key} ({len(data)} octets)")


async def main() -> None:
    async with async_session_maker() as session:
        await seed(session)


if __name__ == "__main__":
    asyncio.run(main())
