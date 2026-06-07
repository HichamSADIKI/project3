/** /api/admin/iam/users/{id} — détail (GET) + mise à jour (PUT). */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, { path: `iam/users/${encodeURIComponent(id)}` });
}
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, { path: `iam/users/${encodeURIComponent(id)}` });
}
