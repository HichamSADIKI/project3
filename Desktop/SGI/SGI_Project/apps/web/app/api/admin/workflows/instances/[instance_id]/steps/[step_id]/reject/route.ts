import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";
export async function POST(req: Request, ctx: { params: Promise<{ instance_id: string; step_id: string }> }): Promise<NextResponse> {
  const { instance_id, step_id } = await ctx.params;
  return proxy(req, { path: `workflows/instances/${instance_id}/steps/${step_id}/reject` });
}
