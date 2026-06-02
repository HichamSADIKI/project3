/**
 * /api/admin/leasing/listings/{id}/transition — proxy POST vers
 * /api/v1/leasing/listings/{id}/transition (machine à états
 * draft→published→reserved→leased / withdrawn validée côté backend).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `leasing/listings/${encodeURIComponent(id)}/transition`,
  });
}
