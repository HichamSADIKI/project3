/** /api/admin/iam/grants — lecture par sujet (GET) + upsert en masse (PUT). */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "iam/grants", forwardQuery: true });
}
export function PUT(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "iam/grants" });
}
