/**
 * /api/admin/tickets/{id}/transition — proxy POST vers
 * /api/v1/tickets/{id}/transition (changement de statut, machine à états
 * open→in_progress→pending→resolved→closed validée côté backend).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `tickets/${encodeURIComponent(id)}/transition`,
  });
}
