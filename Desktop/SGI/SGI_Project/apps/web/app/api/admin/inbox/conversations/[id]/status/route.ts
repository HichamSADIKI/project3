/**
 * /api/admin/inbox/conversations/{id}/status — proxy POST vers
 * /api/v1/inbox/conversations/{id}/status (transition de statut validée
 * côté backend : new → assigned → pending → resolved → closed).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `inbox/conversations/${encodeURIComponent(id)}/status`,
  });
}
