/**
 * GET /api/auth/oauth/{provider}/start — démarre le flux OAuth.
 * Construit l'URL d'autorisation du provider, pose un cookie `state` (anti-CSRF)
 * et redirige. Si le provider n'est pas configuré (client_id absent), redirige
 * vers la page de login avec ?sso_error=<provider>_not_configured.
 */
import { NextResponse } from "next/server";

import { OAUTH_STATE_COOKIE, callbackUri, providerConfig } from "@/lib/oauth";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider } = await ctx.params;
  const origin = new URL(req.url).origin;
  const cfg = providerConfig(provider);

  if (!cfg || !cfg.clientId) {
    return NextResponse.redirect(
      new URL(`/?sso_error=${encodeURIComponent(`${provider}_not_configured`)}`, origin),
    );
  }

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: callbackUri(origin, provider),
    response_type: "code",
    scope: cfg.scope,
    state,
    ...cfg.extra,
  });

  const res = NextResponse.redirect(`${cfg.authorizeUrl}?${params.toString()}`);
  // Apple renvoie le callback en POST cross-site (form_post) → le cookie state
  // doit être SameSite=None;Secure pour survivre. Google (GET) tolère Lax.
  res.cookies.set(OAUTH_STATE_COOKIE, `${provider}:${state}`, {
    httpOnly: true,
    secure: cfg.formPost || process.env.NODE_ENV === "production",
    sameSite: cfg.formPost ? "none" : "lax",
    maxAge: 600,
    path: "/api/auth/oauth",
  });
  return res;
}
