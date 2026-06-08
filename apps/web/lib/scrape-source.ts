/**
 * Détection de la source d'une URL d'annonce immobilière (Bayut / PropertyFinder
 * / Dubizzle). Logique pure, réutilisée par l'UI d'import pour valider l'URL
 * avant l'appel réseau et afficher un badge de source. Le backend re-valide via
 * une allowlist d'hôtes (ScrapeRequest) — c'est la garde qui fait foi.
 */

export type ScrapeSource = "bayut" | "propertyfinder" | "dubizzle";

// Miroir EXACT de l'allowlist backend (`scraping/schemas.py` `_ALLOWED_HOSTS`,
// match d'hôte exact). Garder synchronisé : si le backend élargit la liste
// (ex. sous-domaines régionaux Dubizzle), répliquer ici. Le backend reste la
// garde qui fait foi (anti-SSRF) ; ce miroir n'est qu'une UX cohérente.
const ALLOWED_HOSTS: Record<string, ScrapeSource> = {
  "bayut.com": "bayut",
  "www.bayut.com": "bayut",
  "propertyfinder.ae": "propertyfinder",
  "www.propertyfinder.ae": "propertyfinder",
  "dubizzle.com": "dubizzle",
  "uae.dubizzle.com": "dubizzle",
};

/** Renvoie la source détectée, ou null si l'URL est invalide ou non supportée. */
export function detectScrapeSource(rawUrl: string): ScrapeSource | null {
  let host: string;
  try {
    const u = new URL(rawUrl.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    host = u.hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
  return ALLOWED_HOSTS[host] ?? null;
}

/** Vrai si l'URL pointe vers un site d'annonce supporté. */
export function isSupportedListingUrl(rawUrl: string): boolean {
  return detectScrapeSource(rawUrl) !== null;
}
