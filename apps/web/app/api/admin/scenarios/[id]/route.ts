/**
 * /api/admin/scenarios/{id} — proxy vers /api/v1/scenarios/{id}.
 * GET    : détail d'un scénario.
 * DELETE : suppression (soft delete).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, { path: `scenarios/${encodeURIComponent(id)}` });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, { path: `scenarios/${encodeURIComponent(id)}`, method: "DELETE" });
}
