"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "sgi_favorites_v1";
const MAX_FAVORITES = 12;

/**
 * Hook de gestion des favoris du dashboard.
 * Persisté en localStorage, partagé entre onglets via 'storage' event.
 *
 * Les valeurs stockées sont des screen-keys (ex: "prop", "crm", "rental"…)
 * du registre SCREEN_REGISTRY de page.tsx — la liste pickable provient
 * de SEARCH_INDEX (catégorie "navigation").
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFavorites(read());
    setHydrated(true);

    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setFavorites(read());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: string[]) => {
    const clamped = next.slice(0, MAX_FAVORITES);
    setFavorites(clamped);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
    } catch {
      /* quota / private mode */
    }
  }, []);

  const isFavorite = useCallback(
    (key: string) => favorites.includes(key),
    [favorites]
  );

  const add = useCallback(
    (key: string) => {
      if (favorites.includes(key)) return;
      persist([...favorites, key]);
    },
    [favorites, persist]
  );

  const remove = useCallback(
    (key: string) => persist(favorites.filter((k) => k !== key)),
    [favorites, persist]
  );

  const toggle = useCallback(
    (key: string) => {
      if (favorites.includes(key)) remove(key);
      else add(key);
    },
    [favorites, add, remove]
  );

  const reorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      const next = [...favorites];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      persist(next);
    },
    [favorites, persist]
  );

  const clear = useCallback(() => persist([]), [persist]);

  return {
    favorites,
    hydrated,
    isFavorite,
    add,
    remove,
    toggle,
    reorder,
    clear,
    isFull: favorites.length >= MAX_FAVORITES,
    maxFavorites: MAX_FAVORITES,
  };
}

function read(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string").slice(0, MAX_FAVORITES);
  } catch {
    return [];
  }
}
