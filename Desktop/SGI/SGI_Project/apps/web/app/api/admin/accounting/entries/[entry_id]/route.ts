/** /api/admin/accounting/entries/[entry_id] — proxy GET détail. */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(req: Request, ctx: { params: Promise<{ entry_id: string }> }): Promise<NextResponse> {
  const { entry_id } = await ctx.params;
  return proxy(req, { path: `accounting/entries/${entry_id}`, method: "GET" });
}
