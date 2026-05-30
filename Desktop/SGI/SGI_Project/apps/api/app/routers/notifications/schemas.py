"""Schémas Pydantic v2 — Notifications in-app (M6)."""
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


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
