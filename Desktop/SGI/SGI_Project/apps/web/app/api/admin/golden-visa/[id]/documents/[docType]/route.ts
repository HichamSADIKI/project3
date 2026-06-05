/**
 * /api/admin/golden-visa/{id}/documents/{docType} — upload d'un document
 * Golden Visa (passport·dld·gdrfa·insurance·biometric) vers MinIO via le
 * backend. Multipart (champ `file`).
 */
import { NextResponse } from "next/server";

import { proxyMultipart } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; docType: string }> },
): Promise<NextResponse> {
  const { id, docType } = await ctx.params;
  return proxyMultipart(req, {
    path: `golden-visa/${encodeURIComponent(id)}/documents/${encodeURIComponent(docType)}`,
  });
}
