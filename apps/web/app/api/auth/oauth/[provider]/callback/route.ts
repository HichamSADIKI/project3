/**
 * Callback OAuth — /api/auth/oauth/{provider}/callback
 * Google revient en GET (query), Apple en POST (form_post). On vérifie le `state`
 * (anti-CSRF), on échange le `code` côté backend (/auth/social → vérif id_token +
 * match du compte interne), puis on pose les cookies de session SGI et on
 * redirige vers l'app. Toute erreur renvoie sur /login avec ?sso_error=...
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { setSessionCookies } from "@/lib/auth-cookies";
import { backendUrl } from "@/lib/api-proxy";
import { OAUTH_STATE_COOKIE, callbackUri } from "@/lib/oauth";

async function complete(
  origin: string,
  provider: string,
  code: string | null,
  state: string | null,
): Promise<NextResponse> {
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/?sso_error=${encodeURIComponent(reason)}`, origin));

  const jar = await cookies();
  const expected = jar.get(OAUTH_STATE_COOKIE)?.value ?? null;
  // Le state est à usage unique : on le purge quoi qu'il arrive.
  jar.set(OAUTH_STATE_COOKIE, "", { maxAge: 0, path: "/api/auth/oauth" });

  if (!code || !state || expected !== `${provider}:${state}`) {
    return fail(`${provider}_state`);
  }

  const upstream = await fetch(backendUrl("auth/social"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider,
      code,
      redirect_uri: callbackUri(origin, provider),
    }),
    cache: "no-store",
  });

  if (!upstream.ok) {
    const detail =
      ((await upstream.json().catch(() => ({}))) as { detail?: string }).detail ?? "failed";
    return fail(`${provider}_${detail}`);
  }

  const data = (await upstream.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token: string;
    refresh_expires_in: number;
  };
  await setSessionCookies(
    data.access_token,
    data.expires_in,
    data.refresh_token,
    data.refresh_expires_in,
  );
  return NextResponse.redirect(new URL("/", origin));
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider } = await ctx.params;
  const url = new URL(req.url);
  return complete(url.origin, provider, url.searchParams.get("code"), url.searchParams.get("state"));
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider } = await ctx.params;
  const origin = new URL(req.url).origin;
  const form = await req.formData();
  return complete(
    origin,
    provider,
    (form.get("code") as string | null) ?? null,
    (form.get("state") as string | null) ?? null,
  );
}
