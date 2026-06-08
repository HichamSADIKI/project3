/** Proxy GÉNÉRIQUE des modules générés par le Studio (3B+ C).
 *
 * Relaie GET/POST/DELETE vers le CRUD du module généré `/api/v1/{slug}/{path}` avec
 * le Bearer de session (via `proxy()`). N'ajoute AUCUNE autorité : l'utilisateur ne
 * peut atteindre que ce que son propre token permet déjà ; le module généré applique
 * sa propre Loi 1 (company_id+RLS) + require_roles. `slug` borné (anti path-traversal).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

const SLUG_RE = /^[a-z0-9_]+$/;

type Ctx = { params: Promise<{ slug: string; path?: string[] }> };

async function forward(req: Request, ctx: Ctx, method: string): Promise<NextResponse> {
  const { slug, path } = await ctx.params;
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "invalid_slug" }, { status: 400 });
  }
  const sub = (path ?? []).map(encodeURIComponent).join("/");
  const backendPath = sub ? `${slug}/${sub}` : `${slug}/`;
  return proxy(req, { path: backendPath, method, forwardQuery: true });
}

export function GET(req: Request, ctx: Ctx): Promise<NextResponse> {
  return forward(req, ctx, "GET");
}

export function POST(req: Request, ctx: Ctx): Promise<NextResponse> {
  return forward(req, ctx, "POST");
}

export function DELETE(req: Request, ctx: Ctx): Promise<NextResponse> {
  return forward(req, ctx, "DELETE");
}
