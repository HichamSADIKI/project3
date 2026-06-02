/**
 * /api/admin/leasing/applications/{id}/transition — proxy POST vers
 * /api/v1/leasing/applications/{id}/transition (machine à états
 * submitted→screening→approved→converted / rejected validée côté backend).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `leasing/applications/${encodeURIComponent(id)}/transition`,
  });
}
