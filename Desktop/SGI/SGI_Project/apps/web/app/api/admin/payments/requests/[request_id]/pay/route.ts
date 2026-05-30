import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";
export async function POST(req: Request, ctx: { params: Promise<{ request_id: string }> }): Promise<NextResponse> {
  const { request_id } = await ctx.params;
  return proxy(req, { path: `payments/requests/${request_id}/pay` });
}
