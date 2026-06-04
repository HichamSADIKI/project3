/**
 * /api/admin/inbox/conversations/{id}/summarize — proxy POST vers
 * /api/v1/inbox/conversations/{id}/summarize. Enfile le résumé IA de la
 * conversation (traitement asynchrone côté worker → 202).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `inbox/conversations/${encodeURIComponent(id)}/summarize`,
  });
}
