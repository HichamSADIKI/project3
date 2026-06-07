/**
 * GET/POST /api/admin/clients — proxy vers le backend FastAPI.
 *
 * GET : query params `type`, `q`, `page`, `limit` propagés vers
 * /api/v1/clients/. POST : corps ClientCreate relayé.
 *
 * Utilisé par le back-office (apps/web) pour afficher et créer les clients
 * (individus / sociétés) — la même table que celle modifiée par les clients
 * depuis le portail (apps/portal /client/profile). C'est l'unique source de
 * vérité côté CRM.
 */
import { NextResponse } from "next/server";

import { proxy } from "@/lib/api-proxy";

export function GET(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "clients/", forwardQuery: true });
}

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "clients/" });
}
