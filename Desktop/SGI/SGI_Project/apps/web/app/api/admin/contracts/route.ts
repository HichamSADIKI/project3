/** /api/admin/contracts — proxy vers /api/v1/contracts (liste + création). */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "contracts/", forwardQuery: true });
}
export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "contracts/" });
}
