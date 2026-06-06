/**
 * /api/admin/acquisitions/offers/{id} — proxy vers
 * /api/v1/acquisitions/offers/{id}.
 * GET : détail d'une offre d'achat.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `acquisitions/offers/${encodeURIComponent(id)}`,
  });
}
