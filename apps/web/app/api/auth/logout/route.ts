import { NextResponse } from "next/server";

import { BACKEND_URL } from "@/lib/api-proxy";
import { clearSessionCookies, getRefreshToken } from "@/lib/auth-cookies";

export async function POST(req: Request) {
  // CORS check: reject cross-origin logout requests
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  // Révoque le refresh token côté serveur (best-effort) avant d'effacer les
  // cookies — invalide la session même si un cookie traînait ailleurs.
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    try {
      await fetch(`${BACKEND_URL}/api/v1/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
        cache: "no-store",
      });
    } catch {
      /* révocation best-effort : on efface les cookies quoi qu'il arrive */
    }
  }

  await clearSessionCookies();

  const response = NextResponse.json({ success: true });

  // Security headers on logout response
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Cache-Control", "no-store");

  return response;
}
