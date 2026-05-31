"""HTML extraction helpers — site-specific regex patterns + generic fallbacks.

Bayut.com structure (validated 2026-05):
  - JSON-LD `application/ld+json` with @type=RealEstateListing → title, description
  - Meta description sentence, ex.:
    "N-bed, N-bath, N sqft <type> for <sale|rent> at <community>, <area> for AED <price>"
  - window.state JSON → rooms, baths, area (sqm)
  - Images: https://images.bayut.com/thumbnails/<id>-800x600.webp

Generic fallback (PropertyFinder / Dubizzle / other):
  - JSON-LD → title, description, images, price
  - Meta description / og:description → description
  - og:image → cover image
  - Price regex on page text
"""

from __future__ import annotations

import json
import re

# ── Normalisation maps ────────────────────────────────────────────────────────

PROP_TYPE_MAP: dict[str, str] = {
    "apartment": "apartment",
    "flat": "apartment",
    "studio": "apartment",
    "duplex": "apartment",
    "penthouse": "penthouse",
    "villa": "villa",
    "townhouse": "townhouse",
    "office": "office",
    "retail": "retail",
    "warehouse": "office",
    "shop": "retail",
    "residential": "apartment",
}

EMIRATE_SLUGS: dict[str, str] = {
    "dubai": "Dubai",
    "abu-dhabi": "Abu Dhabi",
    "abu_dhabi": "Abu Dhabi",
    "abudhabi": "Abu Dhabi",
    "sharjah": "Sharjah",
    "ajman": "Other",
    "ras-al-khaimah": "Other",
    "fujairah": "Other",
    "umm-al-quwain": "Other",
}


def normalise_prop_type(raw: str) -> str:
    return PROP_TYPE_MAP.get(raw.strip().lower(), "apartment")


def normalise_emirate(candidates: list[str]) -> str:
    for c in candidates:
        slug = c.strip().lower().replace(" ", "-")
        for key, val in EMIRATE_SLUGS.items():
            if key in slug:
                return val
    return "Dubai"


def _safe_int(val: object) -> str:
    try:
        return str(int(float(str(val)))) if val else ""  # type: ignore[arg-type]
    except (ValueError, TypeError):
        return ""


# ── Bayut parser (HTML regex, no JS needed) ───────────────────────────────────


