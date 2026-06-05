/** /api/admin/notifications/[id]/read — proxy POST (marquer une notif comme lue). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, { path: `notifications/${id}/read`, method: "POST" });
}
