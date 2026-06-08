/** /api/admin/platform/studio/modules/{id}/integration-requests — historique 4-eyes (GET). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `admin/platform/studio/modules/${encodeURIComponent(id)}/integration-requests`,
    method: "GET",
  });
}
