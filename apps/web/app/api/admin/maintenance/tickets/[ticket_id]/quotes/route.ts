import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";
export async function GET(req: Request, ctx: { params: Promise<{ ticket_id: string }> }): Promise<NextResponse> {
  const { ticket_id } = await ctx.params;
  return proxy(req, { path: `maintenance/tickets/${ticket_id}/quotes` });
}
