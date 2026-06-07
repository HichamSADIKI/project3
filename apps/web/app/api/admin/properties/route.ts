/** /api/admin/properties — proxy vers /api/v1/properties (liste). */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "properties/", forwardQuery: true });
}
