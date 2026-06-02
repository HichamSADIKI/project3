/**
 * /api/admin/inbox/conversations/{id}/assign — proxy POST vers
 * /api/v1/inbox/conversations/{id}/assign (attribution à un agent).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `inbox/conversations/${encodeURIComponent(id)}/assign`,
  });
}
