/**
 * POST /api/auth/refresh — renouvelle la session du back-office.
 *
 * Lit le cookie httpOnly `sgi-refresh`, le présente au backend
 * (`/api/v1/auth/refresh`) qui le **fait tourner** (rotation one-time-use), puis
 * réécrit les deux cookies avec l'access + le nouveau refresh. En cas d'échec
 * (refresh absent/expiré/réutilisé), on efface les cookies et on renvoie 401 :
 * le client bascule alors vers le login.
 *
 * Pas de corps attendu du client : le secret ne transite que par le cookie
 * httpOnly (jamais exposé au JS).
 */
import { NextResponse } from "next/server";

import { BACKEND_URL } from "@/lib/api-proxy";
import {
  clearSessionCookies,
  getRefreshToken,
  setSessionCookies,
} from "@/lib/auth-cookies";

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
}

export async function POST(req: Request): Promise<NextResponse> {
  // Garde CSRF : on refuse un refresh cross-origin (cookie SameSite=Strict couvre
  // déjà, ceci est une défense en profondeur cohérente avec la route logout).
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    await clearSessionCookies();
    return NextResponse.json({ error: "no_refresh_token" }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "backend_unreachable" }, { status: 502 });
  }

  if (!upstream.ok) {
    // Refresh invalide / expiré / réutilisé → on coupe la session côté client.
    await clearSessionCookies();
    let detail = "refresh_failed";
    try {
      const body = (await upstream.json()) as { detail?: string };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* défaut */
    }
    return NextResponse.json({ error: detail }, { status: 401 });
  }

  const data = (await upstream.json()) as TokenResponse;
  await setSessionCookies(
    data.access_token,
    data.expires_in,
    data.refresh_token,
    data.refresh_expires_in,
  );
  return NextResponse.json({ success: true });
}
