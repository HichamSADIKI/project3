/**
 * /api/admin/crm/leads — proxy vers le backend FastAPI.
 *
 * GET : relaie vers /api/v1/crm/leads en propageant les query params
 * (`category`, `status`, `page`, `limit`, `q`). Utilisé par le CRM par secteur
 * du back-office pour afficher les deals — notamment ceux soumis depuis le
 * portail client, filtrés par `category` (= secteur).
 *
 * POST : crée un lead côté back-office (ex. depuis un appel téléphonique).
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "crm/leads", forwardQuery: true });
}

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "crm/leads" });
}
