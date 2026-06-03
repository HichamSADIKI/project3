"use client";

/**
 * Socle de permissions côté frontend (IAM).
 *
 * Hydrate depuis `GET /api/admin/iam/me/permissions` (résolu côté backend par le
 * moteur d'héritage). Sert au gating de la navigation, des écrans et des champs
 * (`<Can node="…">`). Implémenté en React Context (le projet n'utilise pas de
 * store externe — même pattern que le SoftphoneProvider).
 *
 * Principe « permissif tant que non chargé » : avant l'hydratation (ou si le
 * réseau échoue), `ready=false` → tout est visible (pas de flash d'UI vide).
 * Une fois chargé, on masque ce qui est *connu* du catalogue et non autorisé ;
 * une entrée de nav non modélisée reste visible (déploiement incrémental). La
 * vraie sécurité reste côté backend (`require_permission` → 403).
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

interface Snapshot {
  ready: boolean;
  nodeAllowed: Set<string>;
  navKnown: Set<string>;
  navAllowed: Set<string>;
  screenKnown: Set<string>;
  screenAllowed: Set<string>;
}

interface PermissionsApi extends Snapshot {
  hydrate: () => Promise<void>;
  canNav: (navKey: string) => boolean;
  canScreen: (screenKey: string) => boolean;
  canNode: (nodeKey: string) => boolean;
}

const emptySnapshot = (): Snapshot => ({
  ready: false,
  nodeAllowed: new Set(),
  navKnown: new Set(),
  navAllowed: new Set(),
  screenKnown: new Set(),
  screenAllowed: new Set(),
});

// Hors provider (ou réseau KO) : permissif → la sécurité reste côté backend.
const PERMISSIVE: PermissionsApi = {
  ...emptySnapshot(),
  hydrate: async () => {},
  canNav: () => true,
  canScreen: () => true,
  canNode: () => true,
};

const Ctx = createContext<PermissionsApi | null>(null);

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [snap, setSnap] = useState<Snapshot>(emptySnapshot);

  const hydrate = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/iam/me/permissions", { cache: "no-store" });
      if (!res.ok) return; // 401 / réseau KO → reste permissif
      const j = await res.json();
      setSnap({
        ready: true,
        nodeAllowed: new Set<string>(j.allowed ?? []),
        navKnown: new Set<string>(j.nav_known ?? []),
        navAllowed: new Set<string>(j.nav_allowed ?? []),
        screenKnown: new Set<string>(j.screen_known ?? []),
        screenAllowed: new Set<string>(j.screen_allowed ?? []),
      });
    } catch {
      /* on reste permissif */
    }
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const value = useMemo<PermissionsApi>(
    () => ({
      ...snap,
      hydrate,
      canNav: (k) => !snap.ready || !snap.navKnown.has(k) || snap.navAllowed.has(k),
      canScreen: (k) => !snap.ready || !snap.screenKnown.has(k) || snap.screenAllowed.has(k),
      canNode: (k) => !snap.ready || snap.nodeAllowed.has(k),
    }),
    [snap, hydrate],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePermissions(): PermissionsApi {
  return useContext(Ctx) ?? PERMISSIVE;
}

/** Fonction de gating de nav, appelable dans une boucle (filtrage de NAV_ENTRIES). */
export function useNavGate(): (navKey: string) => boolean {
  return usePermissions().canNav;
}

/** Vrai si l'utilisateur peut voir le nœud (champ/section). Permissif avant hydratation. */
export function useCanNode(nodeKey: string): boolean {
  return usePermissions().canNode(nodeKey);
}

/** Garde déclarative d'un fragment d'UI sur un nœud du catalogue. */
export function Can({
  node,
  children,
  fallback = null,
}: {
  node: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}): React.ReactNode {
  const ok = useCanNode(node);
  return ok ? children : fallback;
}
