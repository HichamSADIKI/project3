/** /api/admin/workflows/instances — proxy vers /api/v1/workflows/instances. */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "workflows/instances", forwardQuery: true });
}
