/** /api/admin/honeytokens/{id} — suppression (soft-delete) d'un leurre. */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, { path: `admin/honeytokens/${encodeURIComponent(id)}` });
}
