/**
 * /api/admin/sales/transactions/{id}/transition — proxy POST vers
 * /api/v1/sales/transactions/{id}/transition (machine à états
 * pending→completed/cancelled validée côté backend).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `sales/transactions/${encodeURIComponent(id)}/transition`,
  });
}
