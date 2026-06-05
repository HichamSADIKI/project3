import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

TYPE_PATTERN = "^(appointment|visit|task|call|other)$"
STATUS_PATTERN = "^(scheduled|done|cancelled)$"


class AgendaEventCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    event_type: str = Field("appointment", pattern=TYPE_PATTERN)
    status: str = Field("scheduled", pattern=STATUS_PATTERN)
    start_at: datetime
    end_at: datetime | None = None
    all_day: bool = False
    location: str | None = Field(None, max_length=255)
    client_id: uuid.UUID | None = None
    property_id: uuid.UUID | None = None
    assigned_user_id: uuid.UUID | None = None
    notes: str | None = None


class AgendaEventUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    event_type: str | None = Field(None, pattern=TYPE_PATTERN)
    status: str | None = Field(None, pattern=STATUS_PATTERN)
    start_at: datetime | None = None
    end_at: datetime | None = None
    all_day: bool | None = None
    location: str | None = Field(None, max_length=255)
    client_id: uuid.UUID | None = None
    property_id: uuid.UUID | None = None
    assigned_user_id: uuid.UUID | None = None
    notes: str | None = None


class AgendaEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company_id: uuid.UUID
    title: str
    event_type: str
    status: str
    start_at: datetime
    end_at: datetime | None
    all_day: bool
    location: str | None
    client_id: uuid.UUID | None
    property_id: uuid.UUID | None
    assigned_user_id: uuid.UUID | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class AgendaEventListOut(BaseModel):
    success: bool = True
    data: list[AgendaEventOut]
    meta: dict[str, int]


class AgendaEventDetailOut(BaseModel):
    success: bool = True
    data: AgendaEventOut
