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

/** GET JSON ; lève `Error(detail|error|fallback)` si la réponse n'est pas ok. */
export async function getJson<T>(url: string, fallback = "load_failed"): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
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
