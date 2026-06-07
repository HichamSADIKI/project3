import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";
export async function POST(req: Request, ctx: { params: Promise<{ pdc_id: string }> }): Promise<NextResponse> {
  const { pdc_id } = await ctx.params;
  return proxy(req, { path: `pdc/${pdc_id}/clear` });
}
