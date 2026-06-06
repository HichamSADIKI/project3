/**
 * /api/admin/sales/transactions/{id} — proxy vers /api/v1/sales/transactions/{id}.
 * GET : détail de la transaction.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `sales/transactions/${encodeURIComponent(id)}`,
    forwardQuery: true,
  });
}
