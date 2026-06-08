/**
 * /api/admin/scraping/property — proxy vers POST /api/v1/scraping/property
 * (scrape une annonce Bayut/PropertyFinder/Dubizzle → champs pré-remplissables).
 * Injecte le JWT côté serveur ; le backend re-valide l'hôte (allowlist).
 */
import { NextResponse } from "next/server";
import { proxy } from "@/lib/api-proxy";

export function POST(req: Request): Promise<NextResponse> {
  return proxy(req, { path: "scraping/property" });
}
