/**
 * /api/admin/marketing/campaigns/{id} — proxy vers /api/v1/marketing/campaigns/{id}.
 * GET   : détail d'une campagne (404 anti-BOLA hors tenant).
 * PATCH : mise à jour partielle (name, budget_aed, notes…).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, { path: `marketing/campaigns/${encodeURIComponent(id)}` });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, { path: `marketing/campaigns/${encodeURIComponent(id)}` });
}
