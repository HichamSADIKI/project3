/**
 * Notifications in-app — types + helpers PURS (sans UI ni réseau), partagés par
 * le centre de notifications (cloche) et son hook temps réel.
 */

export type NotifItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  status: string; // "pending" | "sent" | "read"
  created_at: string;
  read_at: string | null;
};

/** Une notification est non lue tant que son statut n'est pas "read". */
export function isUnread(n: Pick<NotifItem, "status">): boolean {
  return n.status !== "read";
}

/** Compte les non-lues d'une liste. */
export function unreadCount(list: NotifItem[]): number {
  return list.filter(isUnread).length;
}

/**
 * Préfixe une notification en tête de liste (déduplique par id, borne la taille).
 * Utilisé à la réception d'un event WS `notification.created`.
 */
export function prependNotif(list: NotifItem[], item: NotifItem, max = 30): NotifItem[] {
  return [item, ...list.filter((n) => n.id !== item.id)].slice(0, max);
}

/** Marque une notification comme lue dans la liste (immuable). */
export function markReadInList(list: NotifItem[], id: string, now: string): NotifItem[] {
  return list.map((n) => (n.id === id ? { ...n, status: "read", read_at: now } : n));
}

/** Marque toutes les notifications comme lues (immuable). */
export function markAllReadInList(list: NotifItem[], now: string): NotifItem[] {
  return list.map((n) => (isUnread(n) ? { ...n, status: "read", read_at: now } : n));
}

/**
 * URL WebSocket du flux notifications à partir de l'origine HTTP courante et d'un
 * ticket court. http→ws, https→wss ; relayé par nginx (`location /api/`).
 */
export function buildWsUrl(origin: string, ticket: string): string {
  const wsBase = origin.replace(/^http/, "ws");
  return `${wsBase}/api/v1/notifications/ws?token=${encodeURIComponent(ticket)}`;
}

/** Heure courte lisible (locale en-AE, chiffres latins). */
export function formatNotifTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMin = Math.round((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h`;
  return new Intl.DateTimeFormat("en-AE", { month: "short", day: "2-digit" }).format(d);
}
