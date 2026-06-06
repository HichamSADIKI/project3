/**
 * /api/admin/inbox/conversations/{id} — proxy vers
 * /api/v1/inbox/conversations/{id}. GET : détail du fil + messages.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `inbox/conversations/${encodeURIComponent(id)}`,
    forwardQuery: true,
  });
}
