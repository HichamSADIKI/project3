/** /api/admin/owners/[party_id]/statements/[statement_id]/pdf — proxy POST (relevé PDF). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ party_id: string; statement_id: string }> },
): Promise<NextResponse> {
  const { party_id, statement_id } = await ctx.params;
  return proxy(req, { path: `owners/${party_id}/statements/${statement_id}/pdf`, method: "POST" });
}
