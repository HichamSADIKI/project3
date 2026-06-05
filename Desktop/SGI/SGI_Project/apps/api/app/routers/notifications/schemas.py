"""Schémas Pydantic v2 — Notifications in-app (M6)."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class NotificationOut(BaseModel):
    id: uuid.UUID
    type: str
    channel: str
    title: str
    body: str | None
    payload: dict[str, Any]
    status: str
    sent_at: datetime | None
    read_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListOut(BaseModel):
    success: bool = True
    data: list[NotificationOut]
    meta: dict[str, Any]


class NotificationResponse(BaseModel):
    success: bool = True
    data: NotificationOut


class DeviceTokenRegister(BaseModel):
    token: str = Field(min_length=8, max_length=512)
    platform: str = Field(pattern="^(ios|android|web)$")


class DeviceTokenOut(BaseModel):
    id: uuid.UUID
    token: str
    platform: str
    last_seen_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DeviceTokenResponse(BaseModel):
    success: bool = True
    data: DeviceTokenOut


class DeviceTokenListOut(BaseModel):
    success: bool = True
    data: list[DeviceTokenOut]
    meta: dict[str, Any]