def parse_bayut_html(html: str) -> dict:  # type: ignore[type-arg]
    """Extract property fields from Bayut listing HTML."""

    # 1. Title — from JSON-LD RealEstateListing block specifically
    title = ""
    jld_blocks_early = re.findall(
        r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.S
    )
    for block in jld_blocks_early:
        try:
            data = json.loads(block.strip())
            graph = data.get("@graph", [data])
            for item in graph:
                if item.get("@type") == "RealEstateListing" and item.get("name"):
                    title = (
                        item["name"].replace(" | Bayut.com", "").replace(" | bayut.com", "").strip()
                    )
                    break
        except (json.JSONDecodeError, KeyError):
            continue
        if title:
            break

    # 2. Meta description sentence (most reliable for price + specs)
    #    "2-bed, 2-bath, 1,127 sqft apartment for sale at Community, Area for AED 2,340,000"
    meta_desc = ""
    meta_m = re.search(
        r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']{20,500})["\']', html
    )
    if not meta_m:
        meta_m = re.search(
            r'<meta\s+content=["\']([^"\']{20,500})["\']\s+name=["\']description["\']', html
        )
    if meta_m:
        meta_desc = meta_m.group(1).replace("&amp;", "&")

    price = ""
    sqft = ""
    community = ""
    beds_meta = ""
    baths_meta = ""
    prop_type = "apartment"
    listing_type: str = "Sale"

    if meta_desc:
        price_m = re.search(r"AED\s*([\d,]+)", meta_desc)
        sqft_m = re.search(r"([\d,]+)\s*sqft", meta_desc)
        loc_m = re.search(r"(?:at|in)\s+([^,]+(?:,\s*[^,]+)?)\s+for\s+AED", meta_desc)
        beds_m = re.search(r"(\d+)-bed", meta_desc)
        baths_m = re.search(r"(\d+)-bath", meta_desc)
        type_m = re.search(r"sqft\s+([\w]+)\s+for\s+(sale|rent)", meta_desc, re.I)

        if price_m:
            price = price_m.group(1).replace(",", "")
        if sqft_m:
            sqft = sqft_m.group(1).replace(",", "")
        if beds_m:
            beds_meta = beds_m.group(1)
        if baths_m:
            baths_meta = baths_m.group(1)
        if type_m:
            prop_type = normalise_prop_type(type_m.group(1))
            listing_type = "Rent" if "rent" in type_m.group(2).lower() else "Sale"
        if loc_m:
            community = loc_m.group(1).strip().split(",")[0].strip()

    # 3. window.state — rooms, baths, area (sqm → sqft)
    ws_rooms = re.search(r'"rooms"\s*:\s*(\d+)', html)
    ws_baths = re.search(r'"baths"\s*:\s*(\d+)', html)
    ws_area = re.search(r'"area"\s*:\s*([\d.]+)', html)

    bedrooms = beds_meta or (ws_rooms.group(1) if ws_rooms else "")
    bathrooms = baths_meta or (ws_baths.group(1) if ws_baths else "")
    if not sqft and ws_area:
        sqft = str(int(float(ws_area.group(1)) * 10.764))  # sqm → sqft

    # 4. Location breadcrumb array
    emirate = "Dubai"
    loc_arr_m = re.search(r'"location"\s*:\s*(\[[^\]]{5,500}\])', html)
    if loc_arr_m:
        try:
            locs = json.loads(loc_arr_m.group(1))
            names = [
                loc.get("name") or loc.get("externalID") or ""
                for loc in locs
                if isinstance(loc, dict)
            ]
            emirate = normalise_emirate(names)
            if not community:
                # Use the deepest location that isn't a country/emirate name
                filtered = [
                    n
                    for n in names
                    if n.lower() not in ("uae", "dubai", "abu dhabi", "sharjah", "ae")
                ]
                community = filtered[0] if filtered else ""
        except (json.JSONDecodeError, TypeError):
            pass

    # 5. Images — Bayut CDN thumbnails, deduplicate, prefer 800x600 webp
    all_imgs = re.findall(r'(https://images\.bayut\.com/thumbnails/[^\s"\'<>]+)', html)
    # Keep only 800x600 or 400x300 — unique IDs
    seen_ids: set[str] = set()
    images: list[str] = []
    for img in all_imgs:
        img_id = re.search(r"/(\d+)-", img)
        if img_id and img_id.group(1) not in seen_ids and "800x600" in img:
            seen_ids.add(img_id.group(1))
            images.append(img)
    if not images:
        for img in all_imgs:
            img_id = re.search(r"/(\d+)-", img)
            if img_id and img_id.group(1) not in seen_ids:
                seen_ids.add(img_id.group(1))
                images.append(img)

    # 6. Full description from JSON-LD @graph
    description = ""
    jld_blocks = re.findall(
        r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.S
    )
    for block in jld_blocks:
        try:
            data = json.loads(block.strip())
            graph = data.get("@graph", [data])
            for item in graph:
                if item.get("@type") == "RealEstateListing":
                    if not title:
                        title = (item.get("name") or "").replace(" | Bayut.com", "").strip()
                    description = item.get("description") or meta_desc
                    break
        except (json.JSONDecodeError, KeyError):
            continue

    if not description:
        description = meta_desc

    return {
        "title_en": title,
        "price": price,
        "type": listing_type,
        "prop_type": prop_type,
        "bedrooms": bedrooms,
        "bathrooms": bathrooms,
        "sqft": sqft,
        "emirate": emirate,
        "community": community,
        "description": description[:2000],
        "images": images[:8],
        "source": "Bayut.com",
    }


# ── PropertyFinder parser ─────────────────────────────────────────────────────


def parse_propertyfinder_html(html: str) -> dict:  # type: ignore[type-arg]
    """Extract from PropertyFinder listing HTML via __NEXT_DATA__ + meta fallback."""
    result: dict = {
        "source": "PropertyFinder.ae",
        "images": [],
        "type": "Sale",
        "prop_type": "apartment",
    }  # type: ignore[type-arg]

    # Primary: __NEXT_DATA__ contains the full structured property object
    nd_m = re.search(r'id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>', html, re.S)
    if nd_m:
        try:
            nd = json.loads(nd_m.group(1))
            prop = nd["props"]["pageProps"]["propertyResult"]["property"]

            result["title_en"] = (prop.get("title") or "").strip()
            result["description"] = (prop.get("description") or "")[:2000]

            price_obj = prop.get("price") or {}
            if price_obj.get("value"):
                result["price"] = str(int(price_obj["value"]))

            result["bedrooms"] = _safe_int(prop.get("bedrooms"))
            result["bathrooms"] = _safe_int(prop.get("bathrooms"))

            size_obj = prop.get("size") or {}
            if size_obj.get("value"):
                sqft_val = size_obj["value"]
                if size_obj.get("unit", "sqft").lower() == "sqm":
                    sqft_val = int(float(sqft_val) * 10.764)
                result["sqft"] = str(int(sqft_val))

            # category_id: 1 = buy (Sale), 2 = rent
            result["type"] = "Rent" if prop.get("category_id") == 2 else "Sale"

            prop_type_raw = prop.get("property_type") or ""
            result["prop_type"] = normalise_prop_type(prop_type_raw)

            # Location tree: CITY → COMMUNITY → SUBCOMMUNITY → TOWER
            loc_tree = prop.get("location_tree") or []
            emirate_candidates = [n.get("name", "") for n in loc_tree]
            result["emirate"] = normalise_emirate(emirate_candidates)
            community_nodes = [
                n for n in loc_tree if n.get("type") in ("COMMUNITY", "SUBCOMMUNITY")
            ]
            if community_nodes:
                result["community"] = community_nodes[0]["name"]

            # Images: use 'full' size from images.property array
            imgs_dict = prop.get("images") or {}
            prop_imgs = imgs_dict.get("property") or []
            result["images"] = [
                img["full"] for img in prop_imgs[:8] if isinstance(img, dict) and img.get("full")
            ]
        except (KeyError, TypeError, ValueError, json.JSONDecodeError):
            pass

    # Fallback: meta description for any missing fields
    meta_m = re.search(
        r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']{10,500})["\']', html
    )
    if not meta_m:
        meta_m = re.search(
            r'<meta\s+content=["\']([^"\']{10,500})["\']\s+name=["\']description["\']', html
        )
    if meta_m:
        meta_desc = meta_m.group(1).replace("&amp;", "&")
        if not result.get("description"):
            result["description"] = meta_desc
        sqft_m = re.search(r"([\d,]+)\s*sqft", meta_desc)
        if sqft_m and not result.get("sqft"):
            result["sqft"] = sqft_m.group(1).replace(",", "")
        if not result.get("price"):
            pm = re.search(r"AED\s*([\d,]+)", meta_desc)
            if pm:
                result["price"] = pm.group(1).replace(",", "")

    # OG title fallback
    if not result.get("title_en"):
        og_title = re.search(
            r'<meta\s+property=["\']og:title["\']\s+content=["\']([^"\']+)["\']', html
        )
        if og_title:
            result["title_en"] = og_title.group(1).strip()

    # OG image fallback
    if not result.get("images"):
        og_img = re.search(
            r'<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']', html
        )
        if og_img:
            result["images"] = [og_img.group(1)]

    return result


