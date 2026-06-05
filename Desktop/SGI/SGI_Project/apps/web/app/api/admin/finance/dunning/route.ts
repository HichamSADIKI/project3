/** /api/admin/finance/dunning — proxy GET (échéancier des impayés + relances). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "finance/dunning", method: "GET" });
}
