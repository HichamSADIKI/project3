/**
 * /api/admin/sales/listings/{id} — proxy vers /api/v1/sales/listings/{id}.
 * GET : détail de l'annonce.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `sales/listings/${encodeURIComponent(id)}`,
    forwardQuery: true,
  });
}
