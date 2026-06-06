/**
 * /api/admin/telephony/calls/{id}/notes — proxy POST vers
 * /api/v1/telephony/calls/{id}/notes (notes de wrap-up + disposition encodée).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `telephony/calls/${encodeURIComponent(id)}/notes`,
  });
}
