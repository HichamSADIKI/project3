/**
 * /api/admin/leasing/listings/{id} — proxy vers /api/v1/leasing/listings/{id}.
 * GET   : détail d'une annonce de location.
 * PATCH : mise à jour partielle des flags vitrine (is_featured / is_urgent).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `leasing/listings/${encodeURIComponent(id)}`,
    forwardQuery: true,
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `leasing/listings/${encodeURIComponent(id)}`,
    method: "PATCH",
  });
}
