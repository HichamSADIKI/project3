/**
 * /api/admin/marketing/campaigns/{id}/units — proxy vers
 * /api/v1/marketing/campaigns/{id}/units (unités liées à une campagne).
 * POST : attache une liste d'unités ({ unit_ids: [...] }).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `marketing/campaigns/${encodeURIComponent(id)}/units`,
  });
}
