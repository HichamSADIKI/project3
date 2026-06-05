/** /api/admin/bank/accounts — proxy GET + POST. */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";
export function GET(req: Request): Promise<NextResponse> { return proxy(req, { path: "bank/accounts", method: "GET", forwardQuery: true }); }
export function POST(req: Request): Promise<NextResponse> { return proxy(req, { path: "bank/accounts", method: "POST" }); }
