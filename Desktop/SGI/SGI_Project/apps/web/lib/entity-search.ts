/**
 * Recherche d'entités live (biens · clients · contrats) pour la palette globale.
 * Backend : `GET /api/admin/search` (Meilisearch si peuplé, repli DB ILIKE).
 *
 * Ce module isole la logique PURE (mapping hit → item de palette) du hook React
 * pour qu'elle soit testable sans rendu.
 */
import { useEffect, useState } from "react";

import { getJson } from "./api-client";
import type { SearchItem } from "./search-index";

export type EntityHit = {
  entity_type: string; // "property" | "client" | "contract"
  id: string;
  label: string;
  subtitle: string | null;
  reference: string | null;
};

/** Écran cible de la palette pour un type d'entité. */
export function screenForEntity(type: string): string {
  switch (type) {
    case "property":
      return "realestate";
    case "contract":
      return "realestate_contracts";
    case "client":
      return "personne";
    default:
      return "realestate";
  }
}

/** Emoji d'illustration d'un type d'entité. */
export function emojiForEntity(type: string): string {
  switch (type) {
    case "property":
      return "🏠";
    case "contract":
      return "📄";
    case "client":
      return "👤";
    default:
      return "🔎";
  }
}

/** Convertit les hits backend en items de palette (catégorie « result »). */
export function toSearchItems(hits: EntityHit[]): SearchItem[] {
  return hits.map((h) => ({
    id: `live-${h.entity_type}-${h.id}`,
    category: "result",
    label: h.label,
    sub: h.subtitle ?? h.reference ?? undefined,
    screen: screenForEntity(h.entity_type),
    // Les clients ouvrent l'écran filtré via onClientSearch (initialSearch).
    initialSearch: h.entity_type === "client" ? h.label : undefined,
    emoji: emojiForEntity(h.entity_type),
    keywords: "",
  }));
}

/**
 * Hook : recherche live débouncée. Renvoie les items de palette prêts à fusionner
 * avec la recherche statique. Vide tant que `query` < `minLen`.
 */
export function useEntitySearch(query: string, minLen = 2, delay = 220): SearchItem[] {
  const [items, setItems] = useState<SearchItem[]>([]);
  useEffect(() => {
    const q = query.trim();
    if (q.length < minLen) {
      setItems([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      getJson<{ data: EntityHit[] }>(`/api/admin/search?q=${encodeURIComponent(q)}&limit=6`)
        .then((r) => {
          if (!cancelled) setItems(toSearchItems(r.data ?? []));
        })
        .catch(() => {
          if (!cancelled) setItems([]);
        });
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, minLen, delay]);
  return items;
}
