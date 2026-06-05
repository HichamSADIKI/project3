/** /api/admin/finance/transactions/[txn_id]/invoice — proxy POST (génère la facture PDF). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(req: Request, ctx: { params: Promise<{ txn_id: string }> }): Promise<NextResponse> {
  const { txn_id } = await ctx.params;
  return proxy(req, { path: `finance/transactions/${txn_id}/invoice`, method: "POST" });
}
