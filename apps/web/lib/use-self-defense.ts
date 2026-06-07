"use client";

/**
 * Store « Self-Defense » — état local à l'onglet (radar / avion / dôme).
 *
 * - Singleton module (lisible SANS React via `isDomeActive()` — utilisé par la
 *   garde d'écritures de api-client) + hook React `useSelfDefense` (useSyncExternalStore).
 * - Persistance `localStorage` (portée : ce navigateur/onglet).
 * - Code de validation « 123 » (garde-fou UX, PAS une sécurité durcie : côté client,
 *   contournable en vidant le cache). 3 échecs → session verrouillée.
 * - Chaque transition émet un événement d'audit (best-effort) via le proxy backend
 *   `/api/admin/self-defense` — le code n'est JAMAIS transmis.
 */

import { useSyncExternalStore } from "react";

export type SelfDefenseMode = "radar" | "avion" | "dome";

type State = { mode: SelfDefenseMode | null; locked: boolean; attempts: number };

const KEY = "sgi_self_defense_v1";
const DEFAULT_CODE = "123"; // garde-fou UX (cf. docstring) — non secret
export const SELF_DEFENSE_MAX_ATTEMPTS = 3;
const DEFAULT_STATE: State = { mode: null, locked: false, attempts: 0 };

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
      const p = JSON.parse(raw) as Partial<State>;
      state = {
        mode: p.mode ?? null,
        locked: Boolean(p.locked),
        attempts: typeof p.attempts === "number" ? p.attempts : 0,
      };
    }
  } catch {
    /* storage indisponible : on garde l'état par défaut */
  }
}

function persist(): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function setState(next: State): void {
  state = next;
  persist();
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

/** Émet un événement d'audit (best-effort) — jamais le code de validation. */
function recordEvent(action: string, mode: SelfDefenseMode | null): void {
  try {
    void fetch("/api/admin/self-defense", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mode ? { action, mode } : { action }),
    });
  } catch {
    /* traçabilité best-effort : ne jamais bloquer l'UI */
  }
}

/**
 * Soumet le code pour appliquer `target` (un mode) ou désarmer (`null`).
 * Retourne `{ ok, locked }`. 3 échecs cumulés → `locked` (session verrouillée).
 */
export function submitCode(
  target: SelfDefenseMode | null,
  code: string,
): { ok: boolean; locked: boolean } {
  hydrate();
  if (state.locked) return { ok: false, locked: true };

  if (code === DEFAULT_CODE) {
    setState({ mode: target, locked: false, attempts: 0 });
    recordEvent(target ? `mode_${target}` : "disarm", target);
    return { ok: true, locked: false };
  }

  const attempts = state.attempts + 1;
  const locked = attempts >= SELF_DEFENSE_MAX_ATTEMPTS;
  setState({ mode: state.mode, locked, attempts });
  recordEvent(locked ? "locked" : "code_fail", target);
  return { ok: false, locked };
}

/** Lecture impérative (hors React) — la garde d'écritures de api-client. */
export function isDomeActive(): boolean {
  hydrate();
  return state.mode === "dome";
}

/** Hook React : état réactif + actions. */
export function useSelfDefense(): {
  mode: SelfDefenseMode | null;
  locked: boolean;
  attemptsLeft: number;
  submitCode: (target: SelfDefenseMode | null, code: string) => { ok: boolean; locked: boolean };
} {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    mode: snap.mode,
    locked: snap.locked,
    attemptsLeft: Math.max(0, SELF_DEFENSE_MAX_ATTEMPTS - snap.attempts),
    submitCode,
  };
}
