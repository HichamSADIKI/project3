/** /api/admin/units — proxy vers /api/v1/units (liste + création). */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "units/", forwardQuery: true });
}
export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "units/" });
}
