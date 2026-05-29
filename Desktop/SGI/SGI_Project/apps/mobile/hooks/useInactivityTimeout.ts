/**
 * Déconnecte automatiquement l'utilisateur après une période d'inactivité.
 * Réinitialise le minuteur sur chaque interaction (touch) et au retour de
 * l'arrière-plan ; si le temps écoulé en background dépasse le seuil, logout immédiat.
 * Le seuil (minutes) vient de `preferences.inactivityTimeoutMin` — 0 désactive.
 */
import { useCallback, useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAuthStore } from "@/stores/auth";
import { usePreferencesStore } from "@/stores/preferences";

export function useInactivityTimeout() {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const sessionWarningShown = useAuthStore((s) => s.sessionWarningShown);
  const timeoutMin = usePreferencesStore((s) => s.inactivityTimeoutMin);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const schedule = useCallback(() => {
    clear();
    if (!token || timeoutMin <= 0 || !sessionWarningShown) return;
    timerRef.current = setTimeout(() => {
      logout();
    }, timeoutMin * 60 * 1000);
  }, [clear, token, timeoutMin, sessionWarningShown, logout]);

  const reportActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (token && timeoutMin > 0 && sessionWarningShown) schedule();
  }, [token, timeoutMin, sessionWarningShown, schedule]);

  useEffect(() => {
    if (token && timeoutMin > 0 && sessionWarningShown) {
      lastActivityRef.current = Date.now();
      schedule();
    } else {
      clear();
    }
    return clear;
  }, [token, timeoutMin, sessionWarningShown, schedule, clear]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (!token || timeoutMin <= 0) return;

      if (prev.match(/active/) && next.match(/inactive|background/)) {
        clear();
      } else if (prev.match(/inactive|background/) && next === "active") {
        const elapsedMs = Date.now() - lastActivityRef.current;
        if (elapsedMs >= timeoutMin * 60 * 1000) {
          logout();
        } else {
          schedule();
        }
      }
    });
    return () => sub.remove();
  }, [token, timeoutMin, logout, schedule, clear]);

  return reportActivity;
}
