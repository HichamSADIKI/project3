/** /api/admin/self-defense/config — proxy → /api/v1/admin/self-defense/config (admin).
 * GET : flags + max_attempts + options. PUT : définir codes/options (hashés serveur). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "admin/self-defense/config" });
}

export function PUT(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "admin/self-defense/config", method: "PUT" });
}
