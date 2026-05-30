/**
 * GET /api/admin/fournisseurs — proxy vers le backend FastAPI.
 *
 * Relaie vers /api/v1/auth/pending-fournisseurs : liste des fournisseurs en
 * attente de validation, enrichis de leur profil prestataire (catégorie, URL
 * signée de la licence commerciale, champs extraits par OCR).
 *
 * Utilisé par l'écran de validation fournisseur du back-office (apps/web).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "auth/pending-fournisseurs", method: "GET" });
}
