/** /api/admin/self-defense/lockouts — proxy → /api/v1/admin/self-defense/lockouts (admin).
 * GET : utilisateurs verrouillés de la société. */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "admin/self-defense/lockouts" });
}
