/**
 * /api/admin/sales/offers/{id}/transition — proxy POST vers
 * /api/v1/sales/offers/{id}/transition (machine à états
 * submitted→accepted/rejected/withdrawn validée côté backend).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `sales/offers/${encodeURIComponent(id)}/transition`,
  });
}
