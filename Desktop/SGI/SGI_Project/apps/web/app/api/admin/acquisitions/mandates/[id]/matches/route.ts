/**
 * /api/admin/acquisitions/mandates/{id}/matches — proxy vers
 * /api/v1/acquisitions/mandates/{id}/matches (moteur de rapprochement PostGIS :
 * biens du tenant scorés pour ce mandat). Propage le query param `limit`.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `acquisitions/mandates/${encodeURIComponent(id)}/matches`,
    forwardQuery: true,
  });
}
