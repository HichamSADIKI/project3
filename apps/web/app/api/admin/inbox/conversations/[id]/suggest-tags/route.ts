/**
 * /api/admin/inbox/conversations/{id}/suggest-tags — proxy POST vers
 * /api/v1/inbox/conversations/{id}/suggest-tags. Enfile la suggestion de tags
 * IA (asynchrone → 202) ; l'agent valide ensuite les tags proposés.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `inbox/conversations/${encodeURIComponent(id)}/suggest-tags`,
  });
}
