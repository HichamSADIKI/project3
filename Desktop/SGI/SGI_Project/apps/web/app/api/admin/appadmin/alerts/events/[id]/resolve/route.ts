/** /api/admin/appadmin/alerts/events/{id}/resolve — résoudre une alerte (POST). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `admin/alerts/events/${encodeURIComponent(id)}/resolve`,
    method: "POST",
  });
}
