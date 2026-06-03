/**
 * /api/admin/marketing/campaigns/{id}/inbound-lead — proxy POST vers
 * /api/v1/marketing/campaigns/{id}/inbound-lead (retour lead → CRM :
 * dédup client, crée un CRMLead source=marketing:<ref> et incrémente leads_count).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `marketing/campaigns/${encodeURIComponent(id)}/inbound-lead`,
  });
}
