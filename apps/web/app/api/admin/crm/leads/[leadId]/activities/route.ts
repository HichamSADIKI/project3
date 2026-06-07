/**
 * /api/admin/crm/leads/{leadId}/activities — proxy POST vers
 * /api/v1/crm/leads/{leadId}/activities (journalise une activité sur un lead,
 * ex. un appel passé depuis le bouton click-to-call).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ leadId: string }> },
): Promise<NextResponse> {
  const { leadId } = await ctx.params;
  return proxy(req, {
    path: `crm/leads/${encodeURIComponent(leadId)}/activities`,
  });
}
