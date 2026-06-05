/** /api/admin/finance/period-closures — proxy GET (liste) + POST (clôturer). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "finance/period-closures", method: "GET" });
}
export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "finance/period-closures", method: "POST" });
}
