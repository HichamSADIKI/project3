/** /api/admin/presence/active — proxy → /api/v1/presence/active (admin/manager).
 * GET : sessions actives + agrégations (users/ip/régions, + avancé). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "presence/active", forwardQuery: true });
}
