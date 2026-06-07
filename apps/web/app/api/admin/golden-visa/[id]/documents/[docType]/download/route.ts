/**
 * /api/admin/golden-visa/{id}/documents/{docType}/download — URL présignée
 * (1 h) pour télécharger un document Golden Visa stocké dans MinIO.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; docType: string }> },
): Promise<NextResponse> {
  const { id, docType } = await ctx.params;
  return proxy(req, {
    path: `golden-visa/${encodeURIComponent(id)}/documents/${encodeURIComponent(docType)}/download`,
  });
}
