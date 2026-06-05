/** /api/admin/users/{id} — mise à jour rôle/statut d'un utilisateur (PATCH). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, {
    path: `admin/users/${encodeURIComponent(id)}`,
    method: "PATCH",
  });
}
