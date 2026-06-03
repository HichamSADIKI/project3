/**
 * /api/admin/marketing/campaigns/{id}/publish — proxy POST vers
 * /api/v1/marketing/campaigns/{id}/publish (diffusion via connecteur stub :
 * pose external_ref/published_at et passe la campagne en 'active').
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `marketing/campaigns/${encodeURIComponent(id)}/publish`,
  });
}
