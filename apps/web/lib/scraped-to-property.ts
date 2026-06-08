/**
 * Mappe un `ScrapedProperty` (champs texte issus du scraping d'annonce) vers un
 * brouillon `PropertyCreate` postable sur /api/admin/properties. Logique pure et
 * testable : nettoie le prix (« AED 2,340,000 » → 2340000), convertit les sqft en
 * m² (area_sqm), parse chambres/SDB, valide le type. Sans coordonnées (le scrape
 * n'en fournit pas) → la fiche est créée en brouillon, à géolocaliser ensuite.
 */

export type ScrapedProperty = {
  title_en: string;
  price: string;
  prop_type: string;
  bedrooms: string;
  bathrooms: string;
  sqft: string;
  emirate: string;
  community: string;
  description: string;
  images: string[];
  source: string;
  fields_found: number;
};

export type PropertyDraft = {
  type: string;
  price: number;
  title_en?: string;
  description_en?: string;
  area_sqm?: number;
  bedrooms?: number;
  bathrooms?: number;
  city?: string;
  district?: string;
};

// Doit rester synchronisé avec le pattern backend PropertyCreate.type.
const ALLOWED_TYPES = new Set([
  "villa",
  "apartment",
  "office",
  "penthouse",
  "townhouse",
  "plot",
  "commercial",
]);

const SQFT_TO_SQM = 0.092903;

/** Extrait le 1er nombre d'une chaîne libre (gère séparateurs de milliers et décimales). */
function parseNumber(raw: string): number | null {
  if (!raw) return null;
  // Retire tout sauf chiffres, points et virgules, puis enlève les virgules (milliers).
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(/,/g, "");
  if (cleaned === "" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseIntOrNull(raw: string): number | null {
  const n = parseNumber(raw);
  if (n === null) return null;
  return Math.trunc(n);
}

/**
 * Renvoie `{ draft }` si le mapping est exploitable, sinon `{ error }`.
 * Le prix est le seul champ requis par le backend (Decimal > 0).
 */
export function scrapedToPropertyDraft(
  s: ScrapedProperty,
): { draft: PropertyDraft } | { error: "missing_price" } {
  const price = parseNumber(s.price);
  if (price === null || price <= 0) return { error: "missing_price" };

  const draft: PropertyDraft = {
    type: ALLOWED_TYPES.has(s.prop_type) ? s.prop_type : "apartment",
    price,
  };

  const title = s.title_en?.trim();
  if (title) draft.title_en = title.slice(0, 300);

  const desc = s.description?.trim();
  if (desc) draft.description_en = desc;

  const sqft = parseNumber(s.sqft);
  if (sqft !== null && sqft > 0) {
    draft.area_sqm = Math.round(sqft * SQFT_TO_SQM * 100) / 100;
  }

  const beds = parseIntOrNull(s.bedrooms);
  if (beds !== null && beds >= 0) draft.bedrooms = beds;

  const baths = parseIntOrNull(s.bathrooms);
  if (baths !== null && baths >= 0) draft.bathrooms = baths;

  const city = s.emirate?.trim();
  if (city) draft.city = city.slice(0, 100);

  const district = s.community?.trim();
  if (district) draft.district = district.slice(0, 150);

  return { draft };
}
