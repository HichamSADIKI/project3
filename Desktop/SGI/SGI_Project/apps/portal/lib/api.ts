/**
 * SGI Portal — client API léger côté navigateur.
 *
 * Appelle les route handlers Next.js (/api/proxy/*) qui propagent le cookie
 * httpOnly et ajoutent le Bearer token côté serveur. Le JWT n'est jamais
 * exposé au JS du navigateur.
 *
 * Pour le code serveur (Server Components, route handlers), utiliser
 * `lib/api-server.ts` qui dépend de `next/headers`.
 */
export class ApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail);
  }
}

export async function apiClient<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");

  const res = await fetch(path, {
    ...init,
    headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });

  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      detail =
        (JSON.parse(text) as { error?: string; detail?: string }).error ??
        (JSON.parse(text) as { error?: string; detail?: string }).detail ??
        text;
    } catch {
      /* leave as text */
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * POST FormData (multipart) vers un route handler dédié. Ne fixe PAS le
 * Content-Type : le navigateur ajoute le boundary multipart automatiquement.
 * Renvoie la `Response` brute — chaque écran gère `!ok` à sa façon (les codes
 * d'erreur diffèrent : 413 audio, 503 Whisper, etc.).
 */
export function postFormData(path: string, data: FormData): Promise<Response> {
  return fetch(path, { method: "POST", body: data });
}
