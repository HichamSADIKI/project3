/** /api/admin/documents — proxy vers /api/v1/documents (liste + création). */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "documents/", forwardQuery: true });
}
export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "documents/" });
}
