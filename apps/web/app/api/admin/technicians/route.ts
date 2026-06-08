/** /api/admin/technicians — proxy vers /api/v1/technicians (liste). */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "technicians/", forwardQuery: true });
}
