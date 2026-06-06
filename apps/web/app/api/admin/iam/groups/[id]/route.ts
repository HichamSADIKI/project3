/** /api/admin/iam/groups/{id} — mise à jour (PUT) + suppression (DELETE). */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, { path: `iam/groups/${encodeURIComponent(id)}` });
}
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, { path: `iam/groups/${encodeURIComponent(id)}` });
}
