"use client";

/**
 * Hook du centre de notifications : liste + compteur non-lus via REST, push
 * temps réel via WebSocket (ticket court), repli polling (25 s) si le WS est
 * indisponible (ex. dev sans nginx). Marquage lu optimiste.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { getJson, postJson } from "./api-client";
import {
  buildWsUrl,
  markAllReadInList,
  markReadInList,
  prependNotif,
  type NotifItem,
} from "./notifications";

export type UseNotifications = {
  items: NotifItem[];
  unread: number;
  loading: boolean;
  reload: () => void;
  markRead: (id: string) => void;
  markAll: () => void;
};

export function useNotifications(): UseNotifications {
  const [items, setItems] = useState<NotifItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const loadList = useCallback(() => {
    setLoading(true);
    getJson<{ data: NotifItem[] }>("/api/admin/notifications?limit=30")
      .then((r) => setItems(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadCount = useCallback(() => {
    getJson<{ data: { count: number } }>("/api/admin/notifications/unread-count")
      .then((r) => setUnread(r.data?.count ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadList();
    loadCount();
    const poll = setInterval(loadCount, 25000); // repli si WS indispo
    return () => clearInterval(poll);
  }, [loadList, loadCount]);

  // WS temps réel (best-effort) : en dev sans nginx, échoue en silence → polling.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    let ws: WebSocket | null = null;
    getJson<{ data: { ticket: string } }>("/api/admin/notifications/ws-ticket")
      .then((r) => {
        const ticket = r.data?.ticket;
        if (!ticket || cancelled) return;
        ws = new WebSocket(buildWsUrl(window.location.origin, ticket));
        wsRef.current = ws;
        ws.onmessage = (ev: MessageEvent) => {
          try {
            const msg = JSON.parse(ev.data as string);
            if (msg.type === "notification.created" && msg.data) {
              const item: NotifItem = { status: "sent", read_at: null, ...msg.data };
              setItems((cur) => prependNotif(cur, item));
              setUnread((c) => c + 1);
            }
          } catch {
            /* message non-JSON → ignoré */
          }
        };
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      ws?.close();
      wsRef.current = null;
    };
  }, []);

  const markRead = useCallback((id: string) => {
    setItems((cur) => markReadInList(cur, id, new Date().toISOString()));
    setUnread((c) => Math.max(0, c - 1));
    void postJson(`/api/admin/notifications/${encodeURIComponent(id)}/read`, {});
  }, []);

  const markAll = useCallback(() => {
    setItems((cur) => markAllReadInList(cur, new Date().toISOString()));
    setUnread(0);
    void postJson("/api/admin/notifications/read-all", {});
  }, []);

  return { items, unread, loading, reload: loadList, markRead, markAll };
}
