"""Schémas Pydantic v2 — module Social."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class PostCreate(BaseModel):
    listing_type: str = Field(..., pattern="^(sale|rent)$")
    listing_id: uuid.UUID
    channel: str
    message: str | None = Field(None, max_length=2000)
    external_url: str | None = Field(None, max_length=1000)


class PostOut(BaseModel):
    id: uuid.UUID
    listing_type: str
    listing_id: uuid.UUID
    channel: str
    status: str
    message: str | None
    external_url: str | None
    published_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PostListOut(BaseModel):
    success: bool = True
    data: list[PostOut]


class PostDetailOut(BaseModel):
    success: bool = True
    data: PostOut


class ChannelsOut(BaseModel):
    success: bool = True
    data: list[str]
