/** /api/admin/iam/catalogue — arbre des nœuds de permission (matrice). */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "iam/catalogue" });
}
