/**
 * SGI Portal — relai multipart serveur (route handlers).
 *
 * Le proxy générique `/api/proxy/[...path]` sérialise le body en JSON, ce qui
 * casse les uploads de fichiers. Les routes dédiées multipart relaient donc le
 * FormData en stream vers FastAPI en préservant le boundary. Ce module
 * factorise ce relai (constante BACKEND_URL, garde de taille, Bearer optionnel,
 * cast `duplex: "half"` exigé par undici pour un body ReadableStream).
 *
 * IMPORTANT : serveur uniquement (dépend de `next/headers`). Ne pas importer
 * depuis un Client Component — cf. [lib/api-server.ts].
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_API_URL ?? "http://api:8000";

/**
 * Garde de taille basée sur `content-length`. Renvoie un 413 (code d'erreur
 * fourni) si la taille dépasse `maxBytes + margin`, sinon `null`.
 * `margin` couvre les champs texte + l'overhead multipart.
 */
export function guardSize(
  req: Request,
  maxBytes: number,
  errorCode: string,
  margin = 0,
): NextResponse | null {
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > 0 && contentLength > maxBytes + margin) {
    return NextResponse.json({ error: errorCode }, { status: 413 });
  }
  return null;
}

/**
 * Relai bas niveau : POST le stream multipart entrant vers `${BACKEND_URL}{path}`
 * en préservant le Content-Type (boundary inclus). Ajoute le Bearer si `token`.
 * Renvoie la Response upstream brute — au caller de décider du format de réponse.
 */
export function forwardMultipart(
  req: Request,
  path: string,
  token?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": req.headers.get("content-type") ?? "multipart/form-data",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers,
    body: req.body,
    cache: "no-store",
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

export interface MultipartProxyOptions {
  /** Chemin backend complet, ex. `"/api/v1/fournisseur/documents"`. */
  path: string;
  /** Taille max du contenu utile (octets). */
  maxBytes: number;
  /** Code d'erreur renvoyé en 413. */
  oversizeError: string;
  /** Marge tolérée au-dessus de `maxBytes` (champs texte + overhead). Défaut 0. */
  oversizeMargin?: number;
}

/**
 * Proxy multipart authentifié complet : garde 401 (cookie `sgi-session`),
 * garde de taille, relai stream, puis renvoi du corps/statut upstream brut.
 * Couvre les uploads KYC/audio du portail.
 */
export async function multipartProxy(
  req: Request,
  opts: MultipartProxyOptions,
): Promise<NextResponse> {
  const jar = await cookies();
  const token = jar.get("sgi-session")?.value;
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const tooBig = guardSize(
    req,
    opts.maxBytes,
    opts.oversizeError,
    opts.oversizeMargin ?? 0,
  );
  if (tooBig) return tooBig;

  const upstream = await forwardMultipart(req, opts.path, token);
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
