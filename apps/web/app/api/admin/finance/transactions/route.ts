/**
 * /api/admin/finance/transactions — proxy vers /api/v1/finance/transactions.
 * GET : liste paginée filtrable (type/status/direction/page/limit) — query relayée.
 * POST : création de transaction (RBAC admin/manager/accounting côté backend).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "finance/transactions", method: "GET", forwardQuery: true });
}

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "finance/transactions", method: "POST" });
}
