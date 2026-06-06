/**
 * POST /api/public/lead — relai PUBLIC (non authentifié) du formulaire de
 * contact de la vitrine immobilière vers le backend FastAPI
 * `POST /api/v1/public/leads`.
 *
 * SÉCURITÉ :
 *  - Aucun cookie ni Authorization n'est transmis (endpoint public côté backend,
 *    tenant résolu via PUBLIC_SITE_COMPANY_SLUG).
 *  - On ne relaie qu'une whitelist de champs scalaires bornés en longueur
 *    (anti-injection / anti-payload abusif) — la validation stricte finale est
 *    faite par Pydantic côté backend.
 *  - On ne propage jamais de 500 : toute erreur réseau / upstream devient une
 *    réponse JSON contrôlée.
 */
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_API_URL ?? "http://api:8000";

const MAX = { name: 120, email: 254, phone: 40, message: 2000, ref: 255 };

function clampStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "invalid_body" }, { status: 400 });
  }

  const name = clampStr(body.name, MAX.name);
  const phone = clampStr(body.phone, MAX.phone);
  const email = clampStr(body.email, MAX.email);

  // Validation minimale : nom + (téléphone OU email). Le backend revalide.
  if (!name || (!phone && !email)) {
    return NextResponse.json({ success: false, error: "validation" }, { status: 400 });
  }

  // Le backend attend un contact IMBRIQUÉ : { contact: {...}, listing_slug, message }.
  const contact: Record<string, string> = { name };
  if (phone) contact.phone = phone;
  if (email) contact.email = email;
  const payload: Record<string, unknown> = { contact };
  const message = clampStr(body.message, MAX.message);
  if (message) payload.message = message;
  const listingSlug = clampStr(body.listing_slug, MAX.ref);
  if (listingSlug) payload.listing_slug = listingSlug;

  try {
    const upstream = await fetch(`${BACKEND_URL}/api/v1/public/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!upstream.ok) {
      // Ne pas révéler le détail backend au visiteur public.
      return NextResponse.json({ success: false, error: "lead_failed" }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "lead_failed" }, { status: 502 });
  }
}
