/**
 * Helpers purs États des lieux (inspections) — logique sans UI, testable.
 * Partagés par l'écran `realestate-inspections.tsx`.
 */

export type Inspection = {
  id: string;
  reference: string;
  unit_id: string;
  rental_id: string | null;
  contract_id: string | null;
  inspection_type: string;
  status: string;
  scheduled_date: string | null;
  completed_at: string | null;
  signed_by: string | null;
  signed_at: string | null;
  notes: string | null;
  created_at: string;
};

export type UnitLite = { id: string; unit_number?: string | null };

export const INSP_TYPES = ["check_in", "check_out", "periodic", "pre_sale"] as const;
export type InspType = (typeof INSP_TYPES)[number];

export const INSP_STATUSES = [
  "draft",
  "scheduled",
  "in_progress",
  "completed",
  "signed",
  "cancelled",
] as const;
export type InspStatus = (typeof INSP_STATUSES)[number];

/** Transitions du cycle de vie (miroir du backend). */
export const INSP_FLOW: Record<string, InspStatus[]> = {
  draft: ["scheduled", "in_progress", "cancelled"],
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: ["signed", "in_progress"],
  signed: [],
  cancelled: [],
};

/** Libellé d'unité (n° d'unité), repli sur id court. */
export function unitLabel(u: UnitLite | undefined, id: string): string {
  const n = u?.unit_number?.trim();
  return n || (id ? `#${id.slice(0, 8)}` : "—");
}

/** Actions de cycle de vie disponibles pour un statut (boutons de l'écran). */
export function inspectionActions(status: string): ("start" | "complete" | "sign")[] {
  if (status === "draft" || status === "scheduled") return ["start"];
  if (status === "in_progress") return ["complete"];
  if (status === "completed") return ["sign"];
  return [];
}

/** Vrai si la demande peut encore évoluer (non terminale). */
export function isOpen(status: string): boolean {
  return status !== "signed" && status !== "cancelled";
}
