/** /api/admin/appadmin/alerts/rules/{id} — mise à jour (PATCH) / suppression (DELETE). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `admin/alerts/rules/${encodeURIComponent(id)}`,
    method: "PATCH",
  });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `admin/alerts/rules/${encodeURIComponent(id)}`,
    method: "DELETE",
  });
}
