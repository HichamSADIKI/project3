from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, HttpUrl, field_validator


class ScrapeRequest(BaseModel):
    url: HttpUrl

    @field_validator("url")
    @classmethod
    def url_must_be_http(cls, v: HttpUrl) -> HttpUrl:
        if v.scheme not in ("http", "https"):
            raise ValueError("URL must use http or https")
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
