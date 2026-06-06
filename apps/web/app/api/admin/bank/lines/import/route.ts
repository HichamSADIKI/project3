/** /api/admin/bank/lines/import — proxy POST (import en masse). */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";
export function POST(req: Request): Promise<NextResponse> { return proxy(req, { path: "bank/lines/import", method: "POST" }); }
