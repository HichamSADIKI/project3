import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";
export async function POST(req: Request, ctx: { params: Promise<{ quote_id: string }> }): Promise<NextResponse> {
  const { quote_id } = await ctx.params;
  return proxy(req, { path: `maintenance/quotes/${quote_id}/reject` });
}
