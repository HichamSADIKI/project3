/**
 * POST /api/admin/fournisseurs/{id}/decision — proxy vers le backend FastAPI.
 *
 * Approuve/rejette un fournisseur en attente. Relaie vers
 * /api/v1/auth/pending-users/{id}/decision — le backend bascule le compte
 * (active/rejected) ET, en cascade, le profil prestataire lié
 * (verification_status verified/rejected). Corps : { approve, reason? }.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, { path: `auth/pending-users/${id}/decision` });
}
