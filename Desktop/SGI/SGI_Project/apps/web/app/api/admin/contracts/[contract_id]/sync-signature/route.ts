import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";
export async function POST(req: Request, ctx: { params: Promise<{ contract_id: string }> }): Promise<NextResponse> {
  const { contract_id } = await ctx.params;
  return proxy(req, { path: `contracts/${contract_id}/sync-signature` });
}
