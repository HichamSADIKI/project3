"use client";

// Bouton « Réseaux sociaux » + popup de choix du canal, par annonce
// (vente/location). Publie/retire via /api/admin/social/posts. CSS strictement
// logique (Loi 3, RTL-safe), chiffres latins. Les posts de l'annonce sont
// fournis par le parent (1 fetch groupé) ; après action on appelle `onChanged`.

import React, { useState } from "react";

import type { Translations } from "@/lib/i18n";
import { postJson } from "@/lib/api-client";

export type SocialPost = { id: string; listing_id: string; channel: string };

export const SOCIAL_CHANNELS: ReadonlyArray<{ key: string; label: string; color: string }> = [
  { key: "facebook", label: "Facebook", color: "#1877F2" },
  { key: "instagram", label: "Instagram", color: "#E4405F" },
  { key: "linkedin", label: "LinkedIn", color: "#0A66C2" },
  { key: "x", label: "X", color: "#101010" },
  { key: "whatsapp", label: "WhatsApp", color: "#25D366" },
  { key: "tiktok", label: "TikTok", color: "#101010" },
  { key: "snapchat", label: "Snapchat", color: "#E2B400" },
];

function IcShare() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
    </svg>
  );
}

export function SocialPublish({
  t,
  listingType,
  listingId,
  posts,
  onChanged,
}: {
  t: Translations;
  listingType: "sale" | "rent";
  listingId: string;
  posts: SocialPost[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const byChannel = new Map(posts.map((p) => [p.channel, p.id]));
  const count = posts.length;

  async function toggle(channel: string) {
    if (busy) return;
    setBusy(channel);
    setErr(null);
    try {
      const existing = byChannel.get(channel);
      let res: Response;
      if (existing) {
        res = await fetch(`/api/admin/social/posts/${existing}`, { method: "DELETE" });
      } else {
        res = await postJson("/api/admin/social/posts", {
          listing_type: listingType,
          listing_id: listingId,
          channel,
        });
      }
      if (!res.ok) {
        setErr("action_failed");
      } else {
        onChanged();
      }
    } catch {
      setErr("action_failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t.social_title}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          border: `1px solid ${count > 0 ? "var(--gold)" : "var(--line-soft)"}`,
          borderRadius: 8, padding: "5px 10px", cursor: "pointer",
          fontSize: 11.5, fontWeight: 600,
          background: count > 0 ? "rgba(212,160,55,0.12)" : "transparent",
          color: count > 0 ? "var(--gold-deep)" : "var(--ink-4)",
        }}
      >
        <IcShare />
        {t.social_btn}
        {count > 0 && (
          <span className="tnum" style={{ fontSize: 10.5, fontWeight: 700, background: "var(--gold)", color: "#1A1610", borderRadius: 999, padding: "0 6px", lineHeight: "16px" }}>{count}</span>
        )}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(10,8,4,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(440px, 96vw)", background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 16, padding: 22, boxShadow: "0 24px 60px rgba(0,0,0,0.4)" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--gold-deep)", fontSize: 15, fontWeight: 700 }}>
                <IcShare /> {t.social_title}
              </div>
              <button onClick={() => setOpen(false)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ink-4)", fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-4)", marginBottom: 16 }}>{t.social_subtitle}</div>

            {err && <div style={{ padding: "8px 12px", marginBottom: 12, borderRadius: 8, background: "var(--rose-soft)", color: "var(--rose)", fontSize: 12.5 }}>{t.action_refused}</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {SOCIAL_CHANNELS.map((c) => {
                const on = byChannel.has(c.key);
                const loading = busy === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => toggle(c.key)}
                    disabled={loading}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, width: "100%",
                      border: `1px solid ${on ? "var(--emerald)" : "var(--line-soft)"}`,
                      borderRadius: 12, padding: "11px 14px", cursor: loading ? "default" : "pointer",
                      background: on ? "rgba(16,185,129,0.08)" : "var(--bg-cream)",
                      textAlign: "start", opacity: loading ? 0.6 : 1,
                    }}
                  >
                    <span style={{ width: 26, height: 26, borderRadius: 8, background: c.color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{c.label[0]}</span>
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{c.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: on ? "var(--emerald)" : "var(--ink-4)" }}>
                      {loading ? "…" : on ? `✓ ${t.social_published}` : t.social_publish}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
