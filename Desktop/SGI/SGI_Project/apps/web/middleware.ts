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

// ─── Helpers JWT HS256 (Web Crypto — compatible Edge Runtime) ─────────────────

function b64urlDecode(s: string): Uint8Array {
  // Restore standard base64 padding
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  const padded2 = pad === 0 ? padded : padded + "=".repeat(4 - pad);
  const bin = atob(padded2);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function verifyJwt(token: string, secret: string): Promise<boolean> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;

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

    const valid = await crypto.subtle.verify("HMAC", key, signature.buffer as ArrayBuffer, signingInput.buffer as ArrayBuffer);
    if (!valid) return false;

    // Verify expiry
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64))) as {
      exp?: number;
    };
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return false; // Token expired
    }

    return true;
  } catch {
    return false;
  }
}

// ─── Middleware principal ──────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Laisser passer les fichiers statiques Next.js
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/public/") ||
    STATIC_EXT_RE.test(pathname)
  ) {
    return NextResponse.next();
  }

  // 2. Laisser passer les routes publiques explicites (comparaison exacte)
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
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

  const valid = await verifyJwt(token, jwtSecret);
  if (!valid) {
    // Cookie présent mais invalide ou expiré → supprimer et rediriger
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.delete("sgi-session");
    return response;
  }

  // 6. Session valide → continuer
  return NextResponse.next();
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
