/**
 * /api/admin/contracts/{id}/pdf — génère le PDF du contrat (WeasyPrint + MinIO)
 * et renvoie une URL présignée. Relaie vers POST /api/v1/contracts/{id}/pdf.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, { path: `contracts/${encodeURIComponent(id)}/pdf`, method: "POST" });
}
