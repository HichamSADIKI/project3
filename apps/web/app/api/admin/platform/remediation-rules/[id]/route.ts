/** /api/admin/platform/remediation-rules/{id} — suppression (DELETE). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `admin/platform/remediation-rules/${encodeURIComponent(id)}`,
    method: "DELETE",
  });
}
