/** /api/admin/clients/ai/{client_id}/message/send — proxy POST → envoi réel. */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ client_id: string }> },
): Promise<NextResponse> {
  const { client_id } = await ctx.params;
  return proxy(req, { path: `clients/ai/${encodeURIComponent(client_id)}/message/send` });
}
