/** /api/admin/platform/servers/{id}/actions — demande d'action de contrôle (POST, dry-run). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `admin/platform/servers/${encodeURIComponent(id)}/actions`,
    method: "POST",
  });
}
