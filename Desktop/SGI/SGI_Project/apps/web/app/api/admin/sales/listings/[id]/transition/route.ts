/**
 * /api/admin/sales/listings/{id}/transition — proxy POST vers
 * /api/v1/sales/listings/{id}/transition (machine à états
 * draft→published→under_offer→sold / withdrawn validée côté backend).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `sales/listings/${encodeURIComponent(id)}/transition`,
  });
}
