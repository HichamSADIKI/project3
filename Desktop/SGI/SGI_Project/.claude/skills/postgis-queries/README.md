# Skill : postgis-queries
# PostGIS — Géospatial Natif PostgreSQL

## Quand charger ce skill

- Définition ou migration du modèle `properties`
- Écriture de requêtes géospatiales (rayon, distance, bbox)
- Geocodage via Google Maps API
- Debug de performances sur index GIST
- Export GeoJSON pour la carte frontend

---

## Règles fondamentales

| Règle | Détail |
|---|---|
| Colonne | `location GEOMETRY(Point, 4326)` — jamais deux colonnes `lat/lng` float |
| Index | `USING GIST(location)` — obligatoire, sinon full-scan sur chaque requête géo |
| Distance | Toujours caster `::geography` (résultat en mètres) — `::geometry` retourne des degrés |
| Geocodage | Une seule fois à la création, résultat stocké en base |

---

## Migration de référence

```sql
-- Extension (à activer une seule fois par base)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Colonne sur properties
ALTER TABLE properties
  ADD COLUMN location GEOMETRY(Point, 4326);

-- Index GIST (obligatoire)
CREATE INDEX idx_properties_location
  ON properties USING GIST(location);

-- Insérer un point (lng, lat — ordre GeoJSON)
UPDATE properties
  SET location = ST_MakePoint(55.2708, 25.2048)  -- Dubai Marina
  WHERE id = :id;
```

---

## Requête par rayon (template de référence)

```sql
SELECT
  id,
  title_ar,
  title_en,
  price,
  ST_AsGeoJSON(location)::json        AS geo,
  ST_Distance(
    location::geography,
    ST_MakePoint(:lng, :lat)::geography
  )                                    AS dist_m
FROM properties
WHERE
  company_id  = :cid
  AND deleted_at IS NULL
  AND ST_DWithin(
    location::geography,
    ST_MakePoint(:lng, :lat)::geography,
    :radius_m                          -- en mètres
  )
ORDER BY dist_m
LIMIT :n;
```

---

## Requête SQLAlchemy async (pattern service)

```python
from sqlalchemy import text, select
from geoalchemy2.functions import ST_DWithin, ST_Distance, ST_MakePoint, ST_AsGeoJSON
from geoalchemy2.types import Geography

async def search_by_radius(
    db: AsyncSession,
    company_id: str,
    lat: float,
    lng: float,
    radius_m: float = 5000,
    limit: int = 20,
) -> list[dict]:
    point = func.ST_MakePoint(lng, lat)

    stmt = (
        select(
            Property,
            func.ST_AsGeoJSON(Property.location).label("geo"),
            func.ST_Distance(
                Property.location.cast(Geography),
                point.cast(Geography),
            ).label("dist_m"),
        )
        .where(Property.company_id == company_id)
        .where(Property.deleted_at.is_(None))
        .where(
            func.ST_DWithin(
                Property.location.cast(Geography),
                point.cast(Geography),
                radius_m,
            )
        )
        .order_by("dist_m")
        .limit(limit)
    )

    result = await db.execute(stmt)
    return result.mappings().all()
```

---

## Geocodage Google Maps (une seule fois à la création)

```python
# app/services/geocoder.py
import httpx
from app.core.config import settings

async def geocode_address(address: str) -> tuple[float, float] | None:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={"address": address, "key": settings.GOOGLE_MAPS_API_KEY},
        )
    data = resp.json()
    if data["status"] != "OK":
        return None
    loc = data["results"][0]["geometry"]["location"]
    return loc["lat"], loc["lng"]  # retourne (lat, lng)

# Usage dans le service properties
async def create_property(db, company_id, payload):
    coords = await geocode_address(payload.address)
    location = None
    if coords:
        lat, lng = coords
        location = f"SRID=4326;POINT({lng} {lat})"  # WKT — ordre (lng lat)
    # ...
```

---

## Export GeoJSON pour la carte frontend

```python
# Format attendu par Mapbox / Leaflet / Google Maps JS
async def get_properties_geojson(db, company_id):
    rows = await search_by_radius(db, company_id, lat=25.2048, lng=55.2708, radius_m=50000)
    features = [
        {
            "type": "Feature",
            "geometry": json.loads(row["geo"]),
            "properties": {
                "id": str(row.Property.id),
                "title": row.Property.title_en,
                "price": str(row.Property.price),
            },
        }
        for row in rows
    ]
    return {"type": "FeatureCollection", "features": features}
```

---

## Requêtes utiles de diagnostic

```sql
-- Vérifier que l'index GIST est utilisé (EXPLAIN)
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM properties
WHERE ST_DWithin(
  location::geography,
  ST_MakePoint(55.2708, 25.2048)::geography,
  5000
);
-- Doit afficher "Index Scan using idx_properties_location"

-- Vérifier les propriétés sans coordonnées
SELECT id, title_en FROM properties
WHERE location IS NULL AND deleted_at IS NULL;

-- Nombre de propriétés par zone (bbox Dubai)
SELECT COUNT(*) FROM properties
WHERE ST_Within(
  location,
  ST_MakeEnvelope(54.9, 24.8, 55.6, 25.4, 4326)
);
```

---

## Anti-patterns

```python
# ❌ Stocker lat/lng en float — PostGIS non utilisé
class Property(Base):
    lat = Column(Float)
    lng = Column(Float)

# ❌ Distance en degrés (résultat sans unité physique)
ST_Distance(location, ST_MakePoint(:lng, :lat))

# ❌ Geocoder à chaque lecture — coûteux et lent
async def get_property(id):
    prop = await db.get(Property, id)
    coords = await geocode_address(prop.address)  # ← jamais ici

# ❌ Ordre lat/lng inversé (erreur courante GeoJSON = lng, lat)
ST_MakePoint(lat, lng)  # faux
ST_MakePoint(lng, lat)  # correct
```
