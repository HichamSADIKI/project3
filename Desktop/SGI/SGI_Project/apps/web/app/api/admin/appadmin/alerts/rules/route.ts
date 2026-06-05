/** /api/admin/appadmin/alerts/rules — règles de seuil (GET liste, POST création). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, {
    path: "admin/alerts/rules",
    method: "GET",
    forwardQuery: true,
  });
}

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "admin/alerts/rules", method: "POST" });
}
