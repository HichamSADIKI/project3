/** /api/admin/notifications — proxy GET (liste des notifications de l'utilisateur). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "notifications/", method: "GET" });
}
