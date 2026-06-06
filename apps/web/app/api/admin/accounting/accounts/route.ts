/** /api/admin/accounting/accounts — proxy GET (filtres) + POST. */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "accounting/accounts", method: "GET", forwardQuery: true });
}
export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "accounting/accounts", method: "POST" });
}
