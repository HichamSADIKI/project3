/**
 * Helpers PURS de la carte des biens — mapping résultat de recherche par rayon
 * → marqueur Leaflet, formatage. Sans UI ni réseau, testables unitairement.
 */
import type { MapMarker } from "@/components/re-map";

export type RadiusProperty = {
  id: string;
  reference: string;
  type: string;
  title_en: string | null;
  title_fr: string | null;
  title_ar: string | null;
  price: number | string | null;
  bedrooms: number | null;
  city: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  dist_m: number;
};

/** Titre affichable d'un bien (1ʳᵉ langue dispo), repli sur la référence. */
export function propertyTitle(p: RadiusProperty): string {
  return (p.title_en || p.title_fr || p.title_ar || "").trim() || p.reference;
}

/** Prix formaté en AED (chiffres latins), ou tiret si absent. */
export function formatPriceAED(price: number | string | null): string {
  if (price === null || price === "") return "—";
  const n = typeof price === "string" ? Number(price) : price;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Distance lisible : mètres si < 1 km, sinon kilomètres à 1 décimale. */
export function formatDistance(distM: number): string {
  if (!Number.isFinite(distM) || distM < 0) return "";
  return distM < 1000 ? `${Math.round(distM)} m` : `${(distM / 1000).toFixed(1)} km`;
}

/**
 * Convertit les biens d'une recherche par rayon en marqueurs carte. Exclut ceux
 * sans coordonnées (location NULL → non géolocalisable).
 */
export function toMarkers(properties: RadiusProperty[]): MapMarker[] {
  return properties
    .filter((p) => p.latitude !== null && p.longitude !== null)
    .map((p) => ({
      id: p.id,
      lat: p.latitude as number,
      lng: p.longitude as number,
      title: propertyTitle(p),
      subtitle: [p.city, formatPriceAED(p.price)].filter(Boolean).join(" · "),
      badge: formatDistance(p.dist_m),
    }));
}
