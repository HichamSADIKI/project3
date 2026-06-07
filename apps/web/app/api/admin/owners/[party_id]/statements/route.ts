import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";

export async function GET(req: Request, ctx: { params: Promise<{ party_id: string }> }): Promise<NextResponse> {
  const { party_id } = await ctx.params;
  return proxy(req, { path: `owners/${party_id}/statements`, forwardQuery: true });
}

export async function POST(req: Request, ctx: { params: Promise<{ party_id: string }> }): Promise<NextResponse> {
  const { party_id } = await ctx.params;
  return proxy(req, { path: `owners/${party_id}/statements`, forwardQuery: true });
}
