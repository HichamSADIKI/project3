import uuid

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class UserMe(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    company_id: uuid.UUID

    model_config = {"from_attributes": True}
