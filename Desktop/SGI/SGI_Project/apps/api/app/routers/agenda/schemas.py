"""Schémas Pydantic v2 — Agenda (Real Estate)."""
from __future__ import annotations

from pydantic import BaseModel, Field


class AgendaConfigOut(BaseModel):
    """Configuration de l'agenda Google Calendar exposée au frontend."""

    configured: bool = Field(..., description="Une source de calendrier est-elle configurée ?")
    source: str | None = Field(None, description="ID/email du calendrier Google (None si absent).")
    embed_url: str | None = Field(None, description="URL d'embed prête à l'emploi (None si absent).")
    timezone: str = Field(..., description="Fuseau d'affichage (IANA), ex. Asia/Dubai.")
    language: str = Field(..., description="Langue UI appliquée (ar | en | fr).")
