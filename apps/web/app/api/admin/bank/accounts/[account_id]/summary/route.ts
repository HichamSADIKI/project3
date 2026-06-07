/** summary d'un compte bancaire. */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";
export async function GET(req: Request, ctx: { params: Promise<{ account_id: string }> }): Promise<NextResponse> {
  const { account_id } = await ctx.params;
  return proxy(req, { path: `bank/accounts/${account_id}/summary`, method: "GET" });
}
