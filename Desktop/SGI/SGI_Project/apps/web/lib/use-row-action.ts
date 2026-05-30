"use client";

import { useCallback, useState } from "react";

import { extractError, postJson } from "./api-client";

/**
 * Hook d'action de ligne (wiring écriture / lot B) : POST vers un endpoint
 * d'action, puis callback (ex. reload de la liste). Expose la clé en cours
 * (`busy`) et l'erreur de la dernière action.
 */
export function useRowAction(onDone: () => void): {
  busy: string | null;
  error: string | null;
  run: (key: string, url: string, body?: unknown) => Promise<void>;
} {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (key: string, url: string, body?: unknown) => {
      setBusy(key);
      setError(null);
      try {
        const res = await postJson(url, body ?? {});
        if (!res.ok) {
          setError(await extractError(res, "action_failed"));
          return;
        }
        onDone();
      } catch {
        setError("action_failed");
      } finally {
        setBusy(null);
      }
    },
    [onDone],
  );

  return { busy, error, run };
}
