/**
 * Vitrine immobilière publique — types du contrat API public + formatteurs.
 *
 * Contrat API (GET /api/v1/public/listings, /listings/{slug}, /stats) — forme
 * fournie par l'agent backend. Tous les champs sont marqués optionnels et le
 * code consommateur utilise l'optional chaining (code défensif : la forme
 * exacte peut évoluer, on ne casse jamais le rendu).
 */

export interface PublicAgent {
  name?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
}

export interface PublicAgentProfile {
  slug: string;
  name: string;
  title?: string | null;
  photo_url?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  bio?: string | null;
}

export interface PublicListing {
  slug?: string;
  title?: string | null;
  deal?: "sale" | "rent" | string | null;
  price?: number | string | null;
  price_period?: "year" | "month" | string | null;
  unit_type?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  area_sqm?: number | string | null;
  city?: string | null;
  emirate?: string | null;
  district?: string | null;
  photos?: string[] | null;
  is_featured?: boolean | null;
  is_urgent?: boolean | null;
  lat?: number | null;
  lng?: number | null;
  agent?: PublicAgent | null;
}

export interface PublicListingDetail extends PublicListing {
  description?: string | null;
  reference?: string | null;
  parking?: number | null;
  furnished?: boolean | null;
  floor?: number | string | null;
  view?: string | null;
  completion?: string | null;
  year_built?: number | null;
  balcony?: boolean | null;
  maid_room?: boolean | null;
  study_room?: boolean | null;
  pets_allowed?: boolean | null;
  amenities?: string[] | null;
  developer?: string | null;
  available_from?: string | null;
  similar?: PublicListing[] | null;
}

export interface PublicStats {
  for_sale?: number | null;
  for_rent?: number | null;
  cities?: number | null;
  listings?: number | null;
}

export interface PublicMeta {
  total?: number;
  page?: number;
  limit?: number;
}

export interface PublicEnvelope<T> {
  success?: boolean;
  data?: T;
  meta?: PublicMeta;
}

/** Format AED — toujours chiffres latins (en-AE), pas de décimales. */
export function formatAed(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Nombre en chiffres latins (en-AE). */
export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-AE").format(n);
}

/** Conversion m² → pieds² (sqft) pour l'affichage UAE, arrondi. */
export function sqmToSqft(sqm: number | string | null | undefined): number | null {
  if (sqm === null || sqm === undefined || sqm === "") return null;
  const n = typeof sqm === "string" ? Number(sqm) : sqm;
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10.7639);
}

/** Surface affichée en sqft + chiffres latins. */
export function formatSqft(sqm: number | string | null | undefined): string | null {
  const sqft = sqmToSqft(sqm);
  if (sqft === null) return null;
  return new Intl.NumberFormat("en-AE").format(sqft);
}

/** Construit une URL wa.me à partir d'un numéro (retire tout sauf chiffres). */
export function waMeLink(whatsapp: string | null | undefined): string | null {
  if (!whatsapp) return null;
  const digits = whatsapp.replace(/[^\d]/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}
