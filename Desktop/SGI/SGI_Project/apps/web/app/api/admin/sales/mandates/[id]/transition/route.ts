/**
 * /api/admin/sales/mandates/{id}/transition — proxy POST vers
 * /api/v1/sales/mandates/{id}/transition (machine à états
 * active→sold/expired/cancelled validée côté backend).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `sales/mandates/${encodeURIComponent(id)}/transition`,
  });
}
