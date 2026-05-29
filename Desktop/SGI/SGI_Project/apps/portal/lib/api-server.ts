/**
 * SGI Portal — client API serveur (Server Components, route handlers).
 *
 * Stratégie : le JWT est stocké dans un cookie httpOnly `sgi-session`. Cette
 * fonction lit le cookie via `next/headers` et ajoute `Authorization: Bearer
 * <token>` à l'appel sortant vers le backend FastAPI.
 *
 * IMPORTANT : ne JAMAIS importer ce fichier depuis un Client Component — il
 * dépend de `next/headers`. Pour le code client, utiliser `lib/api-client.ts`.
 */
import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_API_URL ?? "http://api:8000";

export class ApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail);
  }
}

export async function apiServer<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const cookieStore = await cookies();
  const token = cookieStore.get("sgi-session")?.value;

  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const j = JSON.parse(text);
      detail = j.detail ?? text;
    } catch {
      /* leave as text */
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
