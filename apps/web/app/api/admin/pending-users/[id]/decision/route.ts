/**
 * POST /api/admin/pending-users/:id/decision — approve/reject une inscription en attente.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;

  // Valide le corps JSON avant relai (400 si malformé).
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  return proxy(req, {
    path: `auth/pending-users/${id}/decision`,
    body: JSON.stringify(body),
  });
}
