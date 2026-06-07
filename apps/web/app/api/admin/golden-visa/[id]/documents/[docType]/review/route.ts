/** /api/admin/golden-visa/[id]/documents/[docType]/review — proxy POST (revue d'une pièce). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; docType: string }> },
): Promise<NextResponse> {
  const { id, docType } = await ctx.params;
  return proxy(req, { path: `golden-visa/${id}/documents/${docType}/review`, method: "POST" });
}
