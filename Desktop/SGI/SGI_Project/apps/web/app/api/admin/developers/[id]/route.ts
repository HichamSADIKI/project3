/** /api/admin/developers/{id} — détail (GET) + mise à jour (PATCH) + suppression (DELETE). */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, { path: `developers/${encodeURIComponent(id)}` });
}
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, { path: `developers/${encodeURIComponent(id)}` });
}
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, { path: `developers/${encodeURIComponent(id)}` });
}
