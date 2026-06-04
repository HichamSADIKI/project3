"""Tâches Celery — module Scenarios (génération vidéo social media).

Queue : exports (traitements lourds non temps-réel).

`generate` est un **STUB** (MVP) : il fait passer le scénario de `generating` à
`ready` avec une URL vidéo placeholder. C'est le **seam** pour brancher un vrai
fournisseur asynchrone (D-ID/HeyGen + TTS) — il suffira de remplacer le corps par
l'appel réel (photos + script + avatar → vidéo) sans changer la signature ni le
reste du module.

Rôle privilégié (`sync_session_maker`) comme les autres tâches, mais on pose le
GUC tenant et on filtre explicitement par `company_id` (Loi 1).
"""

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from celery import shared_task
from sqlalchemy import select, text

from app.core.database import sync_session_maker
from app.routers.scenarios.models import VideoScenario
from app.routers.scenarios.service import stub_video_url

logger = logging.getLogger(__name__)


@shared_task(name="app.tasks.scenarios.generate", bind=True, max_retries=3)
def generate(self: Any, company_id: str, scenario_id: str) -> dict[str, str]:
    cid = uuid.UUID(company_id)
    sid = uuid.UUID(scenario_id)
    with sync_session_maker() as db:
        db.execute(
            text("SELECT set_config('app.current_company_id', :c, false)"),
            {"c": str(cid)},
        )
        scenario = (
            db.execute(
                select(VideoScenario).where(
                    VideoScenario.id == sid,
                    VideoScenario.company_id == cid,
                    VideoScenario.deleted_at.is_(None),
                )
            )
            .scalars()
            .first()
        )
        if scenario is None:
            return {"status": "not_found", "id": scenario_id}
        if scenario.status == "ready" and scenario.video_url:
            return {"status": "ready", "id": scenario_id}
        # ── STUB : remplacer par l'appel réel au fournisseur vidéo/voix ──────
        scenario.status = "ready"
        scenario.video_url = stub_video_url(scenario.id)
        scenario.error = None
        scenario.updated_at = datetime.now(UTC)
        db.commit()
        logger.info("scenario %s généré (stub)", scenario_id)
        return {"status": "ready", "id": scenario_id}
