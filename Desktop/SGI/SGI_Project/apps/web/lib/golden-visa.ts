/**
 * Helpers purs Golden Visa (UAE) — logique sans UI, testable unitairement.
 * Partagés par l'écran `realestate-golden-visa.tsx`.
 */

export type GoldenVisaApp = {
  id: string;
  client_id: string;
  property_id: string | null;
  contract_id: string | null;
  application_number: string | null;
  status: string;
  passport_doc: string | null;
  dld_doc: string | null;
  gdrfa_doc: string | null;
  insurance_doc: string | null;
  biometric_photo: string | null;
  submission_date: string | null;
  approval_date: string | null;
  visa_expiry_date: string | null;
  alert_90_sent: boolean;
  alert_30_sent: boolean;
  notes: string | null;
  created_at: string;
};

export type ClientLite = {
  id: string;
  type?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
};

export const GV_STATUSES = ["pending", "submitted", "approved", "rejected", "expired"] as const;
export type GvStatus = (typeof GV_STATUSES)[number];

/** Les 5 documents UAE requis (passeport · DLD · GDRFA · assurance · photo biométrique). */
export const GV_DOCS = [
  "passport_doc",
  "dld_doc",
  "gdrfa_doc",
  "insurance_doc",
  "biometric_photo",
] as const;
export type GvDoc = (typeof GV_DOCS)[number];

/** Seuil d'éligibilité Golden Visa : bien signé ≥ 2 000 000 AED. */
export const GV_THRESHOLD_AED = 2_000_000;

/** Colonne modèle d'un document → segment d'URL d'upload (doc_type backend). */
export const GV_DOC_TYPE: Record<GvDoc, string> = {
  passport_doc: "passport",
  dld_doc: "dld",
  gdrfa_doc: "gdrfa",
  insurance_doc: "insurance",
  biometric_photo: "biometric",
};

/** Le type d'URL backend (doc_type) pour une colonne document. */
export function docTypeFor(doc: GvDoc): string {
  return GV_DOC_TYPE[doc];
}

/** Vrai si le type de document n'accepte que des images (photo biométrique). */
export function isImageOnly(doc: GvDoc): boolean {
  return doc === "biometric_photo";
}

/** Filtre `accept` HTML d'un input fichier selon le type de document. */
export function acceptFor(doc: GvDoc): string {
  return isImageOnly(doc) ? "image/*" : "application/pdf,image/*";
}

/** Nom affichable d'un client (société ou personne), repli sur un id court. */
export function clientLabel(c: ClientLite | undefined, id: string): string {
  if (!c) return id ? `#${id.slice(0, 8)}` : "—";
  const name =
    c.company_name?.trim() || [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return name || `#${id.slice(0, 8)}`;
}

/** Nombre de documents fournis (sur 5) + complétude. */
export function docsProgress(a: Pick<GoldenVisaApp, GvDoc>): {
  done: number;
  total: number;
  complete: boolean;
} {
  const done = GV_DOCS.reduce((n, k) => n + (a[k] ? 1 : 0), 0);
  return { done, total: GV_DOCS.length, complete: done === GV_DOCS.length };
}

/** Jours avant une date ISO (négatif si passée), null si absente/invalide. */
export function daysUntil(iso: string | null, today: Date = new Date()): number | null {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return null;
  const base = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((d.getTime() - base) / 86_400_000);
}

/** Bucket d'urgence d'expiration du visa (pour pastille / alertes J-90, J-30). */
export function expiryBucket(daysLeft: number | null): "none" | "expired" | "j30" | "j90" | "ok" {
  if (daysLeft === null) return "none";
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 30) return "j30";
  if (daysLeft <= 90) return "j90";
  return "ok";
}

/** Éligibilité par le montant du bien (seuil UAE 2 M AED). */
export function isEligibleAmount(amountAed: number | null | undefined): boolean {
  return (amountAed ?? 0) >= GV_THRESHOLD_AED;
}
