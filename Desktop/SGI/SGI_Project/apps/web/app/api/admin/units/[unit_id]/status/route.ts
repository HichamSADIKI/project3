/** POST /api/admin/units/{id}/status — proxy vers /api/v1/units/{id}/status. */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ unit_id: string }> },
): Promise<NextResponse> {
  const { unit_id } = await ctx.params;
  return proxy(req, { path: `units/${unit_id}/status` });
}
