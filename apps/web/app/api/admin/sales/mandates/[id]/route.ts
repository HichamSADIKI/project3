/**
 * /api/admin/sales/mandates/{id} — proxy vers /api/v1/sales/mandates/{id}.
 * GET : détail du mandat.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `sales/mandates/${encodeURIComponent(id)}`,
    forwardQuery: true,
  });
}
