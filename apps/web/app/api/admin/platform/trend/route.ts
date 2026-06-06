/** /api/admin/platform/trend — prédiction de tendance des ressources (GET). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "admin/platform/trend", method: "GET" });
}
