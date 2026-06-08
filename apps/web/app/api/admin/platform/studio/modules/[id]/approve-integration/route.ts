/** /api/admin/platform/studio/modules/{id}/approve-integration — 4-eyes étape 2 (POST). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `admin/platform/studio/modules/${encodeURIComponent(id)}/approve-integration`,
    method: "POST",
  });
}
