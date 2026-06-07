"use client";

/**
 * Store « Self-Defense » — mode local à l'onglet (radar / avion / dôme).
 *
 * - Singleton module (lisible SANS React via `isDomeActive()` — garde d'écritures
 *   de api-client) + hook React `useSelfDefense` (useSyncExternalStore).
 * - `mode` persisté en `localStorage` (la page reste teintée/figée après reload).
 *   `locked` est en mémoire seulement (reflet de la dernière réponse serveur ; le
 *   vrai verrouillage est côté backend, par utilisateur).
 * - La VALIDATION du code est faite côté **backend** (`verifyBackend`) — codes hashés,
 *   verrouillage serveur. Plus de code en dur côté client.
 * - Chaque transition émet un événement d'audit (best-effort) — jamais le code.
 */

import { useSyncExternalStore } from "react";

export type SelfDefenseMode = "radar" | "avion" | "dome";
export type SelfDefensePurpose = "arm" | "disarm";

type State = { mode: SelfDefenseMode | null; locked: boolean };

const KEY = "sgi_self_defense_mode_v2";
const DEFAULT_STATE: State = { mode: null, locked: false };

let state: State = DEFAULT_STATE;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as { mode?: SelfDefenseMode | null };
      state = { mode: p.mode ?? null, locked: false };
    }
  } catch {
    /* storage indisponible : état par défaut */
  }
}

function persist(): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ mode: state.mode }));
  } catch {
    /* ignore */
  }
}

function emit(): void {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): State {
  hydrate();
  return state;
}

function getServerSnapshot(): State {
  return DEFAULT_STATE;
}

/** Émet un événement d'audit (best-effort) — jamais le code. */
function recordEvent(action: string, mode: SelfDefenseMode | null): void {
  try {
    void fetch("/api/admin/self-defense", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mode ? { action, mode } : { action }),
    });
  } catch {
    /* best-effort */
  }
}

/** Applique un mode (ou désarme avec `null`). Persiste + audit. */
export function setMode(target: SelfDefenseMode | null): void {
  hydrate();
  state = { mode: target, locked: false };
  persist();
  emit();
  recordEvent(target ? `mode_${target}` : "disarm", target);
}

/** Reflète l'état de verrouillage serveur (déclenche l'écran de verrouillage). */
export function setLocked(value: boolean): void {
  hydrate();
  state = { mode: state.mode, locked: value };
  emit();
}

/** Lecture impérative (hors React) — garde d'écritures de api-client. */
export function isDomeActive(): boolean {
  hydrate();
  return state.mode === "dome";
}

/** Indique au dock si un code est requis (lu côté serveur). */
export async function fetchStatus(): Promise<{
  armgate_enabled: boolean;
  arm_required: boolean;
  disarm_required: boolean;
}> {
  try {
    const res = await fetch("/api/admin/self-defense/status", { cache: "no-store" });
    if (res.ok) return (await res.json()) as never;
  } catch {
    /* best-effort */
  }
  return { armgate_enabled: true, arm_required: false, disarm_required: false };
}

/** Validation du code côté backend (codes hashés + verrouillage serveur). */
export async function verifyBackend(
  purpose: SelfDefensePurpose,
  code: string,
): Promise<{ ok: boolean; locked: boolean; attempts_left: number }> {
  try {
    const res = await fetch("/api/admin/self-defense/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose, code }),
    });
    if (res.ok) return (await res.json()) as never;
  } catch {
    /* réseau KO */
  }
  return { ok: false, locked: false, attempts_left: 0 };
}

/** Hook React : état réactif + actions. */
export function useSelfDefense(): {
  mode: SelfDefenseMode | null;
  locked: boolean;
  setMode: (target: SelfDefenseMode | null) => void;
  setLocked: (value: boolean) => void;
} {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { mode: snap.mode, locked: snap.locked, setMode, setLocked };
}
