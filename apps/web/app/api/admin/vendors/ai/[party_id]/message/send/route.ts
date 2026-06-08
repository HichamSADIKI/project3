/** /api/admin/vendors/ai/{party_id}/message/send — proxy POST → envoi réel. */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ party_id: string }> },
): Promise<NextResponse> {
  const { party_id } = await ctx.params;
  return proxy(req, { path: `vendors/ai/${encodeURIComponent(party_id)}/message/send` });
}