# ── Dubizzle parser ───────────────────────────────────────────────────────────


def parse_dubizzle_html(html: str) -> dict:  # type: ignore[type-arg]
    return _parse_generic_html(html, "Dubizzle.com")


# ── Generic HTML extractor ────────────────────────────────────────────────────


def _parse_generic_html(
    html: str,
    source: str,
    extra_meta_parser=None,  # type: ignore[assignment]
) -> dict:  # type: ignore[type-arg]
    """JSON-LD + meta description + OG tags — works on any well-structured page."""
    result: dict = {"source": source, "images": [], "type": "Sale", "prop_type": "apartment"}  # type: ignore[type-arg]

    # JSON-LD
    jld_blocks = re.findall(
        r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.S
    )
    for block in jld_blocks:
        try:
            data = json.loads(block.strip())
            graph = data.get("@graph", [data])
            for item in graph:
                raw_t = item.get("@type", "")
                types = raw_t if isinstance(raw_t, list) else [raw_t]
                known_types = {
                    "Product",
                    "Apartment",
                    "House",
                    "Accommodation",
                    "RealEstateListing",
                    "LodgingBusiness",
                    "SingleFamilyResidence",
                }
                if not any(str(t) in known_types for t in types):
                    continue
                if not result.get("title_en"):
                    result["title_en"] = (item.get("name") or item.get("headline") or "").strip()
                if not result.get("description"):
                    result["description"] = (item.get("description") or "")[:2000]
                offers = item.get("offers") or {}
                if offers and not result.get("price"):
                    result["price"] = _safe_int(offers.get("price"))
                imgs = item.get("image") or []
                if imgs and not result["images"]:
                    result["images"] = ([imgs] if isinstance(imgs, str) else list(imgs))[:8]
                if item.get("numberOfBedrooms"):
                    result["bedrooms"] = _safe_int(item["numberOfBedrooms"])
        except (json.JSONDecodeError, KeyError):
            continue

    # Meta description
    meta_m = re.search(
        r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']{10,500})["\']', html
    )
    if not meta_m:
        meta_m = re.search(
            r'<meta\s+content=["\']([^"\']{10,500})["\']\s+name=["\']description["\']', html
        )
    if meta_m:
        meta_desc = meta_m.group(1).replace("&amp;", "&")
        if not result.get("description"):
            result["description"] = meta_desc
        if extra_meta_parser:
            result.update({k: v for k, v in extra_meta_parser(meta_desc).items() if v})
        if not result.get("price"):
            pm = re.search(r"AED\s*([\d,]+)", meta_desc)
            if pm:
                result["price"] = pm.group(1).replace(",", "")

    # OG title fallback
    if not result.get("title_en"):
        og_title = re.search(
            r'<meta\s+property=["\']og:title["\']\s+content=["\']([^"\']+)["\']', html
        )
        if og_title:
            result["title_en"] = og_title.group(1).strip()

    # OG image fallback
    if not result.get("images"):
        og_img = re.search(
            r'<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']', html
        )
        if og_img:
            result["images"] = [og_img.group(1)]

    # Price anywhere on page
    if not result.get("price"):
        pm = re.search(r"AED\s*([\d,]{5,})", html)
        if pm:
            result["price"] = pm.group(1).replace(",", "")

    return result
