"use client";

/**
 * Heartbeat de présence : chaque navigateur authentifié signale périodiquement sa
 * session + la page courante (catégorie/sous-catégorie/page) au backend, qui résout
 * la géo de l'IP (local, PDPL-safe) et tient les sessions actives pour la surveillance.
 *
 * Best-effort : un échec (déconnecté, réseau) n'a aucun impact UI. À monter dans la
 * coquille authentifiée uniquement.
 */

import { useCallback, useEffect, useRef } from "react";

const SK = "sgi_presence_session_v1";

function getSessionKey(): string {
  const gen = (): string => `s-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  try {
    let k = localStorage.getItem(SK);
    if (!k) {
      k = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : gen();
      localStorage.setItem(SK, k);
    }
    return k;
  } catch {
    return gen();
  }
}

export type PresenceNav = {
  category?: string | null;
  subcategory?: string | null;
  page?: string | null;
};

export function usePresenceHeartbeat(nav: PresenceNav): void {
  const navRef = useRef<PresenceNav>(nav);
  navRef.current = nav;

  const beat = useCallback((n: PresenceNav) => {
    try {
      void fetch("/api/presence/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_key: getSessionKey(),
          category: n.category ?? null,
          subcategory: n.subcategory ?? null,
          page: n.page ?? null,
        }),
      });
    } catch {
      /* best-effort */
    }
  }, []);

  // Battement périodique.
  useEffect(() => {
    beat(navRef.current);
    const id = window.setInterval(() => beat(navRef.current), 15000);
    return () => window.clearInterval(id);
  }, [beat]);

  // Battement immédiat au changement de page.
  useEffect(() => {
    beat({ category: nav.category, subcategory: nav.subcategory, page: nav.page });
  }, [beat, nav.category, nav.subcategory, nav.page]);
}
