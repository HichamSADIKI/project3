/** /api/admin/platform/studio/modules — liste (GET) + création (POST). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "admin/platform/studio/modules", method: "GET", forwardQuery: true });
}

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "admin/platform/studio/modules", method: "POST" });
}
