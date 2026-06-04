/**
 * /api/admin/social/posts/{id} — proxy DELETE vers /api/v1/social/posts/{id}.
 * Dépublie (soft delete) un post d'un canal social.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, { path: `social/posts/${encodeURIComponent(id)}`, method: "DELETE" });
}
