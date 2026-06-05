"use client";

/**
 * Centre de notifications — cloche flottante (haut, côté fin) + panneau déroulant.
 * Temps réel via `useNotifications` (WebSocket + repli polling). CSS strictement
 * logique (Loi 3 RTL). Libellés AR/EN/FR locaux.
 */
import React, { useState } from "react";

import { useLang } from "@/components/language-provider";
import { useNotifications } from "@/lib/use-notifications";
import { formatNotifTime, isUnread } from "@/lib/notifications";

type Lang = "ar" | "en" | "fr";

const TR: Record<Lang, Record<string, string>> = {
  fr: { title: "Notifications", empty: "Aucune notification", markAll: "Tout marquer lu", now: "à l'instant" },
  en: { title: "Notifications", empty: "No notifications", markAll: "Mark all read", now: "just now" },
  ar: { title: "الإشعارات", empty: "لا إشعارات", markAll: "تعليم الكل كمقروء", now: "الآن" },
};

export function NotificationCenter(): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;

  const { items, unread, markRead, markAll } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "fixed", insetBlockStart: 14, insetInlineEnd: 16, zIndex: 9700 }}>
      <button
        type="button"
        aria-label={L("title")}
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "relative", width: 38, height: 38, borderRadius: 999,
          border: "1px solid var(--line-soft)", background: "var(--bg-paper)",
          cursor: "pointer", display: "grid", placeItems: "center",
          boxShadow: "var(--shadow-1, 0 1px 3px rgba(0,0,0,0.08))",
        }}
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--ink-2, #333)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span
            aria-label={`${unread}`}
            style={{
              position: "absolute", insetBlockStart: -3, insetInlineEnd: -3,
              minWidth: 17, height: 17, padding: "0 4px", borderRadius: 999,
              background: "var(--rose, #d6455d)", color: "#fff", fontSize: 10,
              fontWeight: 700, display: "grid", placeItems: "center",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: -1 }} />
          <div
            role="dialog"
            aria-label={L("title")}
            style={{
              position: "absolute", insetBlockStart: 46, insetInlineEnd: 0,
              width: "min(360px, 92vw)", maxHeight: "70vh", overflow: "auto",
              background: "var(--bg-paper)", border: "1px solid var(--line-soft)",
              borderRadius: 14, boxShadow: "var(--shadow-3, 0 10px 40px rgba(0,0,0,0.18))",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBlockEnd: "1px solid var(--line-soft)" }}>
              <strong style={{ fontSize: 14 }}>{L("title")}</strong>
              {unread > 0 && (
                <button type="button" onClick={markAll} style={{ cursor: "pointer", border: "none", background: "transparent", color: "var(--gold-deep, #8a6d2f)", fontSize: 12, fontWeight: 600 }}>
                  {L("markAll")}
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>{L("empty")}</div>
            ) : (
              items.map((n) => {
                const fresh = isUnread(n);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => fresh && markRead(n.id)}
                    style={{
                      display: "flex", inlineSize: "100%", textAlign: "start", gap: 10,
                      padding: "11px 14px", cursor: fresh ? "pointer" : "default",
                      border: "none", borderBlockEnd: "1px solid var(--line-soft)",
                      background: fresh ? "var(--gold-ghost, rgba(200,160,60,0.07))" : "transparent",
                    }}
                  >
                    <span style={{ marginBlockStart: 5, width: 7, height: 7, borderRadius: 999, flexShrink: 0, background: fresh ? "var(--gold, #c0a062)" : "transparent" }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13, fontWeight: fresh ? 600 : 500, color: "var(--ink)" }}>{n.title}</span>
                      {n.body && <span style={{ display: "block", fontSize: 12, color: "var(--ink-4)", marginBlockStart: 2 }}>{n.body}</span>}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--ink-4)", flexShrink: 0 }}>{formatNotifTime(n.created_at)}</span>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
