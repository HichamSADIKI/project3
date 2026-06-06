"""Schémas Pydantic v2 — vitrine publique.

⚠️ SÉCURITÉ : ces sorties sont SERVIES SANS AUTHENTIFICATION. Elles ne doivent
contenir AUCUN champ interne/financier sensible (coûts internes, marges,
commissions, références internes, ids d'agents privés, données d'autres tenants).
Seuls les champs strictement « marketing » destinés au grand public figurent ici.
"""

import uuid
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field, field_validator

# ── Bloc agent public (jamais d'identité d'agent interne) ────────────────────


class PublicAgentOut(BaseModel):
    """Contact public de l'agence — dérivé de la succursale, pas d'un agent privé."""

    name: str | None = None
    phone: str | None = None
    whatsapp: str | None = None
    email: str | None = None


# ── Annonce (liste) ──────────────────────────────────────────────────────────


class PublicListingOut(BaseModel):
    slug: str
    deal: str  # "sale" | "rent"
    title: str | None = None
    price: Decimal
    price_period: str | None = None  # "year" pour la location, None pour la vente
    currency: str = "AED"
    unit_type: str | None = None
    bedrooms: int | None = None
    bathrooms: int | None = None
    area_sqm: Decimal | None = None
    city: str | None = None
    district: str | None = None
    emirate: str | None = None
    photos: list[str] = Field(default_factory=list)
    cover_photo: str | None = None
    is_featured: bool = False
    is_urgent: bool = False
    lat: float | None = None
    lng: float | None = None


# ── Annonce (détail) ───────────────────────────────────────────────────────


class PublicListingDetailOut(PublicListingOut):
    title_ar: str | None = None
    title_en: str | None = None
    title_fr: str | None = None
    parking_spaces: int | None = None
    furnished: bool | None = None
    building_name: str | None = None
    year_built: int | None = None
    developer: str | None = None
    reference: str | None = None  # référence publique de l'annonce (non sensible)
    agent: PublicAgentOut | None = None


# ── Stats home ───────────────────────────────────────────────────────────────


class PublicStatsOut(BaseModel):
    sale_count: int = 0
    rent_count: int = 0
    total_count: int = 0


# ── Profils agents publics ──────────────────────────────────────────────────


class PublicAgentProfile(BaseModel):
    slug: str
    name: str
    title: str | None = None
    photo_url: str | None = None
    phone: str | None = None
    whatsapp: str | None = None
    email: str | None = None


class PublicAgentProfileDetail(PublicAgentProfile):
    bio: str | None = None


# ── Capture de lead ──────────────────────────────────────────────────────────


class PublicLeadContact(BaseModel):
    # `str` borné plutôt que des types laxistes : validation stricte, anti-injection
    # (longueurs bornées, trim). Pydantic rejette → 422 propre, jamais 500.
    name: str | None = Field(default=None, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)

    @field_validator("name", "phone")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("phone")
    @classmethod
    def _phone_charset(cls, v: str | None) -> str | None:
        # N'autorise que des caractères de numéro de téléphone plausibles.
        if v is None:
            return None
        if not all(c.isdigit() or c in "+-() " for c in v):
            raise ValueError("invalid_phone")
        return v


class PublicLeadBody(BaseModel):
    contact: PublicLeadContact
    listing_slug: str | None = Field(default=None, max_length=255)
    message: str | None = Field(default=None, max_length=2000)

    @field_validator("message")
    @classmethod
    def _strip_msg(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


# ── Enveloppes standard {success, data, meta} ────────────────────────────────


class ListingsListOut(BaseModel):
    success: bool = True
    data: list[PublicListingOut]
    meta: dict


class ListingDetailEnvelope(BaseModel):
    success: bool = True
    data: PublicListingDetailOut


class StatsEnvelope(BaseModel):
    success: bool = True
    data: PublicStatsOut


class AgentsListEnvelope(BaseModel):
    success: bool = True
    data: list[PublicAgentProfile]


class AgentDetailEnvelope(BaseModel):
    success: bool = True
    data: PublicAgentProfileDetail
    listings: list[PublicListingOut] = Field(default_factory=list)


class LeadCreatedOut(BaseModel):
    success: bool = True
    data: dict


# Identifiant public renvoyé après capture (jamais l'id CRM interne ni le client).
class LeadAck(BaseModel):
    received: bool = True
    reference: uuid.UUID | None = None  # non sensible : accusé de réception
