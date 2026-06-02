/**
 * /api/admin/leasing/applications/{id} — proxy vers /api/v1/leasing/applications/{id}.
 * GET : détail d'une candidature locataire.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `leasing/applications/${encodeURIComponent(id)}`,
    forwardQuery: true,
  });
}
