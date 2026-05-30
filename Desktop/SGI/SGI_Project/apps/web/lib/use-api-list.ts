"use client";

import { useEffect, useState } from "react";

import { getJson } from "./api-client";

/**
 * Hook de chargement d'une liste depuis un endpoint admin (proxy → FastAPI).
 * Attend l'enveloppe standard `{ success, data, meta }`. Renvoie items + états.
 */
export function useApiList<T>(url: string): {
  items: T[];
  loading: boolean;
  error: string | null;
} {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getJson<{ data: T[] }>(url)
      .then((r) => {
        if (!cancelled) {
          setItems(r.data ?? []);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "load_failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { items, loading, error };
}
