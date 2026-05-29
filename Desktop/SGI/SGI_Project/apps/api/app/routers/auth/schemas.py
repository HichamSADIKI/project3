import uuid

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    """Login standard email/password.

    `company_slug` est optionnel pour les comptes client mais **requis** pour
    les comptes fournisseur (vérifié par la couche service). Sa présence
    garantit que l'utilisateur s'authentifie bien sur la société attendue
    — défense en profondeur contre l'usurpation cross-tenant.
    """

    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)
    company_slug: str | None = Field(default=None, min_length=2, max_length=100)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class UserMe(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    status: str
    company_id: uuid.UUID
    preferred_language: str = "en"

    model_config = {"from_attributes": True}


class PublicRegisterRequest(BaseModel):
    """Inscription publique Client ou Partenaire — statut 'pending' à la création."""

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=255)
    company_slug: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Slug du tenant SGI auquel l'utilisateur s'inscrit (ex: 'infinity-uae').",
    )
    preferred_language: str = Field(
        default="en",
        pattern="^(ar|en|fr)$",
        description="Langue préférée de l'utilisateur (ar/en/fr).",
    )


class RegisterResponse(BaseModel):
    user_id: uuid.UUID
    email: str
    role: str
    status: str
    message: str


class PendingUserItem(BaseModel):
    """Élément de la liste des inscriptions en attente (vue admin)."""

    id: uuid.UUID
    email: str
    full_name: str
    role: str
    status: str
    created_at: str

    model_config = {"from_attributes": True}


class ApproveUserRequest(BaseModel):
    """Décision admin sur une inscription en attente."""

    approve: bool
    reason: str | None = Field(default=None, max_length=500)


class SocialLoginRequest(BaseModel):
    """Demande de connexion via fournisseur tiers (OAuth/social).

    `id_token` : JWT ou access_token émis par le provider (Google/Apple/Facebook…).
    `access_token` : token court fourni en complément si le provider en émet un.
    `code` : code OAuth (PKCE) si le mobile n'a pas pu échanger côté client.
    """

    provider: str = Field(
        ...,
        pattern="^(google|apple|facebook|microsoft|instagram|snapchat|whatsapp|telegram)$",
        description="Identifiant du fournisseur social.",
    )
    id_token: str | None = Field(default=None, max_length=8192)
    access_token: str | None = Field(default=None, max_length=8192)
    code: str | None = Field(default=None, max_length=2048)
