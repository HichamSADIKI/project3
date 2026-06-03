/** /api/admin/iam/groups — liste (GET) + création (POST). */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "iam/groups" });
}
export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "iam/groups" });
}
