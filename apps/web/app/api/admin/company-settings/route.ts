/** /api/admin/company-settings — proxy vers /api/v1/company-settings (GET + PUT). */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "company-settings" });
}
export function PUT(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "company-settings" });
}
