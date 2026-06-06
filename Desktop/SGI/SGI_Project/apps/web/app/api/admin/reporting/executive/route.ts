/** /api/admin/reporting/executive — proxy GET (tableau de bord exécutif consolidé). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "reporting/executive", method: "GET" });
}
