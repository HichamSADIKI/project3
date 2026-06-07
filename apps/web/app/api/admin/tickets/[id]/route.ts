/**
 * /api/admin/tickets/{id} — proxy vers /api/v1/tickets/{id}.
 * GET : détail du ticket + timeline d'événements (embarqués par le backend).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `tickets/${encodeURIComponent(id)}`,
    forwardQuery: true,
  });
}
