/** /api/admin/iam/users — liste (GET) + création staff interne (POST). */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "iam/users", forwardQuery: true });
}
export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "iam/users" });
}
