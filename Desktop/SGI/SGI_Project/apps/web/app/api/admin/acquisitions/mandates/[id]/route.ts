/**
 * /api/admin/acquisitions/mandates/{id} — proxy vers
 * /api/v1/acquisitions/mandates/{id}.
 * GET : détail d'un mandat d'achat.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `acquisitions/mandates/${encodeURIComponent(id)}`,
  });
}
