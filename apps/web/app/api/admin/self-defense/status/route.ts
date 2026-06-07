/** /api/admin/self-defense/status — proxy → /api/v1/self-defense/status (authentifié).
 * GET : le dock sait si un code est requis (armgate + arm/disarm_required), sans secret. */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "self-defense/status" });
}
