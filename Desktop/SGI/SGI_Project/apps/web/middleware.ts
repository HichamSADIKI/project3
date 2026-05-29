/**
 * SGI — Next.js Edge Middleware
 * Protège toutes les routes non-publiques en vérifiant le cookie de session.
 *
 * Cookie : "sgi-session" (httpOnly, SameSite=Strict, Secure en production)
 * Algorithme : HS256 — vérification de signature côté Edge via crypto.subtle (Web Crypto API)
 * Variable d'env requise : JWT_SECRET
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes accessibles sans session
const PUBLIC_PATHS: string[] = [
  "/",
  "/api/auth/login",
  "/api/auth/logout",
];

// Extensions de fichiers statiques autorisées sans vérification
const STATIC_EXT_RE = /\.(?:ico|png|svg|jpg|jpeg|webp|woff2?|ttf|otf|css|js|map|json)$/i;

// ─── Security headers helper ───────────────────────────────────────────────────

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " + // unsafe-eval requis pour Next.js dev
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: blob:; " +
    "connect-src 'self';"
  );
  // HSTS en prod uniquement
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }
  return response;
}

// ─── Helpers JWT HS256 (Web Crypto — compatible Edge Runtime) ─────────────────

function b64urlDecode(s: string): Uint8Array {
  // Restore standard base64 padding
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  const padded2 = pad === 0 ? padded : padded + "=".repeat(4 - pad);
  const bin = atob(padded2);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

type JwtPayloadLite = {
  exp?: number;
  role?: string;
  status?: string;
};

async function verifyJwt(
  token: string,
  secret: string,
): Promise<{ valid: boolean; payload: JwtPayloadLite | null }> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { valid: false, payload: null };

    const [headerB64, payloadB64, sigB64] = parts;

    // Import the secret key for HMAC-SHA256
    const keyData = new TextEncoder().encode(secret);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    // Verify signature
    const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = b64urlDecode(sigB64);

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature.buffer as ArrayBuffer,
      signingInput.buffer as ArrayBuffer,
    );
    if (!valid) return { valid: false, payload: null };

    // Verify expiry
    const payload = JSON.parse(
      new TextDecoder().decode(b64urlDecode(payloadB64)),
    ) as JwtPayloadLite;
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return { valid: false, payload: null }; // Token expired
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, payload: null };
  }
}

// Rôles autorisés sur le backoffice web. Les rôles publics (client/fournisseur) sont
// redirigés vers leur espace dédié sur le portal.
const BACKOFFICE_ROLES = new Set(["admin", "manager", "agent"]);
const PORTAL_BASE_URL =
  process.env.NEXT_PUBLIC_PORTAL_URL ?? "http://localhost:3001";

// ─── Middleware principal ──────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Laisser passer les fichiers statiques Next.js (sans security headers)
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/public/") ||
    STATIC_EXT_RE.test(pathname)
  ) {
    return NextResponse.next();
  }

  // 2. Laisser passer les routes publiques explicites (comparaison exacte)
  if (PUBLIC_PATHS.includes(pathname)) {
    const response = NextResponse.next();
    return applySecurityHeaders(response);
  }

  // 3. Récupérer le cookie de session
  const token = request.cookies.get("sgi-session")?.value;

  // 4. Pas de cookie → redirect vers login (racine)
  if (!token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 5. Vérification de signature JWT si JWT_SECRET est disponible
  //    (Dans l'Edge Runtime, process.env est accessible en lecture)
  const jwtSecret = process.env.JWT_SECRET ?? "";

  // Fail-closed : JWT_SECRET absent → on bloque (pas de bypass silencieux)
  if (!jwtSecret) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const { valid, payload } = await verifyJwt(token, jwtSecret);
  if (!valid || !payload) {
    // Cookie présent mais invalide ou expiré → supprimer et rediriger
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.delete("sgi-session");
    return response;
  }

  // 6. RBAC : rôles publics (client/fournisseur) ne peuvent pas accéder au backoffice.
  //    On les redirige vers le portal dédié.
  const role = payload.role ?? "agent";
  if (!BACKOFFICE_ROLES.has(role)) {
    const target =
      role === "fournisseur" ? `${PORTAL_BASE_URL}/fr/fournisseur` : `${PORTAL_BASE_URL}/fr/client`;
    const response = NextResponse.redirect(target);
    response.cookies.delete("sgi-session");
    return response;
  }

  // 7. Statut : seul `active` accède au backoffice. `pending` → page d'attente.
  if (payload.status && payload.status !== "active") {
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.delete("sgi-session");
    return response;
  }

  // 8. Session valide → continuer avec security headers
  const response = NextResponse.next();
  return applySecurityHeaders(response);
}

// Appliquer le middleware à toutes les routes sauf les assets statiques Next.js
export const config = {
  matcher: [
    /*
     * Correspond à toutes les routes SAUF :
     *   - _next/static (fichiers statiques compilés)
     *   - _next/image  (optimisation d'images)
     *   - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
