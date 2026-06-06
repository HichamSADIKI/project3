/**
 * /api/admin/inbox/conversations/{id}/notes — proxy vers
 * /api/v1/inbox/conversations/{id}/notes.
 * GET : notes internes de l'agent (jamais visibles du client).
 * POST : ajout d'une note interne.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `inbox/conversations/${encodeURIComponent(id)}/notes`,
    forwardQuery: true,
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `inbox/conversations/${encodeURIComponent(id)}/notes`,
  });
}
