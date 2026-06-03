/**
 * /api/admin/marketing/campaigns/{id}/units/{unit_id} — proxy DELETE vers
 * /api/v1/marketing/campaigns/{id}/units/{unit_id} (détache une unité d'une campagne).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; unit_id: string }> },
): Promise<NextResponse> {
  const { id, unit_id } = await ctx.params;
  return proxy(req, {
    path: `marketing/campaigns/${encodeURIComponent(id)}/units/${encodeURIComponent(unit_id)}`,
  });
}
