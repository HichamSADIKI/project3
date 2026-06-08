/** /api/admin/technicians/summary — proxy vers /api/v1/technicians/summary (KPIs). */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "technicians/summary" });
}
