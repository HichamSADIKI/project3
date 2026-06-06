/**
 * /api/admin/inbox/conversations/{id}/tags — proxy vers
 * /api/v1/inbox/conversations/{id}/tags.
 * GET : tags appliqués au fil.
 * POST : applique un tag (par id ou par nom selon le backend).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `inbox/conversations/${encodeURIComponent(id)}/tags`,
    forwardQuery: true,
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `inbox/conversations/${encodeURIComponent(id)}/tags`,
  });
}
