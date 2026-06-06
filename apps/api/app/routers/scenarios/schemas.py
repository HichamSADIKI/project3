"""Schémas Pydantic v2 — module Scenarios."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class ScenarioCreate(BaseModel):
    listing_type: str = Field(..., pattern="^(sale|rent)$")
    listing_id: uuid.UUID
    title: str | None = Field(None, max_length=200)
    voice_mode: str = Field("avatar", pattern="^(avatar|recorded)$")
    avatar: str | None = Field(None, pattern="^(male|female)$")
    script: str | None = Field(None, max_length=5000)
    photo_refs: list[str] = Field(default_factory=list, max_length=10)
    audio_ref: str | None = None

    @model_validator(mode="after")
    def _check_voice(self) -> ScenarioCreate:
        if self.voice_mode == "avatar" and self.avatar is None:
            raise ValueError("avatar_required_for_avatar_voice")
        if self.voice_mode == "recorded" and not self.audio_ref:
            raise ValueError("audio_required_for_recorded_voice")
        if not self.photo_refs:
            raise ValueError("at_least_one_photo_required")
        return self


class ScenarioOut(BaseModel):
    id: uuid.UUID
    listing_type: str
    listing_id: uuid.UUID
    title: str | None
    voice_mode: str
    avatar: str | None
    script: str | None
    photo_refs: list[str]
    audio_ref: str | None
    status: str
    video_url: str | None
    error: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ScenarioListOut(BaseModel):
    success: bool = True
    data: list[ScenarioOut]


class ScenarioDetailOut(BaseModel):
    success: bool = True
    data: ScenarioOut


class UploadOut(BaseModel):
    success: bool = True
    data: dict[str, str]  # {"ref": <minio key>, "url": <presigned url>}


class AvatarOut(BaseModel):
    success: bool = True
    data: list[dict[str, str]]  # [{key, label, voice}]
