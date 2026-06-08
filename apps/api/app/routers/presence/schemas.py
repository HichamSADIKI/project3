"""Schémas Pydantic — présence / surveillance.

Les données de surveillance (sessions, IP, géo) ne sont servies qu'aux admins
(garde côté router). Le heartbeat n'accepte que session + navigation.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class HeartbeatBody(BaseModel):
    session_key: str = Field(min_length=8, max_length=64)
    category: str | None = Field(default=None, max_length=60)
    subcategory: str | None = Field(default=None, max_length=60)
    page: str | None = Field(default=None, max_length=120)


class ActiveSession(BaseModel):
    user_id: uuid.UUID
    user_label: str | None = None
    ip: str | None = None
    country: str | None = None
    city: str | None = None
    lat: float | None = None
    lng: float | None = None
    category: str | None = None
    subcategory: str | None = None
    page: str | None = None
    last_seen_at: datetime


class Bucket(BaseModel):
    key: str
    label: str | None = None
    count: int


class Advanced(BaseModel):
    by_category: list[Bucket]
    by_subcategory: list[Bucket]
    by_page: list[Bucket]


class ActiveResponse(BaseModel):
    success: bool = True
    sessions: list[ActiveSession]
    by_user: list[Bucket]
    by_ip: list[Bucket]
    by_region: list[Bucket]
    advanced: Advanced | None = None
