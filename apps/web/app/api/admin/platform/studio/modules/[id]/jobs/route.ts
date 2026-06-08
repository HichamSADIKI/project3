/** /api/admin/platform/studio/modules/{id}/jobs — historique des jobs codegen (GET). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `admin/platform/studio/modules/${encodeURIComponent(id)}/jobs`,
    method: "GET",
  });
}
