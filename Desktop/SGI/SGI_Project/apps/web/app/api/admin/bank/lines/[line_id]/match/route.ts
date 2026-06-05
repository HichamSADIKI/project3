/** match d'une ligne de relevé. */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";
export async function POST(req: Request, ctx: { params: Promise<{ line_id: string }> }): Promise<NextResponse> {
  const { line_id } = await ctx.params;
  return proxy(req, { path: `bank/lines/${line_id}/match`, method: "POST" });
}
