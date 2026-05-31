import ipaddress
from typing import Literal

from pydantic import BaseModel, HttpUrl, field_validator

# Explicit allowlist — prevents SSRF probing of internal network
_ALLOWED_HOSTS: frozenset[str] = frozenset(
    {
        "bayut.com",
        "www.bayut.com",
        "propertyfinder.ae",
        "www.propertyfinder.ae",
        "dubizzle.com",
        "uae.dubizzle.com",
    }
)


class ScrapeRequest(BaseModel):
    url: HttpUrl

    @field_validator("url")
    @classmethod
    def url_must_be_allowed(cls, v: HttpUrl) -> HttpUrl:
        if v.scheme not in ("http", "https"):
            raise ValueError("URL must use http or https")
        host = (v.host or "").lower().rstrip(".")
        # Reject private / loopback / link-local IPs
        try:
            addr = ipaddress.ip_address(host)
            if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved:
                raise ValueError("Private IP addresses are not allowed")
        except ValueError as exc:
            if "not allowed" in str(exc):
                raise
            # Not an IP — check against allowlist
            if host not in _ALLOWED_HOSTS:
                raise ValueError(
                    "Host not allowed. Supported sites: Bayut, PropertyFinder, Dubizzle"
                ) from None
        return v


class ScrapedProperty(BaseModel):
    title_en: str = ""
    price: str = ""
    type: Literal["Sale", "Rent"] = "Sale"
    prop_type: str = "apartment"
    bedrooms: str = ""
    bathrooms: str = ""
    sqft: str = ""
    emirate: str = ""
    community: str = ""
    description: str = ""
    images: list[str] = []
    source: str = ""
    fields_found: int = 0
