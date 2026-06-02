/**
 * /api/admin/inbox/conversations/{id}/messages — proxy vers
 * /api/v1/inbox/conversations/{id}/messages.
 * GET : fil de messages (REST, socle du temps réel WS).
 * POST : envoi d'une réponse sortante par l'agent.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `inbox/conversations/${encodeURIComponent(id)}/messages`,
    forwardQuery: true,
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `inbox/conversations/${encodeURIComponent(id)}/messages`,
  });
}
