/** /api/admin/accounting/entries/[entry_id]/void — proxy POST (→void). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(req: Request, ctx: { params: Promise<{ entry_id: string }> }): Promise<NextResponse> {
  const { entry_id } = await ctx.params;
  return proxy(req, { path: `accounting/entries/${entry_id}/void`, method: "POST" });
}
