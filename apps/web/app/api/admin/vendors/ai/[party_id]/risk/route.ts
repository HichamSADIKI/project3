/** /api/admin/vendors/ai/{party_id}/risk — proxy POST → /api/v1/vendors/ai/{id}/risk. */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ party_id: string }> },
): Promise<NextResponse> {
  const { party_id } = await ctx.params;
  return proxy(req, {
    path: `vendors/ai/${encodeURIComponent(party_id)}/risk`,
    forwardQuery: true,
  });
}
