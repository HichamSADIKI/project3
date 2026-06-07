/**
 * /api/admin/tickets/{id}/comments — proxy POST vers
 * /api/v1/tickets/{id}/comments (ajout d'un commentaire à la timeline).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `tickets/${encodeURIComponent(id)}/comments`,
  });
}
