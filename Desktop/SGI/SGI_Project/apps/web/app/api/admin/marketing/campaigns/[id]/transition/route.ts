/**
 * /api/admin/marketing/campaigns/{id}/transition — proxy POST vers
 * /api/v1/marketing/campaigns/{id}/transition (machine à états
 * draft→scheduled→active→paused→completed | cancelled validée côté backend, 409 si invalide).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `marketing/campaigns/${encodeURIComponent(id)}/transition`,
  });
}
