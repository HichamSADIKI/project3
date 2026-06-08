/** /api/admin/vendors/ai/{party_id}/message — proxy POST → brouillon d'outreach. */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ party_id: string }> },
): Promise<NextResponse> {
  const { party_id } = await ctx.params;
  return proxy(req, { path: `vendors/ai/${encodeURIComponent(party_id)}/message` });
}
