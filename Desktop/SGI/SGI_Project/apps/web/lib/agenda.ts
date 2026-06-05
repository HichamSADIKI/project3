/**
 * Helpers purs Agenda — logique sans UI, testable. Partagés par l'écran
 * `realestate-agenda.tsx`.
 */

export type AgendaEvent = {
  id: string;
  title: string;
  event_type: string;
  status: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  location: string | null;
  client_id: string | null;
  property_id: string | null;
  assigned_user_id: string | null;
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

export const AGENDA_TYPES = ["appointment", "visit", "task", "call", "other"] as const;
export type AgendaType = (typeof AGENDA_TYPES)[number];

export const AGENDA_STATUSES = ["scheduled", "done", "cancelled"] as const;
export type AgendaStatus = (typeof AGENDA_STATUSES)[number];

/** Nom affichable d'un client (société ou personne), repli sur id court. */
export function clientLabel(c: ClientLite | undefined, id: string | null): string {
  if (!id) return "—";
  if (!c) return `#${id.slice(0, 8)}`;
  const name =
    c.company_name?.trim() || [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return name || `#${id.slice(0, 8)}`;
}

/** Catégorie temporelle d'un événement (pour regrouper / colorer). */
export function dayBucket(iso: string, now: Date = new Date()): "past" | "today" | "upcoming" {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "upcoming";
  const day = (x: Date): number => Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
  const ad = day(d);
  const an = day(now);
  if (ad < an) return "past";
  if (ad > an) return "upcoming";
  return "today";
}

/** Vrai si l'événement est à venir (strictement après maintenant). */
export function isUpcoming(iso: string, now: Date = new Date()): boolean {
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.getTime() > now.getTime();
}

/** Date/heure lisible courte (locale en-AE, chiffres latins). */
export function formatWhen(iso: string, allDay = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const opts: Intl.DateTimeFormatOptions = allDay
    ? { year: "numeric", month: "short", day: "2-digit" }
    : { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" };
  return new Intl.DateTimeFormat("en-AE", opts).format(d);
}
