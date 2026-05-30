/**
 * Helpers de proxy back-office → backend FastAPI.
 *
 * Factorise le pattern répété dans les route handlers `app/api/**`:
 *   1. résolution de l'URL backend (`BACKEND_API_URL` + préfixe `/api/v1`),
 *   2. lecture du JWT dans le cookie httpOnly `sgi-session` + garde 401,
 *   3. relai authentifié (Bearer) avec propagation optionnelle des query
 *      params, et renvoi du corps/statut upstream tel quel.
 *
 * Les handlers à logique spécifique (login : rate-limit + RBAC ; logout :
 * CORS) n'utilisent que `BACKEND_URL` et gardent leur flux propre.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/** Base du backend FastAPI. En Docker : `http://api:8000` (réseau interne). */
export const BACKEND_URL = process.env.BACKEND_API_URL ?? "http://api:8000";

/** Lit le JWT backend stocké dans le cookie httpOnly `sgi-session`. */
export async function getSessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get("sgi-session")?.value ?? null;
}

/**
 * Construit l'URL upstream `${BACKEND_URL}/api/v1/{path}`.
 * Si `forwardFrom` est fourni, recopie ses query params vers l'upstream.
 */
export function backendUrl(path: string, forwardFrom?: Request): string {
  const url = new URL(`${BACKEND_URL}/api/v1/${path.replace(/^\/+/, "")}`);
  if (forwardFrom) {
    const incoming = new URL(forwardFrom.url);
    for (const [k, v] of incoming.searchParams.entries()) {
      url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

/** Relaie une réponse upstream telle quelle (corps + statut, en JSON). */
export async function relay(upstream: Response): Promise<NextResponse> {
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}

export interface ProxyOptions {
  /** Sous-chemin backend après `/api/v1/`, ex. `"clients/"` ou `"auth/pending-users"`. */
  path: string;
  /** Méthode HTTP (défaut : celle de la requête entrante). */
  method?: string;
  /** Propager les query params de la requête entrante vers l'upstream. */
  forwardQuery?: boolean;
  /**
   * Corps à transmettre. Si omis, le corps de la requête entrante est relayé
   * pour les méthodes mutantes (POST/PATCH/PUT/DELETE). Passer une chaîne
   * (déjà sérialisée) pour court-circuiter la lecture de la requête.
   */
  body?: string;
}

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * Proxy authentifié générique : garde 401, Bearer, relai du corps/statut.
 * Couvre les handlers admin sans logique métier propre.
 */
export async function proxy(
  req: Request,
  opts: ProxyOptions,
): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const method = opts.method ?? req.method;
  const url = backendUrl(opts.path, opts.forwardQuery ? req : undefined);

  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  };
  if (opts.body !== undefined) {
    init.body = opts.body;
  } else if (MUTATING.has(method)) {
    init.body = await req.text();
  }

  const upstream = await fetch(url, init);
  return relay(upstream);
}
