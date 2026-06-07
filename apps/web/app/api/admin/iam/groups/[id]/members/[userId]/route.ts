/** /api/admin/iam/groups/{id}/members/{userId} — retrait d'un membre (DELETE). */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string; userId: string }> }): Promise<NextResponse> {
  const { id, userId } = await ctx.params;
  return proxy(req, { path: `iam/groups/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}` });
}
