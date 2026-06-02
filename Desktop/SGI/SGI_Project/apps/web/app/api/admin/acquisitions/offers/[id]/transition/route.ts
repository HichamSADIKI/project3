/**
 * /api/admin/acquisitions/offers/{id}/transition — proxy POST vers
 * /api/v1/acquisitions/offers/{id}/transition (machine à états
 * draft→submitted→accepted/rejected/withdrawn validée côté backend).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `acquisitions/offers/${encodeURIComponent(id)}/transition`,
  });
}
