/**
 * /api/admin/tickets/{id}/assign — proxy POST vers
 * /api/v1/tickets/{id}/assign (attribution à un agent).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `tickets/${encodeURIComponent(id)}/assign`,
  });
}
