/**
 * SGI Portal — Edge middleware.
 *
 * - Vérifie le cookie httpOnly `sgi-session` (JWT HS256) avec la lib `jose`
 *   (compatible Edge runtime, plus robuste que crypto.subtle direct).
 * - Restreint /{locale}/client/* aux JWT role=client.
 * - Restreint /{locale}/fournisseur/* aux JWT role=fournisseur.
 * - Les autres pages (home, login, register) sont publiques.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const STATIC_EXT_RE = /\.(?:ico|png|svg|jpg|jpeg|webp|woff2?|ttf|otf|css|js|map|json)$/i;

type JwtPayloadLite = { exp?: number; role?: string; status?: string };

async function verifyJwt(
  token: string,
  secret: string,
): Promise<{ valid: boolean; payload: JwtPayloadLite | null }> {
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    return { valid: true, payload: payload as JwtPayloadLite };
  } catch {
    return { valid: false, payload: null };
  }
}

function matchProtected(pathname: string): "client" | "fournisseur" | null {
  const m = pathname.match(/^\/[a-z]{2}\/(client|fournisseur)(\/|$)/);
  return (m?.[1] as "client" | "fournisseur" | undefined) ?? null;
}

function locale(pathname: string): string {
  const m = pathname.match(/^\/([a-z]{2})(\/|$)/);
  return m?.[1] ?? "fr";
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    STATIC_EXT_RE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const needsRole = matchProtected(pathname);
  if (!needsRole) return NextResponse.next();

  const token = req.cookies.get("sgi-session")?.value;
  const lc = locale(pathname);

  if (!token) {
    return NextResponse.redirect(new URL(`/${lc}/login`, req.url));
  }

  const secret = process.env.JWT_SECRET ?? "";
  if (!secret) {
    return NextResponse.redirect(new URL(`/${lc}/login`, req.url));
  }

  const { valid, payload } = await verifyJwt(token, secret);
  if (!valid || !payload) {
    const res = NextResponse.redirect(new URL(`/${lc}/login`, req.url));
    res.cookies.delete("sgi-session");
    return res;
  }

  if (payload.status && payload.status !== "active") {
    const res = NextResponse.redirect(new URL(`/${lc}/login`, req.url));
    res.cookies.delete("sgi-session");
    return res;
  }

  if (payload.role !== needsRole) {
    if (payload.role === "client" || payload.role === "fournisseur") {
      return NextResponse.redirect(new URL(`/${lc}/${payload.role}`, req.url));
    }
    return NextResponse.redirect(new URL(`/${lc}/login`, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
