/** /api/admin/comms/conversations/{id}/messages — proxy GET (liste) + POST (envoi). */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";

export async function GET(req: Request, ctx: { params: Promise<{ conv_id: string }> }): Promise<NextResponse> {
  const { conv_id } = await ctx.params;
  return proxy(req, { path: `comms/conversations/${conv_id}/messages`, forwardQuery: true });
}
export async function POST(req: Request, ctx: { params: Promise<{ conv_id: string }> }): Promise<NextResponse> {
  const { conv_id } = await ctx.params;
  return proxy(req, { path: `comms/conversations/${conv_id}/messages` });
}
