/** /api/admin/self-defense/lockouts/{userId}/unlock — proxy → backend unlock (admin). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ userId: string }> },
): Promise<NextResponse> {
  const { userId } = await ctx.params;
  return proxy(req, {
    path: `admin/self-defense/lockouts/${encodeURIComponent(userId)}/unlock`,
  });
}
