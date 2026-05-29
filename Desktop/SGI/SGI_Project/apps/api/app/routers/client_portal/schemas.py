import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


# ── Favoris ──────────────────────────────────────────────────────────────
class FavoriteCreate(BaseModel):
    property_id: uuid.UUID


class FavoriteOut(BaseModel):
    id: uuid.UUID
    property_id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Visites ──────────────────────────────────────────────────────────────
class VisitRequestCreate(BaseModel):
    property_id: uuid.UUID
    preferred_date: date
    preferred_time_slot: str | None = Field(default=None, max_length=20)
    client_notes: str | None = Field(default=None, max_length=2000)


class VisitRequestOut(BaseModel):
    id: uuid.UUID
    property_id: uuid.UUID
    preferred_date: date
    preferred_time_slot: str | None
    status: str
    client_notes: str | None
    agent_notes: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Mes leads (besoins/deals créés par le client) ────────────────────────
class MyLeadOut(BaseModel):
    """Deal CRM créé par le client connecté — vue portail « Mes leads »."""

    id: uuid.UUID
    reference: str | None
    status: str
    category: str
    source: str | None
    budget: float | None
    property_type: str | None
    preferred_location: str | None
    golden_visa_eligible: bool
    score: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Messages ─────────────────────────────────────────────────────────────
class MessageCreate(BaseModel):
    recipient_user_id: uuid.UUID
    subject: str | None = Field(default=None, max_length=255)
    body: str = Field(..., min_length=1, max_length=10000)
    related_property_id: uuid.UUID | None = None
    related_contract_id: uuid.UUID | None = None


class MessageOut(BaseModel):
    id: uuid.UUID
    sender_user_id: uuid.UUID
    recipient_user_id: uuid.UUID
    subject: str | None
    body: str
    related_property_id: uuid.UUID | None
    related_contract_id: uuid.UUID | None
    read_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Dashboard ────────────────────────────────────────────────────────────
class ClientDashboardOut(BaseModel):
    favorites_count: int
    active_contracts: int
    upcoming_payments: int
    pending_visits: int
    unread_messages: int


# ── Expression de besoin (texte / dictée vocale) ─────────────────────────
class NeedSubmitIn(BaseModel):
    """Besoin libre du client (textuel ou transcription vocale)."""

    text: str = Field(
        ...,
        min_length=10,
        max_length=4000,
        description="Texte libre — écrit ou transcrit du micro",
    )
    locale: str = Field(default="fr", pattern="^(ar|en|fr)$")
    source: str = Field(default="portal_text", pattern="^(portal_text|portal_voice)$")
    category_override: str | None = Field(
        default=None,
        max_length=30,
        description="Si fourni, force la catégorie (court-circuite l'IA)",
    )


class ParsedNeedOut(BaseModel):
    """Aperçu de l'analyse IA — affiché au client avant confirmation."""

    category: str
    categories: list[str] = []  # toutes les catégories détectées (multi-secteurs)
    service_type: str | None = None
    budget_aed: float | None = None
    preferred_location: str | None = None
    property_type: str | None = None
    urgency: str = "medium"
    summary: str
    confidence: float
    engine: str


class NeedSubmitOut(BaseModel):
    """Résultat de la soumission — deal créé en base + détails IA."""

    lead_id: uuid.UUID
    crm_ref: str
    category: str
    parsed: ParsedNeedOut


class NeedSubmitMultiIn(BaseModel):
    """Soumission multi-catégories — une fois la popup validée par le client."""

    text: str = Field(..., min_length=10, max_length=4000)
    locale: str = Field(default="fr", pattern="^(ar|en|fr)$")
    source: str = Field(default="portal_text", pattern="^(portal_text|portal_voice)$")
    categories: list[str] = Field(
        ...,
        min_length=1,
        max_length=9,
        description="Catégories validées par le client (1 deal créé par catégorie).",
    )


class DealRef(BaseModel):
    """Référence d'un deal créé."""

    lead_id: uuid.UUID
    crm_ref: str
    category: str


class NeedSubmitMultiOut(BaseModel):
    """Résultat multi — un deal par catégorie + détails IA communs."""

    deals: list[DealRef]
    categories: list[str]
    parsed: ParsedNeedOut


class TranscribeOut(BaseModel):
    """Sortie de l'endpoint Whisper — texte transcrit du buffer audio."""

    text: str
    locale: str
    engine: str = "openai-whisper-1"


# ── Profil client (« mon profil ») ───────────────────────────────────────
class ClientMeProfileOut(BaseModel):
    """Profil CRM du client connecté — vue lecture pour le portail."""

    id: uuid.UUID
    type: str
    first_name: str | None
    last_name: str | None
    company_name: str | None
    email: str | None
    phone: str | None
    phone2: str | None
    nationality: str | None
    country_of_residence: str | None
    budget_min: float | None
    budget_max: float | None
    preferred_property_type: str | None
    preferred_location: str | None
    # Langue préférée — portée par le compte User, attachée dynamiquement.
    preferred_language: str = "en"
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClientMeProfileUpdate(BaseModel):
    """Champs que le client peut modifier lui-même depuis le portail.

    Exclut volontairement : type, source, assigned_agent_id, notes — ce sont
    des attributs métier réservés aux agents/managers du back-office.
    Email exclu aussi : c'est l'identifiant de connexion (changer le User
    d'abord).
    """

    first_name: str | None = Field(default=None, max_length=150)
    last_name: str | None = Field(default=None, max_length=150)
    company_name: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    phone2: str | None = Field(default=None, max_length=50)
    nationality: str | None = Field(default=None, max_length=100)
    country_of_residence: str | None = Field(default=None, max_length=100)
    budget_min: float | None = Field(default=None, ge=0)
    budget_max: float | None = Field(default=None, ge=0)
    preferred_property_type: str | None = Field(default=None, max_length=50)
    preferred_location: str | None = Field(default=None, max_length=150)
    # Langue préférée du compte (ar/en/fr) — appliquée au User, pas au Client.
    preferred_language: str | None = Field(default=None, pattern="^(ar|en|fr)$")
