/** /api/admin/scenarios/{id}/generate — proxy POST vers /api/v1/scenarios/{id}/generate. */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, { path: `scenarios/${encodeURIComponent(id)}/generate`, method: "POST" });
}
