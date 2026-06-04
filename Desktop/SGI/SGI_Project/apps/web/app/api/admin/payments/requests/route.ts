/** /api/admin/payments/requests — proxy vers /api/v1/payments/requests. */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "payments/requests", forwardQuery: true });
}

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "payments/requests", method: "POST" });
}
