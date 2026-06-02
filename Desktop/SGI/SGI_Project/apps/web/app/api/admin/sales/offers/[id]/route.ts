/**
 * /api/admin/sales/offers/{id} — proxy vers /api/v1/sales/offers/{id}.
 * GET : détail de l'offre.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `sales/offers/${encodeURIComponent(id)}`,
    forwardQuery: true,
  });
}
