/**
 * Helpers fetch côté client (back-office).
 *
 * Centralise l'extraction d'erreur (`detail` ?? `error`) et les appels JSON
 * vers les route handlers Next.js `/api/**` (qui relaient ensuite vers FastAPI
 * via [lib/api-proxy.ts]). À utiliser depuis les Client Components.
 */

/** Extrait un code d'erreur lisible du corps JSON d'une réponse non-ok. */
export async function extractError(
  res: Response,
  fallback = "load_failed",
): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as {
    detail?: string;
    error?: string;
  };
  return data.detail ?? data.error ?? fallback;
}

/**
 * Session définitivement expirée : on recharge vers la racine, qui remonte
 * l'écran de login (l'état `screen` repart à "login").
 */
function handleUnauthenticated(): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== "/") window.location.href = "/";
  else window.location.reload();
}

/**
 * Tente un refresh transparent (rotation du refresh token côté serveur).
 * Single-flight : les requêtes concurrentes qui prennent un 401 en même temps
 * partagent UN seul appel `/api/auth/refresh` au lieu d'en déclencher N.
 * Retourne true si la session a été renouvelée.
 */
let refreshInFlight: Promise<boolean> | null = null;

function tryRefresh(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (!refreshInFlight) {
    refreshInFlight = fetch("/api/auth/refresh", { method: "POST", cache: "no-store" })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/**
 * GET JSON ; lève `Error(detail|error|fallback)` si la réponse n'est pas ok.
 * Sur 401 (access JWT expiré), tente un refresh transparent puis rejoue **une
 * fois** la requête avant d'abandonner vers le login.
 */
export async function getJson<T>(url: string, fallback = "load_failed"): Promise<T> {
  let res = await fetch(url, { cache: "no-store" });
  if (res.status === 401) {
    if (await tryRefresh()) {
      res = await fetch(url, { cache: "no-store" });
    }
    if (res.status === 401) {
      handleUnauthenticated();
      throw new Error("unauthenticated");
    }
  }
  if (!res.ok) throw new Error(await extractError(res, fallback));
  return (await res.json()) as T;
}

/**
 * POST JSON ; renvoie la `Response` brute — au caller de gérer `!ok` (les
 * écrans diffèrent : throw vs message d'erreur inline).
 */
export function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
