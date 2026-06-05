/** /api/admin/users — liste des utilisateurs du tenant (GET, scopé company_id). */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, {
    path: "admin/users",
    method: "GET",
    forwardQuery: true,
  });
}
